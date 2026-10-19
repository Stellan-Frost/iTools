#!/usr/bin/env node
/**
 * 阶段 3 历史验收脚本（不再作为当前门禁）。
 * 阶段 4 引入 preview 三态后，Sitemap 只包含 implemented 工具，本脚本中
 * “Sitemap 含 json-viewer / 工具页可索引”等断言已不适用。
 * 当前验收请使用 `node scripts/verify-stage-4.mjs`。
 *
 * 阶段 3 端到端验收：启动生产构建产物，对真实 HTTP 响应做断言。
 * 前置：先执行 `pnpm build`。
 * 用法：`node scripts/verify-stage-3.mjs`
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 5199;
const origin = `http://127.0.0.1:${port}`;
const serverDir = new URL('../apps/server/', import.meta.url);

const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? ` → ${detail}` : ''}`);
}

async function request(path, init) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...init });
}

async function waitForServer(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/robots.txt`);
      if (response.status === 200) return true;
    } catch {
      // 服务尚未监听
    }
    await delay(200);
  }
  return false;
}

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    SITE_ORIGIN: origin,
    WEB_ROOT: '../web',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
child.stdout.on('data', (chunk) => {
  serverLog += chunk;
});
child.stderr.on('data', (chunk) => {
  serverLog += chunk;
});

try {
  if (!(await waitForServer())) {
    throw new Error(`服务未在 20s 内就绪\n${serverLog}`);
  }

  const root = await request('/');
  check('根路径重定向', root.status === 302, `status=${root.status}`);
  check(
    '根路径 Location',
    root.headers.get('location') === '/zh-CN',
    `location=${root.headers.get('location')}`,
  );

  const trailing = await request('/zh-CN/?from=test');
  check('尾斜杠 308', trailing.status === 308, `status=${trailing.status}`);
  check(
    '尾斜杠保留查询串',
    trailing.headers.get('location') === '/zh-CN?from=test',
    `location=${trailing.headers.get('location')}`,
  );

  const zhHome = await request('/zh-CN');
  const zhHtml = await zhHome.text();
  check('中文首页 200', zhHome.status === 200, `status=${zhHome.status}`);
  check(
    '中文首页 content-type',
    (zhHome.headers.get('content-type') ?? '').includes(
      'text/html; charset=utf-8',
    ),
    zhHome.headers.get('content-type'),
  );
  check('中文首页 lang', zhHtml.includes('<html lang="zh-CN"'), 'lang 缺失');
  check(
    '中文首页 title',
    /<title>[^<]*iTools[^<]*<\/title>/.test(zhHtml),
    'title 缺失',
  );
  check(
    '中文首页 canonical',
    /rel="canonical" href="http:\/\/127\.0\.0\.1:5199\/zh-CN"/.test(zhHtml),
    'canonical 缺失',
  );
  check(
    '中文首页 hreflang',
    zhHtml.includes('hreflang="en"') && zhHtml.includes('hreflang="x-default"'),
    'hreflang 缺失',
  );
  check('中文首页 SSR 内容', zhHtml.includes('分类'), '未渲染页面内容');
  check(
    '中文首页带客户端入口',
    /<script type="module"[^>]*src="\/assets\/[^"]+\.js"/.test(zhHtml),
    '客户端入口缺失（构建产物异常）',
  );

  const enHome = await request('/en');
  const enHtml = await enHome.text();
  check('英文首页 200', enHome.status === 200, `status=${enHome.status}`);
  check('英文首页 lang', enHtml.includes('<html lang="en"'), 'lang 缺失');
  check('英文首页无中文', !/[\u4e00-\u9fff]/.test(enHtml), '检测到中文字符');
  check(
    '英文首页 canonical',
    /rel="canonical" href="http:\/\/127\.0\.0\.1:5199\/en"/.test(enHtml),
    'canonical 缺失',
  );

  const tool = await request('/zh-CN/text/json-viewer');
  const toolHtml = await tool.text();
  check('工具页 200', tool.status === 200, `status=${tool.status}`);
  check('工具页标题', toolHtml.includes('JSON'), '标题内容缺失');

  const disabledTool = await request('/zh-CN/text/csv-inspector');
  check(
    '停用工具 404',
    disabledTool.status === 404,
    `status=${disabledTool.status}`,
  );
  check(
    '404 不缓存',
    (disabledTool.headers.get('cache-control') ?? '').includes('no-store'),
    disabledTool.headers.get('cache-control'),
  );

  const unknownCategory = await request('/zh-CN/does-not-exist');
  check(
    '未知分类 404',
    unknownCategory.status === 404,
    `status=${unknownCategory.status}`,
  );

  const unknownLocale = await request('/fr');
  check(
    '未知语言 404',
    unknownLocale.status === 404,
    `status=${unknownLocale.status}`,
  );

  const sitemap = await request('/sitemap.xml');
  const sitemapText = await sitemap.text();
  check('sitemap 200', sitemap.status === 200, `status=${sitemap.status}`);
  check(
    'sitemap content-type',
    (sitemap.headers.get('content-type') ?? '').includes('application/xml'),
    sitemap.headers.get('content-type'),
  );
  check(
    'sitemap 含中文工具',
    sitemapText.includes('/zh-CN/text/json-viewer'),
    '缺少条目',
  );
  check(
    'sitemap 含英文工具',
    sitemapText.includes('/en/text/json-viewer'),
    '缺少条目',
  );
  check(
    'sitemap 排除停用工具',
    !sitemapText.includes('csv-inspector'),
    '含停用工具',
  );
  check('sitemap 排除任务页', !sitemapText.includes('/tasks'), '含任务页');

  const robots = await request('/robots.txt');
  const robotsText = await robots.text();
  check('robots 200', robots.status === 200, `status=${robots.status}`);
  check(
    'robots 指向 sitemap',
    robotsText.includes(`Sitemap: ${origin}/sitemap.xml`),
    '缺少 Sitemap 行',
  );
  check(
    'robots 禁止任务页',
    robotsText.includes('Disallow: /zh-CN/tasks'),
    '缺少 Disallow',
  );
} catch (error) {
  failures.push(`执行异常：${error.message}`);
} finally {
  child.kill();
}

for (const entry of checks) {
  console.log(
    `${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.ok ? '' : `  (${entry.detail})`}`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} 项失败`);
  process.exitCode = 1;
} else {
  console.log(`\n全部 ${checks.length} 项通过`);
}
