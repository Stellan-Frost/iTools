#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findBreakingOpenApiChanges } from './openapi-compatibility.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASELINE = resolve(ROOT, 'quality/openapi-baseline.json');
const SERVER_DIR = resolve(ROOT, 'apps/server');
const SERVER_PORT = 5202;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const OPENAPI_PATH = '/api/v1/openapi.json';

async function readJson(path) {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
}

function testDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (value === undefined || value.trim() === '') {
    throw new Error(
      'Set TEST_DATABASE_URL to an isolated database ending in _test.',
    );
  }
  try {
    const parsed = new URL(value);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    if (
      !/^postgres(?:ql)?:$/.test(parsed.protocol) ||
      !databaseName.endsWith('_test')
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'TEST_DATABASE_URL must be a valid PostgreSQL URL ending in _test.',
    );
  }
  return value;
}

async function assertServerBuild() {
  try {
    await access(resolve(SERVER_DIR, 'dist/index.js'));
    await access(resolve(ROOT, 'apps/web/dist/server/entry-server.js'));
    await access(resolve(ROOT, 'apps/web/dist/client/index.html'));
  } catch {
    throw new Error(
      'Production build is missing; run pnpm build before checking OpenAPI.',
    );
  }
}

async function assertPortAvailable() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once('error', reject);
    probe.listen(SERVER_PORT, '127.0.0.1', () => {
      probe.close((error) => (error ? reject(error) : resolvePromise()));
    });
  }).catch(() => {
    throw new Error(
      `Port ${SERVER_PORT} is occupied; stop its process and retry OpenAPI diff.`,
    );
  });
}

function startProductionServer(databaseUrl) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.ADMIN_SETUP_TOKEN;
  Object.assign(env, {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(SERVER_PORT),
    SITE_ORIGIN: SERVER_URL,
    WEB_ROOT: '../web',
    DATABASE_URL: databaseUrl,
    ADMIN_SETUP_TOKEN: '',
  });
  return spawn(process.execPath, ['dist/index.js'], {
    cwd: SERVER_DIR,
    env,
    stdio: 'ignore',
  });
}

async function waitForOpenApi(server) {
  let spawnError;
  server.once('error', (error) => {
    spawnError = error;
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Production server exited before OpenAPI was ready${spawnError ? `: ${spawnError.message}` : '.'}`,
      );
    }
    try {
      const response = await fetch(`${SERVER_URL}${OPENAPI_PATH}`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return response.json();
    } catch {
      // The service is still starting or the request timed out.
    }
    await delay(200);
  }
  throw new Error(
    `Production server did not serve ${OPENAPI_PATH} within 20 seconds.`,
  );
}

async function stopServer(server) {
  if (
    server.pid === undefined ||
    server.exitCode !== null ||
    server.signalCode !== null
  )
    return;
  const exited = new Promise((resolveExit) => {
    const finish = () => {
      server.off('exit', finish);
      server.off('error', finish);
      resolveExit();
    };
    server.once('exit', finish);
    server.once('error', finish);
  });
  server.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!stopped) {
    server.kill('SIGKILL');
    await exited;
  }
}

async function currentDocument() {
  await assertServerBuild();
  await assertPortAvailable();
  const server = startProductionServer(testDatabaseUrl());
  try {
    return await waitForOpenApi(server);
  } finally {
    await stopServer(server);
  }
}

function currentFile(args) {
  if (args.length === 0) return undefined;
  if (args.length === 2 && args[0] === '--current') {
    return resolve(process.cwd(), args[1]);
  }
  throw new Error(
    'Use --current <file> only for an offline compatibility probe.',
  );
}

export async function runOpenApiDiff(inputFile) {
  const [before, after] = await Promise.all([
    readJson(BASELINE),
    inputFile === undefined ? currentDocument() : readJson(inputFile),
  ]);
  const changes = findBreakingOpenApiChanges(before, after);
  if (changes.length > 0) {
    process.stderr.write(
      `OpenAPI breaking changes (${changes.length}):\n${changes.map((item) => `- ${item}`).join('\n')}\n`,
    );
    return 1;
  }
  process.stdout.write(
    'Public and admin OpenAPI is backward compatible with quality/openapi-baseline.json.\n',
  );
  process.stdout.write(
    'Admin routes are registered through TEST_DATABASE_URL; no database migration or write is performed.\n',
  );
  return 0;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = await runOpenApiDiff(currentFile(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `OpenAPI diff failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
