import { expect, test, type Page } from '@playwright/test';

const ASSET_DATABASE = 'itools-assets';
const BOUNDARY_KEY = 'playwright-boundary-sentinel';
const LEGACY_CACHE = 'itools-precache-playwright-old';

test('real service worker installs, serves the cached home offline, and preserves IndexedDB', async ({
  page,
  context,
}) => {
  await page.goto('/sw.js');
  await seedAssetDatabase(page);
  await seedLegacyCache(page);

  await page.goto('/zh-CN');
  const registration = await page.evaluate(async () => {
    const active = await navigator.serviceWorker.ready;
    return {
      scope: active.scope,
      scriptUrl: active.active?.scriptURL ?? '',
    };
  });
  expect(registration.scope).toBe('http://127.0.0.1:5201/');
  expect(registration.scriptUrl).toContain('/sw.js');

  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
  const cacheState = await page.evaluate(async () => {
    const manifestResponse = await fetch('/sw-manifest.json');
    const manifest: unknown = await manifestResponse.json();
    if (
      typeof manifest !== 'object' ||
      manifest === null ||
      !('buildId' in manifest) ||
      typeof manifest.buildId !== 'string'
    ) {
      throw new Error('The service worker manifest has no build id.');
    }
    const names = await caches.keys();
    const precache = await caches.open(`itools-precache-${manifest.buildId}`);
    const home = await precache.match('/zh-CN');
    return { names, hasCachedHome: home !== undefined };
  });
  expect(cacheState.names).not.toContain(LEGACY_CACHE);
  expect(cacheState.hasCachedHome).toBe(true);
  expect(await readBoundaryValue(page)).toBe('retained');

  await context.setOffline(true);
  const offlineResponse = await page.goto('/zh-CN');
  expect(offlineResponse?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: '把日常小工具，放在一个清楚的地方。' }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  expect(await readBoundaryValue(page)).toBe('retained');
  await context.setOffline(false);
});

async function seedAssetDatabase(page: Page): Promise<void> {
  await page.evaluate(
    ({ databaseName, boundaryKey }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          database.createObjectStore('assets', { keyPath: 'assetId' });
          database.createObjectStore('blobs', { keyPath: 'assetId' });
          database.createObjectStore('references', {
            keyPath: ['assetId', 'taskId'],
          });
          database.createObjectStore('tasks', { keyPath: 'taskId' });
          database.createObjectStore('meta', { keyPath: 'key' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('meta', 'readwrite');
          transaction.objectStore('meta').put({
            key: boundaryKey,
            value: 'retained',
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    { databaseName: ASSET_DATABASE, boundaryKey: BOUNDARY_KEY },
  );
}

async function seedLegacyCache(page: Page): Promise<void> {
  await page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName);
    await cache.put('/old-cache-entry', new Response('old build data'));
  }, LEGACY_CACHE);
}

async function readBoundaryValue(page: Page): Promise<string | undefined> {
  return page.evaluate(
    ({ databaseName, boundaryKey }) =>
      new Promise<string | undefined>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('meta', 'readonly');
          const read = transaction.objectStore('meta').get(boundaryKey);
          read.onsuccess = () => {
            const record: unknown = read.result;
            database.close();
            if (
              typeof record === 'object' &&
              record !== null &&
              'value' in record &&
              typeof record.value === 'string'
            ) {
              resolve(record.value);
              return;
            }
            resolve(undefined);
          };
          read.onerror = () => reject(read.error);
        };
      }),
    { databaseName: ASSET_DATABASE, boundaryKey: BOUNDARY_KEY },
  );
}
