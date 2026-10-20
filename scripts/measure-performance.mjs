import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  describeMachine,
  describeSource,
  ratio,
  roundedMedian,
} from './performance-report.mjs';
import {
  checkPerformanceBudget,
  readPerformanceBudget,
} from './performance-budget.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'http://127.0.0.1:5203';
const LOCALES = [
  { id: 'zh-CN', path: '/zh-CN', browserLocale: 'zh-CN' },
  { id: 'en', path: '/en', browserLocale: 'en-US' },
];
const VIEWPORT = { width: 1365, height: 768 };
const SERVER_READY_PATH = '/api/v1/health/live';
const RESOURCE_SETTLE_MS = 500;
const SERVER_START_TIMEOUT_MS = 20_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;
const SERVER_LOG_LIMIT = 8_000;
const RUNS_PER_LOCALE = 7;
const WARMUPS_PER_LOCALE = 1;
const WRITE_BASELINE = process.argv.includes('--write-baseline');
const CHECK_BUDGET = process.argv.includes('--check-budget');
const BASELINE_PATH = path.join(ROOT, 'quality', 'performance-baseline.json');
const BUILD_FILES = [
  'apps/server/dist/index.js',
  'apps/web/dist/client/index.html',
  'apps/web/dist/server/entry-server.js',
];
const METRICS = [
  'ttfbMs',
  'domContentLoadedMs',
  'loadEventEndMs',
  'fcpMs',
  'lcpMs',
  'resourceCount',
  'resourceTransferBytes',
  'resourceEncodedBodyBytes',
  'resourceDecodedBodyBytes',
  'pageTransferBytes',
  'pageEncodedBodyBytes',
  'pageDecodedBodyBytes',
];

if (
  process.argv
    .slice(2)
    .some(
      (option) => !['--write-baseline', '--check-budget'].includes(option),
    ) ||
  (WRITE_BASELINE && CHECK_BUDGET)
) {
  throw new Error(
    'Usage: node scripts/measure-performance.mjs [--write-baseline | --check-budget]',
  );
}
void measure().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

async function measure() {
  await assertBuildExists();
  const performanceBudget = await readPerformanceBudget(
    BASELINE_PATH,
    LOCALES.map(({ id }) => id),
  );
  await assertPortAvailable();
  const server = startServer();
  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const samples = Object.fromEntries(LOCALES.map(({ id }) => [id, []]));
    for (const locale of LOCALES) await measurePage(browser, locale);
    for (let run = 0; run < RUNS_PER_LOCALE; run += 1) {
      for (const locale of LOCALES) {
        samples[locale.id].push(await measurePage(browser, locale));
      }
    }
    const output = await buildReport(
      browser.version(),
      samples,
      performanceBudget,
    );
    if (CHECK_BUDGET) {
      output.budgetCheck = checkPerformanceBudget(
        output.locales,
        performanceBudget,
        LOCALES.map(({ id }) => id),
      );
      if (!output.budgetCheck.passed) process.exitCode = 1;
    }
    if (WRITE_BASELINE) {
      await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
      output.baselineFile = path
        .relative(ROOT, BASELINE_PATH)
        .replaceAll(path.sep, '/');
      await writeFile(
        BASELINE_PATH,
        `${JSON.stringify(output, null, 2)}\n`,
        'utf8',
      );
    }
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

async function assertBuildExists() {
  const missing = (
    await Promise.all(
      BUILD_FILES.map((file) =>
        access(path.join(ROOT, file)).then(
          () => null,
          () => file,
        ),
      ),
    )
  ).filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Production build files are missing: ${missing.join(', ')}. Run pnpm build first.`,
    );
  }
}

async function assertPortAvailable() {
  const response = await fetch(`${BASE_URL}${SERVER_READY_PATH}`, {
    signal: AbortSignal.timeout(1_000),
  }).catch(() => null);
  if (response)
    throw new Error(`Port 5203 is already serving HTTP (${response.status}).`);
}

function startServer() {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.TEST_DATABASE_URL;
  delete env.ADMIN_SETUP_TOKEN;
  delete env.NODE_OPTIONS;
  Object.assign(env, {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: '5203',
    SITE_ORIGIN: BASE_URL,
    WEB_ROOT: '../web',
  });
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: path.join(ROOT, 'apps/server'),
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.output = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    child.output = `${child.output}${chunk}`.slice(-SERVER_LOG_LIMIT);
  });
  return child;
}

async function waitForServer(server) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (server.exitCode !== null) {
      throw new Error(
        `Production server exited during startup.\n${server.output}`,
      );
    }
    try {
      const response = await fetch(`${BASE_URL}${SERVER_READY_PATH}`, {
        signal: AbortSignal.timeout(1_000),
      });
      const body = await response.json();
      if (response.ok && body?.checks?.database === 'skipped') return;
      throw new Error(
        `Health probe must report database skipped; received HTTP ${response.status}: ${JSON.stringify(body)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Health probe'))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Production server did not become ready.\n${server.output}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  let timeout;
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => {
      timeout = setTimeout(resolve, SERVER_STOP_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timeout));
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function measurePage(browser, locale) {
  const context = await browser.newContext({
    locale: locale.browserLocale,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.__performanceMeasure = { lcpMs: null };
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) globalThis.__performanceMeasure.lcpMs = last.startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        globalThis.__performanceMeasure.lcpMs = null;
      }
    });
    const response = await page.goto(`${BASE_URL}${locale.path}`, {
      waitUntil: 'load',
      timeout: 30_000,
    });
    if (response === null || response.status() !== 200) {
      throw new Error(
        `Navigation ${locale.path} returned ${response?.status() ?? 'no response'}.`,
      );
    }
    await page.waitForTimeout(RESOURCE_SETTLE_MS);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation === undefined) {
        throw new Error('Navigation Timing entry is unavailable.');
      }
      const resources = performance.getEntriesByType('resource');
      const paints = performance.getEntriesByType('paint');
      const fcp = paints.find(
        (entry) => entry.name === 'first-contentful-paint',
      );
      const byteTotals = resources.reduce(
        (totals, entry) => ({
          transfer: totals.transfer + entry.transferSize,
          encoded: totals.encoded + entry.encodedBodySize,
          decoded: totals.decoded + entry.decodedBodySize,
        }),
        { transfer: 0, encoded: 0, decoded: 0 },
      );
      const documentEncoded = navigation.encodedBodySize;
      const documentDecoded = navigation.decodedBodySize;
      const documentTransfer = navigation.transferSize;
      const roundTiming = (value) => Math.round(value * 10) / 10;
      return {
        ttfbMs: roundTiming(navigation.responseStart - navigation.requestStart),
        domContentLoadedMs: roundTiming(navigation.domContentLoadedEventEnd),
        loadEventEndMs: roundTiming(navigation.loadEventEnd),
        fcpMs: fcp === undefined ? null : roundTiming(fcp.startTime),
        lcpMs:
          globalThis.__performanceMeasure.lcpMs === null
            ? null
            : roundTiming(globalThis.__performanceMeasure.lcpMs),
        resourceCount: resources.length,
        resourceTransferBytes: byteTotals.transfer,
        resourceEncodedBodyBytes: byteTotals.encoded,
        resourceDecodedBodyBytes: byteTotals.decoded,
        pageTransferBytes: byteTotals.transfer + documentTransfer,
        pageEncodedBodyBytes: byteTotals.encoded + documentEncoded,
        pageDecodedBodyBytes: byteTotals.decoded + documentDecoded,
      };
    });
    if (metrics.fcpMs === null || metrics.lcpMs === null) {
      throw new Error(
        `Browser did not expose FCP and LCP for ${locale.path}: ${JSON.stringify(metrics)}`,
      );
    }
    return metrics;
  } finally {
    await context.close();
  }
}

