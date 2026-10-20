#!/usr/bin/env node
/**
 * Stage 10 PWA acceptance checks against the current production build.
 * Prerequisite: build the web app, then run `node scripts/verify-stage-10.mjs`.
 */
import { createHash, webcrypto } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(repositoryRoot, 'apps/web/dist/client');
const manifestPath = resolve(clientRoot, 'sw-manifest.json');
const workerPath = resolve(clientRoot, 'sw.js');
const workerParts = ['sw-offline.js', 'sw-core.js'];
const indexPath = resolve(clientRoot, 'index.html');
const webManifestPath = resolve(clientRoot, 'manifest.webmanifest');
const origin = 'https://itools.test';

const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assetPath(assetUrl) {
  const url = new URL(assetUrl, origin);
  if (
    url.origin !== origin ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith('/')
  ) {
    throw new Error(`不安全或非规范的 manifest URL：${assetUrl}`);
  }
  const decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const path = resolve(clientRoot, decodedPath);
  if (path !== clientRoot && !path.startsWith(`${clientRoot}${sep}`)) {
    throw new Error(`manifest URL 越出构建目录：${assetUrl}`);
  }
  return path;
}

function responseFrom(bytes, options = {}) {
  return new Response(bytes, {
    status: options.status ?? 200,
    headers: options.headers ?? { 'Content-Type': 'application/octet-stream' },
  });
}

function inputUrl(input) {
  if (typeof input === 'string') return new URL(input, origin);
  if (input && typeof input.url === 'string') return new URL(input.url, origin);
  if (input && typeof input.href === 'string')
    return new URL(input.href, origin);
  return new URL(String(input), origin);
}

class MemoryCache {
  constructor(name, storage) {
    this.name = name;
    this.storage = storage;
    this.entries = new Map();
  }

  async put(request, response) {
    const key = inputUrl(request).href;
    if (this.storage.shouldFailPut(this.name, key)) {
      throw new Error(`Injected Cache.put failure for ${this.name}`);
    }
    this.entries.set(key, response.clone());
  }

  async match(request) {
    const response = this.entries.get(inputUrl(request).href);
    return response ? response.clone() : undefined;
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async delete(request) {
    return this.entries.delete(inputUrl(request).href);
  }
}

class MemoryCacheStorage {
  constructor() {
    this.items = new Map();
    this.putFailure = null;
  }

