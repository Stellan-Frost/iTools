const BUILD_ID = '__ITOOLS_BUILD_ID__';
const COMPLETE_MARKER = new URL(
  '__itools_cache_complete__',
  self.registration.scope,
);
const REPAIR_BACKUP_MARKER = new URL(
  '__itools_repair_backup_ready__',
  self.registration.scope,
);
const MANIFEST_URL = new URL('sw-manifest.json', self.registration.scope);
const HOME_PATHS = ['/zh-CN', '/en'];

function cacheSet(suffix = '') {
  const version = `${BUILD_ID}${suffix}`;
  return {
    precache: `itools-precache-${version}`,
    runtime: `itools-runtime-${version}`,
    engines: `itools-engines-${version}`,
  };
}

function cacheNames(set) {
  return [set.precache, set.runtime, set.engines];
}

async function deleteCacheSet(set) {
  await Promise.all(cacheNames(set).map((name) => caches.delete(name)));
}

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clients) client.postMessage(message);
  } catch {
    // Notifications must not change whether a complete cache set can activate.
  }
}

async function readBuildManifest(precache) {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok)
    throw new Error('Unable to download the service worker manifest.');

  const manifest = await response.clone().json();
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    manifest.buildId !== BUILD_ID ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error('The service worker manifest does not match this build.');
  }
  await precache.put(MANIFEST_URL, response);
  return manifest;
}

async function hasExpectedIntegrity(response, expectedHash, expectedBytes) {
  if (!self.crypto || !self.crypto.subtle) return false;
  const bytes = await response.clone().arrayBuffer();
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes)
    return false;
  const digest = await self.crypto.subtle.digest('SHA-256', bytes);
  const actualHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return actualHash === expectedHash;
}

async function cacheManifestAsset(asset, precache, engines) {
  if (
    !asset ||
    typeof asset.url !== 'string' ||
    !asset.url.startsWith('/') ||
    asset.url.startsWith('//') ||
    typeof asset.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(asset.sha256) ||
    !Number.isSafeInteger(asset.bytes) ||
    asset.bytes < 0 ||
    (asset.cache !== 'precache' && asset.cache !== 'engines')
  ) {
    throw new Error('The service worker manifest contains an invalid asset.');
  }

  const url = new URL(asset.url, self.registration.scope);
  if (
    url.origin !== self.location.origin ||
    self.__ITOOLS_OFFLINE__.isNetworkOnlyPath(url.pathname) ||
    (!self.__ITOOLS_OFFLINE__.isStaticRequest(url.pathname) &&
      url.pathname !== '/index.html') ||
    /\.(?:woff2?|ttf|otf)$/i.test(url.pathname)
  ) {
    throw new Error('The service worker manifest includes a forbidden asset.');
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (
    !response.ok ||
    !(await hasExpectedIntegrity(response, asset.sha256, asset.bytes))
  ) {
    throw new Error(
      'A service worker asset failed its download or hash check.',
    );
  }
  const cache = asset.cache === 'engines' ? engines : precache;
  await cache.put(url, response);
}

async function cacheHomePages(precache) {
  await Promise.all(
    HOME_PATHS.map(async (path) => {
      const url = new URL(path, self.registration.scope);
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'text/html' },
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('text/html')
      ) {
        throw new Error('Unable to download an offline home page.');
      }
      await precache.put(url, response);
    }),
  );
}

async function populateBuildCaches(set) {
  const precache = await caches.open(set.precache);
  const engines = await caches.open(set.engines);
  await caches.open(set.runtime);
  const manifest = await readBuildManifest(precache);

  const results = await Promise.allSettled(
    manifest.assets.map((asset) =>
      cacheManifestAsset(asset, precache, engines),
    ),
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('The full service worker asset download did not complete.');
  }
  await cacheHomePages(precache);
  await precache.put(
    COMPLETE_MARKER,
    new Response(JSON.stringify({ buildId: BUILD_ID, complete: true })),
  );
}

async function verifyCacheSet(set) {
  const names = await caches.keys();
  if (!cacheNames(set).every((name) => names.includes(name))) return false;

  const precache = await caches.open(set.precache);
  const markerResponse = await precache.match(COMPLETE_MARKER);
  const manifestResponse = await precache.match(MANIFEST_URL);
  if (!markerResponse || !manifestResponse) return false;

  const marker = await markerResponse.json();
  const manifest = await manifestResponse.json();
  if (
    marker.buildId !== BUILD_ID ||
    marker.complete !== true ||
    manifest.buildId !== BUILD_ID ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.assets)
  ) {
    return false;
  }

  const engines = await caches.open(set.engines);
  for (const asset of manifest.assets) {
    const target = asset.cache === 'engines' ? engines : precache;
    const cached = await target.match(
      new URL(asset.url, self.registration.scope),
    );
    if (
      !cached ||
      !(await hasExpectedIntegrity(cached, asset.sha256, asset.bytes))
    )
      return false;
  }
  for (const path of HOME_PATHS) {
    if (!(await precache.match(new URL(path, self.registration.scope))))
      return false;
  }
  return true;
}