async function buildReport(browserVersion, samples, performanceBudget) {
  const summary = Object.fromEntries(
    LOCALES.map((locale) => {
      const localeSamples = samples[locale.id];
      const median = Object.fromEntries(
        METRICS.map((metric) => [
          metric,
          roundedMedian(localeSamples.map((sample) => sample[metric])),
        ]),
      );
      median.resourceCompressionRatio = ratio(
        median.resourceEncodedBodyBytes,
        median.resourceDecodedBodyBytes,
      );
      return [
        locale.id,
        {
          path: locale.path,
          runs: localeSamples.length,
          median,
          samples: localeSamples,
        },
      ];
    }),
  );
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose:
      'Stage 11 production browser performance baseline; informational only.',
    server: {
      command: 'node dist/index.js',
      cwd: 'apps/server',
      environment: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 5203,
        SITE_ORIGIN: BASE_URL,
        WEB_ROOT: '../web',
        databaseUrl: 'unset; health probe must report database skipped',
      },
    },
    methodology: {
      browser: 'Playwright Chromium headless',
      browserVersion,
      playwrightVersion: JSON.parse(
        await readFile(
          path.join(ROOT, 'node_modules/@playwright/test/package.json'),
          'utf8',
        ),
      ).version,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'blocked',
      cache: 'fresh browser context for every navigation',
      waitUntil: 'load plus 500 ms for final paint/resource entries',
      warmupsPerLocale: WARMUPS_PER_LOCALE,
      measuredRunsPerLocale: RUNS_PER_LOCALE,
      resourceBytes: {
        transfer:
          'resourceTransferBytes sums subresources; pageTransferBytes adds the document. Transfer sizes include headers.',
        encoded: 'encodedBodySize, the response body after content encoding.',
        decoded: 'decodedBodySize, the body after browser decompression.',
        compressionRatio: '1 - encoded / decoded resource body bytes.',
      },
    },
    environment: describeMachine(),
    source: describeSource(ROOT),
    locales: summary,
    performanceBudget,
    enforcementEnabled: true,
  };
}