  async open(name) {
    let cache = this.items.get(name);
    if (!cache) {
      cache = new MemoryCache(name, this);
      this.items.set(name, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.items.keys()];
  }

  async delete(name) {
    return this.items.delete(name);
  }

  shouldFailPut(name, key) {
    if (!this.putFailure || !this.putFailure(name, key)) return false;
    this.putFailure = null;
    return true;
  }

  async snapshot() {
    const snapshot = {};
    for (const name of [...this.items.keys()].sort()) {
      const cache = this.items.get(name);
      const entries = {};
      for (const [key, response] of [...cache.entries.entries()].sort(
        ([a], [b]) => a.localeCompare(b),
      )) {
        const bytes = Buffer.from(await response.clone().arrayBuffer());
        entries[key] = {
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          sha256: sha256(bytes),
        };
      }
      snapshot[name] = entries;
    }
    return snapshot;
  }
}

function createIndexedDbSentinel() {
  const state = { records: ['preserve-me'], calls: [] };
  return {
    state,
    api: Object.freeze({
      open() {
        state.calls.push('open');
        throw new Error('The service worker must not access IndexedDB.');
      },
      deleteDatabase() {
        state.calls.push('deleteDatabase');
        throw new Error('The service worker must not access IndexedDB.');
      },
    }),
  };
}

function createWorker(manifest, options = {}) {
  const storage = new MemoryCacheStorage();
  const indexedDb = createIndexedDbSentinel();
  const clients = [];
  const fetchCalls = [];
  let isOffline = false;
  const workerMessages = [];
  const controls = { claimCalls: 0, skipWaitingCalls: 0 };
  const importedWorkerScripts = [];
  const assetByUrl = new Map(
    manifest.assets.map((asset) => [asset.url, asset]),
  );
  const workerScope = `${origin}/`;
  let context;

  const fakeFetch = async (input, init = {}) => {
    const url = inputUrl(input);
    fetchCalls.push({
      url: url.href,
      method: init.method ?? input?.method ?? 'GET',
    });
    if (isOffline) throw new Error('Simulated offline network.');

    if (url.pathname === '/sw-manifest.json') {
      return responseFrom(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const asset = assetByUrl.get(url.pathname);
    if (asset) {
      if (options.failAsset === asset.url) {
        return responseFrom('unavailable', { status: 503 });
      }
      let bytes = readFileSync(assetPath(asset.url));
      if (options.corruptAsset === asset.url)
        bytes = Buffer.concat([bytes, Buffer.from('corrupt')]);
      return responseFrom(bytes);
    }

    if (url.pathname === '/zh-CN' || url.pathname === '/en') {
      const language = url.pathname === '/en' ? 'en' : 'zh-CN';
      const body = `<!doctype html><html lang="${language}"><body>SERVER HOME ${language}</body></html>`;
      return responseFrom(body, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return responseFrom(`network response for ${url.pathname}`, {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const self = {
    location: { origin },
    registration: { scope: workerScope },
    crypto: webcrypto,
    indexedDB: indexedDb.api,
    addEventListener(type, listener) {
      const listeners = eventListeners.get(type) ?? [];
      listeners.push(listener);
      eventListeners.set(type, listeners);
    },
    clients: {
      async matchAll() {
        return clients;
      },
      async claim() {
        controls.claimCalls += 1;
      },
    },
    async skipWaiting() {
      controls.skipWaitingCalls += 1;
    },
  };
  const eventListeners = new Map();
  const importScripts = (...scriptUrls) => {
    for (const scriptUrl of scriptUrls) {
      const url = new URL(scriptUrl, workerScope);
      if (url.origin !== origin || url.search || url.hash) {
        throw new Error(`Unsafe service worker import URL: ${scriptUrl}`);
      }
      const localPath = resolve(
        clientRoot,
        decodeURIComponent(url.pathname.replace(/^\/+/, '')),
      );
      if (
        localPath !== clientRoot &&
        !localPath.startsWith(`${clientRoot}${sep}`)
      ) {
        throw new Error(
          `Service worker import escapes build output: ${scriptUrl}`,
        );
      }
      const source = readFileSync(localPath, 'utf8');
      importedWorkerScripts.push(url.pathname);
      vm.runInContext(source, context, {
        filename: `apps/web/dist/client${url.pathname}`,
      });
    }
  };
  context = vm.createContext({
    self,
    indexedDB: indexedDb.api,
    caches: storage,
    fetch: fakeFetch,
    importScripts,
    URL,
    Request,
    Response,
    Headers,
    crypto: webcrypto,
    Uint8Array,
    Buffer,
    console,
  });

  vm.runInContext(readFileSync(workerPath, 'utf8'), context, {
    filename: 'apps/web/dist/client/sw.js',
  });

  async function dispatch(type, fields = {}) {
    const listeners = eventListeners.get(type) ?? [];
    if (listeners.length !== 1) {
      throw new Error(
        `Expected one ${type} handler, found ${listeners.length}.`,
      );
    }
    const waits = [];
    let responsePromise = null;
    const event = {
      ...fields,
      waitUntil(promise) {
        waits.push(Promise.resolve(promise));
      },
      respondWith(promise) {
        responsePromise = Promise.resolve(promise);
      },
    };
    await listeners[0](event);
    if (waits.length > 0) await Promise.all(waits);
    if (responsePromise) return responsePromise;
    return undefined;
  }

  function addClient() {
    const client = {
      messages: workerMessages,
      postMessage(message) {
        workerMessages.push(message);
      },
    };
    clients.push(client);
    return client;
  }

  return {
    storage,
    indexedDb,
    clients,
    fetchCalls,
    workerMessages,
    controls,
    importedWorkerScripts,
    dispatch,
    addClient,
    setOffline(value) {
      isOffline = value;
    },
    setPutFailure(predicate) {
      storage.putFailure = predicate;
    },
  };
}

async function install(worker) {
  await worker.dispatch('install');
}

async function seedCache(storage, name, url, body) {
  const cache = await storage.open(name);
  await cache.put(url, new Response(body));
}

function currentCacheNames(buildId) {
  return [
    `itools-precache-${buildId}`,
    `itools-runtime-${buildId}`,
    `itools-engines-${buildId}`,
  ];
}

async function assertCompleteCacheSet(worker, manifest, buildId) {
  const [precacheName, runtimeName, enginesName] = currentCacheNames(buildId);
  const names = await worker.storage.keys();
  for (const name of [precacheName, runtimeName, enginesName]) {
    if (!names.includes(name)) throw new Error(`缺少缓存桶 ${name}`);
  }

  const precache = await worker.storage.open(precacheName);
  const manifestResponse = await precache.match(`${origin}/sw-manifest.json`);
  const markerResponse = await precache.match(
    `${origin}/__itools_cache_complete__`,
  );
  if (!manifestResponse || !markerResponse)
    throw new Error('缺少缓存 manifest 或完整标记');
  const cachedManifest = await manifestResponse.json();
  const marker = await markerResponse.json();
  if (
    cachedManifest.buildId !== buildId ||
    marker.buildId !== buildId ||
    marker.complete !== true
  ) {
    throw new Error('缓存 manifest 或完整标记的 buildId/状态不匹配');
  }

  for (const asset of manifest.assets) {
    const cacheName = asset.cache === 'engines' ? enginesName : precacheName;
    const cached = await worker.storage
      .open(cacheName)
      .then((cache) => cache.match(new URL(asset.url, origin)));
    if (!cached) throw new Error(`构建资产未预缓存：${asset.url}`);
    const bytes = Buffer.from(await cached.arrayBuffer());
    if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) {
      throw new Error(`缓存资产哈希或字节数不符：${asset.url}`);
    }
  }

  for (const path of ['/zh-CN', '/en']) {
    const home = await precache.match(new URL(path, origin));
    if (
      !home ||
      !(home.headers.get('content-type') ?? '').includes('text/html')
    ) {
      throw new Error(`缺少离线首页 HTML：${path}`);
    }
  }
}

async function verifyStaticBuild(manifest) {
  check(
    'manifest schemaVersion 为 1',
    manifest.schemaVersion === 1,
    `schemaVersion=${manifest.schemaVersion}`,
  );
  check(
    'manifest buildId 存在且不是模板值',
    typeof manifest.buildId === 'string' &&
      manifest.buildId.length > 0 &&
      !manifest.buildId.includes('__'),
    `buildId=${manifest.buildId}`,
  );
  check(
    'manifest assets 是非空数组',
    Array.isArray(manifest.assets) && manifest.assets.length > 0,
  );

  const seen = new Set();
  for (const asset of manifest.assets) {
    const duplicate = seen.has(asset.url);
    seen.add(asset.url);
    check(
      `manifest URL 唯一 ${asset.url}`,
      !duplicate,
      duplicate ? 'URL 重复' : '',
    );
    try {
      const localPath = assetPath(asset.url);
      const exists = existsSync(localPath) && statSync(localPath).isFile();
      check(
        `构建资产存在 ${asset.url}`,
        exists,
        exists ? '' : relative(clientRoot, localPath),
      );
      if (!exists) continue;

      const bytes = readFileSync(localPath);
      check(
        `构建资产字节数 ${asset.url}`,
        bytes.byteLength === asset.bytes,
        `manifest=${asset.bytes}, file=${bytes.byteLength}`,
      );
      check(
        `构建资产 SHA-256 ${asset.url}`,
        sha256(bytes) === asset.sha256,
        `expected=${asset.sha256}, actual=${sha256(bytes)}`,
      );
      check(
        `缓存桶合法 ${asset.url}`,
        asset.cache === 'precache' || asset.cache === 'engines',
        `cache=${asset.cache}`,
      );
    } catch (error) {
      check(`构建资产路径合法 ${asset.url}`, false, error.message);
    }
  }

  const indexHtml = readFileSync(indexPath, 'utf8');
  const scriptUrl = indexHtml.match(/<script\b[^>]*\bsrc="([^"]+\.js)"/i)?.[1];
  const stylesheetUrl = indexHtml.match(
    /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+\.css)"/i,
  )?.[1];
  const listedUrls = new Set(manifest.assets.map((asset) => asset.url));
  check(
    'index.html 引用主 JavaScript',
    Boolean(scriptUrl),
    scriptUrl ?? 'script src 缺失',
  );
  check(
    'manifest 包含主 JavaScript',
    Boolean(scriptUrl && listedUrls.has(scriptUrl)),
    scriptUrl ?? '主 JS 未从 index.html 解析',
  );
  check(
    'index.html 引用 CSS',
    Boolean(stylesheetUrl),
    stylesheetUrl ?? 'stylesheet href 缺失',
  );
  check(
    'manifest 包含主 CSS',
    Boolean(stylesheetUrl && listedUrls.has(stylesheetUrl)),
    stylesheetUrl ?? '主 CSS 未从 index.html 解析',
  );

  const webManifest = JSON.parse(readFileSync(webManifestPath, 'utf8'));
  const requiredUrls = [
    '/manifest.webmanifest',
    ...webManifest.icons
      .filter((icon) => icon.sizes === '192x192' || icon.sizes === '512x512')
      .map((icon) => icon.src),
  ];
  for (const requiredUrl of requiredUrls) {
    check(
      `manifest 包含 PWA 资源 ${requiredUrl}`,
      listedUrls.has(requiredUrl),
      '资源未列入 sw-manifest.json',
    );
  }

  const fontAssets = manifest.assets.filter((asset) =>
    /\.(?:woff2?|ttf|otf)$/i.test(new URL(asset.url, origin).pathname),
  );
  check(
    '字体文件未加入预缓存清单',
    fontAssets.length === 0,
    fontAssets.map((asset) => asset.url).join(', '),
  );

  const workerSource = readFileSync(workerPath, 'utf8');
  const importCall = workerSource.match(/\bimportScripts\s*\(([^)]*)\)/s);
  const importedPaths = importCall
    ? [...importCall[1].matchAll(/(['"])([^'"]+)\1/g)].map(
        (match) => new URL(match[2], origin).pathname,
      )
    : [];
  const expectedWorkerPaths = workerParts.map((part) => `/${part}`);
  check(
    'Service Worker entry imports offline/core scripts',
    expectedWorkerPaths.every((path) => importedPaths.includes(path)) &&
      importedPaths.length === expectedWorkerPaths.length,
    `imports=${importedPaths.join(', ')}`,
  );

  const workerPartSources = new Map(
    workerParts.map((part) => [
      part,
      readFileSync(resolve(clientRoot, part), 'utf8'),
    ]),
  );
  for (const part of workerParts) {
    check(`构建产物包含 ${part}`, workerPartSources.get(part).length > 0);
    check(
      `${part} 未泄漏 buildId 模板`,
      !workerPartSources.get(part).includes('__ITOOLS_BUILD_ID__'),
    );
    check(
      `manifest 不预缓存 /${part}`,
      !listedUrls.has(`/${part}`),
      'Service Worker 脚本应保持 network-only',
    );
  }

  const coreSource = workerPartSources.get('sw-core.js');
  const offlineSource = workerPartSources.get('sw-offline.js');
  const workerBuildId = coreSource.match(
    /const BUILD_ID = (["'])([^"']+)\1;/,
  )?.[2];
  check(
    'Service Worker core buildId 与 manifest 一致',
    workerBuildId === manifest.buildId,
    `worker=${workerBuildId}, manifest=${manifest.buildId}`,
  );
  check(
    'Service Worker entry/offline 部分复用 core buildId',
    !/\bconst\s+BUILD_ID\b/.test(workerSource) &&
      !/\bconst\s+BUILD_ID\b/.test(offlineSource),
    'buildId 应由 sw-core.js 单点定义',
  );
  for (const path of [
    '/api',
    '/sw.js',
    '/sw-core.js',
    '/sw-offline.js',
    '/sw-manifest.json',
  ]) {
    check(
      `offline worker 将 ${path} 列为 network-only`,
      offlineSource.includes(`'${path}'`) ||
        offlineSource.includes(`"${path}"`),
      'network-only 路由缺失',
    );
  }
  check(
    'index.html buildId 与 manifest 一致',
    indexHtml.includes(`name="itools-build-id" content="${manifest.buildId}"`),
    `buildId=${manifest.buildId}`,
  );

  return { workerBuildId };
}

async function runBehaviorChecks(manifest, buildId) {
  const goodWorker = createWorker(manifest);
  goodWorker.addClient();
  check(
    'Node VM importScripts 在同一上下文加载两个子 worker',
    workerParts.every((part) =>
      goodWorker.importedWorkerScripts.includes(`/${part}`),
    ) && goodWorker.importedWorkerScripts.length === workerParts.length,
    `imports=${goodWorker.importedWorkerScripts.join(', ')}`,
  );
  await install(goodWorker);
  await assertCompleteCacheSet(goodWorker, manifest, buildId);
  check(
    '完整安装建立三个 buildId 缓存桶并校验全部资产及双语首页',
    true,
    `${manifest.assets.length} 个构建资产、2 个首页`,
  );
  check(
    '完整安装通知 update-ready',
    goodWorker.workerMessages.some(
      (message) =>
        message.type === 'update-ready' && message.buildId === buildId,
    ),
  );

  check(
    '安装完成前不会自动 skipWaiting',
    goodWorker.controls.skipWaitingCalls === 0,
  );
  await goodWorker.dispatch('message', { data: { type: 'unknown-message' } });
  check('无关消息不会 skipWaiting', goodWorker.controls.skipWaitingCalls === 0);
  await goodWorker.dispatch('message', { data: { type: 'apply-update' } });
  check(
    '收到 apply-update 确认后才调用 skipWaiting',
    goodWorker.controls.skipWaitingCalls === 1,
  );

  await seedCache(
    goodWorker.storage,
    'itools-precache-old',
    `${origin}/old-entry`,
    'old',
  );
  await seedCache(
    goodWorker.storage,
    'itools-runtime-old',
    `${origin}/old-runtime`,
    'old',
  );
  await seedCache(
    goodWorker.storage,
    'unrelated-cache',
    `${origin}/keep-entry`,
    'keep',
  );
  await goodWorker.dispatch('activate');
  const activatedNames = await goodWorker.storage.keys();
  const expectedCurrent = currentCacheNames(buildId).sort();
  check(
    '激活删除旧 itools 缓存并保留无关缓存',
    expectedCurrent.every((name) => activatedNames.includes(name)) &&
      !activatedNames.some(
        (name) =>
          name === 'itools-precache-old' || name === 'itools-runtime-old',
      ) &&
      activatedNames.includes('unrelated-cache'),
    `caches=${activatedNames.join(', ')}`,
  );
  check('激活时 claim 当前客户端', goodWorker.controls.claimCalls === 1);

  const beforeApi = await goodWorker.storage.snapshot();
  const networkOnlyRequests = [
    { path: '/api/tasks', method: 'POST' },
    { path: '/sw.js', method: 'GET' },
    { path: '/sw-core.js', method: 'GET' },
    { path: '/sw-offline.js', method: 'GET' },
    { path: '/sw-manifest.json', method: 'GET' },
  ];
  const networkOnlyResponses = await Promise.all(
    networkOnlyRequests.map(({ path, method }) =>
      goodWorker.dispatch('fetch', {
        request: { url: `${origin}${path}`, method, mode: 'cors' },
      }),
    ),
  );
  const afterApi = await goodWorker.storage.snapshot();
  check(
    'API、三份 SW 脚本及 manifest 均 network-only 且不写入 Cache Storage',
    networkOnlyResponses.every((response) => response?.status === 200) &&
      networkOnlyRequests.every(({ path, method }) =>
        goodWorker.fetchCalls.some(
          (call) => call.url === `${origin}${path}` && call.method === method,
        ),
      ) &&
      JSON.stringify(beforeApi) === JSON.stringify(afterApi),
    `statuses=${networkOnlyResponses.map((response) => response?.status).join(',')}`,
  );

  goodWorker.setOffline(true);
  const offlineCases = [
    { path: '/zh-CN', expected: 'SERVER HOME zh-CN', status: 200 },
    { path: '/en', expected: 'SERVER HOME en', status: 200 },
    { path: '/zh-CN/tasks', expected: '任务页离线不可用', status: 503 },
    {
      path: '/en/admin',
      expected: 'Admin is unavailable offline',
      status: 503,
    },
    {
      path: '/zh-CN/text/not-cached-tool',
      expected: '工具离线不可用',
      status: 503,
    },
  ];
  let offlineCasesPassed = true;
  const offlineDetails = [];
  for (const item of offlineCases) {
    const response = await goodWorker.dispatch('fetch', {
      request: {
        url: `${origin}${item.path}`,
        method: 'GET',
        mode: 'navigate',
      },
    });
    const body = await response?.text();
    const correct =
      response?.status === item.status && body?.includes(item.expected);
    offlineCasesPassed &&= Boolean(correct);
    offlineDetails.push(
      `${item.path}:${correct ? 'ok' : `status=${response?.status}`}`,
    );
  }
  check(
    '离线首页、tasks、admin 与未缓存工具导航兜底',
    offlineCasesPassed,
    offlineDetails.join(', '),
  );

  await verifyRepairAfterMissingEntry(manifest, buildId);
  await verifyRepairAfterMissingMarker(manifest, buildId);
  await verifyRepairRollback(manifest, buildId);

  check(
    'Service Worker install/repair 全程不访问 IndexedDB',
    goodWorker.indexedDb.state.calls.length === 0 &&
      JSON.stringify(goodWorker.indexedDb.state.records) ===
        JSON.stringify(['preserve-me']),
    `IndexedDB calls=${goodWorker.indexedDb.state.calls.length}`,
  );
}

async function verifyFailedInstallPreservesPreviousCache(manifest, buildId) {
  const failureAsset = manifest.assets[0];
  const worker = createWorker(manifest, { failAsset: failureAsset.url });
  worker.addClient();
  await seedCache(
    worker.storage,
    'itools-precache-previous-build',
    `${origin}/previous`,
    'keep-previous',
  );

  let installFailed = false;
  try {
    await install(worker);
  } catch {
    installFailed = true;
  }
  const names = await worker.storage.keys();
  const previousResponse = await worker.storage
    .open('itools-precache-previous-build')
    .then((cache) => cache.match(`${origin}/previous`));
  const previousBody = previousResponse ? await previousResponse.text() : '';
  const currentNames = currentCacheNames(buildId);
  check(
    '安装下载失败时保留旧缓存且清理未完成的新版本缓存',
    installFailed &&
      previousBody === 'keep-previous' &&
      worker.indexedDb.state.calls.length === 0 &&
      worker.indexedDb.state.records[0] === 'preserve-me' &&
      !currentNames.some((name) => names.includes(name)),
    `failed=${installFailed}, IndexedDB calls=${worker.indexedDb.state.calls.length}, caches=${names.join(', ')}`,
  );
  check(
    '失败安装通知 update-failed',
    worker.workerMessages.some(
      (message) =>
        message.type === 'update-failed' && message.buildId === buildId,
    ),
  );
}

async function verifyRepairAfterMissingEntry(manifest, buildId) {
  const worker = createWorker(manifest);
  worker.addClient();
  await install(worker);
  const asset = manifest.assets[0];
  const cacheName =
    asset.cache === 'engines'
      ? `itools-engines-${buildId}`
      : `itools-precache-${buildId}`;
  await worker.storage
    .open(cacheName)
    .then((cache) => cache.delete(new URL(asset.url, origin)));

  await worker.dispatch('message', { data: { type: 'repair-install' } });
  const complete = await assertCompleteCacheSet(worker, manifest, buildId).then(
    () => true,
    () => false,
  );
  const names = await worker.storage.keys();
  check(
    '当前 precache 缺少资产时 repair-install 可恢复完整缓存',
    complete &&
      worker.workerMessages.some(
        (message) =>
          message.type === 'repair-complete' && message.buildId === buildId,
      ) &&
      names.length === 3,
    `caches=${names.join(', ')}`,
  );
  check(
    '缺少资产的修复不触碰 IndexedDB',
    worker.indexedDb.state.calls.length === 0 &&
      worker.indexedDb.state.records[0] === 'preserve-me',
    `IndexedDB calls=${worker.indexedDb.state.calls.length}`,
  );
}

async function verifyRepairAfterMissingMarker(manifest, buildId) {
  const worker = createWorker(manifest);
  worker.addClient();
  await install(worker);
  const precache = await worker.storage.open(`itools-precache-${buildId}`);
  await precache.delete(`${origin}/__itools_cache_complete__`);

  await worker.dispatch('message', { data: { type: 'repair-install' } });
  const complete = await assertCompleteCacheSet(worker, manifest, buildId).then(
    () => true,
    () => false,
  );
  const names = await worker.storage.keys();
  check(
    '当前 precache 缺少完整标记时 repair-install 可恢复完整缓存',
    complete &&
      worker.workerMessages.some(
        (message) =>
          message.type === 'repair-complete' && message.buildId === buildId,
      ) &&
      names.length === 3,
    `caches=${names.join(', ')}`,
  );
}

async function verifyRepairRollback(manifest, buildId) {
  const worker = createWorker(manifest);
  worker.addClient();
  await install(worker);
  const before = await worker.storage.snapshot();
  const currentPrecache = `itools-precache-${buildId}`;
  worker.setPutFailure((name) => name === currentPrecache);

  await worker.dispatch('message', { data: { type: 'repair-install' } });
  const after = await worker.storage.snapshot();
  const names = await worker.storage.keys();
  check(
    '修复交换失败时恢复原缓存且移除 staging/backup 缓存',
    JSON.stringify(before) === JSON.stringify(after) &&
      names.length === 3 &&
      names.every((name) => currentCacheNames(buildId).includes(name)) &&
      worker.workerMessages.some(
        (message) =>
          message.type === 'repair-failed' && message.buildId === buildId,
      ),
    `caches=${names.join(', ')}`,
  );
  check(
    '修复失败回滚后 IndexedDB 状态保持不变',
    worker.indexedDb.state.calls.length === 0 &&
      worker.indexedDb.state.records[0] === 'preserve-me',
    `IndexedDB calls=${worker.indexedDb.state.calls.length}`,
  );
}

async function main() {
  let manifest;
  let buildId;
  try {
    if (!existsSync(manifestPath))
      throw new Error(
        `缺少构建产物：${relative(repositoryRoot, manifestPath)}`,
      );
    if (!existsSync(workerPath))
      throw new Error(`缺少构建产物：${relative(repositoryRoot, workerPath)}`);
    if (!existsSync(indexPath))
      throw new Error(`缺少构建产物：${relative(repositoryRoot, indexPath)}`);
    if (!existsSync(webManifestPath))
      throw new Error(
        `缺少构建产物：${relative(repositoryRoot, webManifestPath)}`,
      );

    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const staticInfo = await verifyStaticBuild(manifest);
    buildId = staticInfo.workerBuildId;
    await verifyFailedInstallPreservesPreviousCache(manifest, buildId);
    await runBehaviorChecks(manifest, buildId);
  } catch (error) {
    check(
      '验收脚本执行',
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  for (const entry of checks) {
    console.log(
      `${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.ok ? '' : `  (${entry.detail})`}`,
    );
  }
  const passed = checks.filter((entry) => entry.ok).length;
  const failed = checks.length - passed;
  if (failed > 0) {
    console.error(`\n${failed}/${checks.length} 项失败`);
    process.exitCode = 1;
  } else {
    console.log(`\n全部 ${passed} 项通过`);
  }
}

await main();