async function deleteOldCaches(keepNames) {
  const keep = new Set(keepNames);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith('itools-') && !keep.has(name))
      .map((name) => caches.delete(name)),
  );
}

async function copyCacheSet(
  source,
  destination,
  buckets = ['precache', 'runtime', 'engines'],
) {
  for (const bucket of buckets) {
    const sourceCache = await caches.open(source[bucket]);
    const destinationCache = await caches.open(destination[bucket]);
    for (const request of await sourceCache.keys()) {
      if (request.url === REPAIR_BACKUP_MARKER.href) continue;
      const response = await sourceCache.match(request);
      if (!response) throw new Error('A cache entry could not be copied.');
      await destinationCache.put(request, response);
    }
  }
}

async function repairFallbackNames() {
  const names = await caches.keys();
  const prefix = `itools-precache-${BUILD_ID}-backup-`;
  const backups = [];
  for (const name of names.filter((value) => value.startsWith(prefix))) {
    if (await (await caches.open(name)).match(REPAIR_BACKUP_MARKER)) {
      backups.push(
        ...cacheNames(cacheSet(`-backup-${name.slice(prefix.length)}`)),
      );
    }
  }
  return backups;
}

self.__ITOOLS_CORE__ = {
  precacheName: `itools-precache-${BUILD_ID}`,
  runtimeName: `itools-runtime-${BUILD_ID}`,
  enginesName: `itools-engines-${BUILD_ID}`,
  repairFallbackNames,
};

async function repairInstall() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const current = cacheSet();
  const staging = cacheSet(`-repair-${suffix}`);
  const backup = cacheSet(`-backup-${suffix}`);
  let backupReady = false;
  let swapStarted = false;
  let committed = false;
  let rollbackComplete = false;
  let currentComplete = false;
  let existingBuckets = [];

  try {
    try {
      currentComplete = await verifyCacheSet(current);
    } catch {
      currentComplete = false;
    }
    await populateBuildCaches(staging);
    if (!(await verifyCacheSet(staging))) {
      throw new Error('The staged repair cache set is incomplete.');
    }
    const names = new Set(await caches.keys());
    existingBuckets = ['precache', 'runtime', 'engines'].filter((bucket) =>
      names.has(current[bucket]),
    );
    await copyCacheSet(current, backup, existingBuckets);
    if (currentComplete && !(await verifyCacheSet(backup))) {
      throw new Error('The service worker cache backup is incomplete.');
    }
    await (
      await caches.open(backup.precache)
    ).put(REPAIR_BACKUP_MARKER, new Response('ready'));
    backupReady = true;

    swapStarted = true;
    await deleteCacheSet(current);
    await copyCacheSet(staging, current);
    if (!(await verifyCacheSet(current))) {
      throw new Error('The repaired cache set failed verification.');
    }
    await deleteOldCaches([...cacheNames(current), ...cacheNames(backup)]);
    committed = true;
  } catch (error) {
    if (backupReady && swapStarted && !committed) {
      await deleteCacheSet(current);
      await deleteCacheSet(staging);
      await copyCacheSet(backup, current, existingBuckets);
      if (currentComplete && !(await verifyCacheSet(current))) {
        throw new Error(
          'Repair failed and the previous cache could not be restored.',
          { cause: error },
        );
      }
      rollbackComplete = true;
    }
    throw error;
  } finally {
    await Promise.allSettled(
      cacheNames(staging).map((name) => caches.delete(name)),
    );
    if (committed || !backupReady || !swapStarted || rollbackComplete) {
      await Promise.allSettled(
        cacheNames(backup).map((name) => caches.delete(name)),
      );
    }
  }
}

self.addEventListener('install', (event) => {
  const current = cacheSet();
  event.waitUntil(
    (async () => {
      try {
        await populateBuildCaches(current);
      } catch (error) {
        await Promise.allSettled(
          cacheNames(current).map((name) => caches.delete(name)),
        );
        await notifyClients({ type: 'update-failed', buildId: BUILD_ID });
        throw error;
      }
      await notifyClients({ type: 'update-ready', buildId: BUILD_ID });
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = cacheSet();
      if (!(await verifyCacheSet(current))) {
        throw new Error('The active service worker cache set is incomplete.');
      }
      await deleteOldCaches(cacheNames(current));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const message = event.data;
  if (
    !message ||
    typeof message !== 'object' ||
    typeof message.type !== 'string'
  ) {
    return;
  }
  if (message.type === 'get-build-id') {
    event.ports?.[0]?.postMessage({ buildId: BUILD_ID });
    return;
  }
  if (message.type === 'apply-update') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (message.type === 'repair-install') {
    event.waitUntil(
      repairInstall()
        .then(() =>
          notifyClients({ type: 'repair-complete', buildId: BUILD_ID }),
        )
        .catch(async () => {
          await notifyClients({ type: 'repair-failed', buildId: BUILD_ID });
        }),
    );
  }
});
