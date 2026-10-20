import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import middie from '@fastify/middie';
import type { SsrRenderer } from '@itools/contracts';
import { DEFAULT_LOCALE, LOCALES } from '@itools/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const SITE_ORIGIN = 'https://itools.example';
const TEMPLATE = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  '<head><!--app-head--></head>',
  '<body><!--app-html--></body>',
  '</html>',
].join('');

function createRenderer(onRender: () => void = () => undefined): SsrRenderer {
  return {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    async render() {
      onRender();
      return {
        statusCode: 200,
        lang: 'zh-CN',
        headHtml: '',
        appHtml: '<main>SSR fallback</main>',
      };
    },
    async listSitemapUrls() {
      return [];
    },
  };
}

const openApps: FastifyInstance[] = [];
const tempDirs: string[] = [];

async function createPwaApp(
  root: string,
  renderer = createRenderer(),
): Promise<FastifyInstance> {
  const assets = path.join(root, 'assets');
  const brandIcons = path.join(root, 'brand-icon');
  const pwa = path.join(root, 'pwa');
  await mkdir(assets, { recursive: true });
  await mkdir(brandIcons, { recursive: true });
  await mkdir(pwa, { recursive: true });
  const app = await createApp({
    renderer,
    siteOrigin: SITE_ORIGIN,
    getTemplate: async () => TEMPLATE,
    isProduction: true,
    staticRoots: { assets, brandIcons, pwa },
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('PWA 资源', () => {
  it('从站点根路径提供产物、更新缓存头与生产安全头', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'itools-pwa-'));
    tempDirs.push(root);
    const pwa = path.join(root, 'pwa');
    await mkdir(pwa);
    await writeFile(
      path.join(pwa, 'sw.js'),
      'self.addEventListener("install", () => {});',
    );
    await writeFile(
      path.join(pwa, 'sw-offline.js'),
      'export const offline = true;',
    );
    await writeFile(path.join(pwa, 'sw-core.js'), 'export const core = true;');
    await writeFile(
      path.join(pwa, 'manifest.webmanifest'),
      JSON.stringify({ name: 'iTools', short_name: 'iTools' }),
    );
    await writeFile(
      path.join(pwa, 'sw-manifest.json'),
      JSON.stringify({ buildId: 'test-build', files: [] }),
    );
    const app = await createPwaApp(root);

    const serviceWorker = await app.inject({ method: 'GET', url: '/sw.js' });
    expect(serviceWorker.statusCode).toBe(200);
    expect(serviceWorker.headers['content-type']).toBe(
      'application/javascript',
    );
    expect(serviceWorker.headers['cache-control']).toBe('no-cache');
    expect(serviceWorker.headers['service-worker-allowed']).toBe('/');
    expect(serviceWorker.headers['content-security-policy']).toContain(
      "worker-src 'self' blob:",
    );
    expect(serviceWorker.headers['x-content-type-options']).toBe('nosniff');
    expect(serviceWorker.body).toContain('install');

    for (const url of ['/sw-offline.js', '/sw-core.js']) {
      const script = await app.inject({ method: 'GET', url });
      expect(script.statusCode).toBe(200);
      expect(script.headers['content-type']).toBe('application/javascript');
      expect(script.headers['cache-control']).toBe('no-cache');
      expect(script.headers['content-security-policy']).toContain(
        "script-src 'self'",
      );
      expect(script.headers['x-content-type-options']).toBe('nosniff');
    }

    const manifest = await app.inject({
      method: 'GET',
      url: '/manifest.webmanifest',
    });
    expect(manifest.statusCode).toBe(200);
    expect(manifest.headers['content-type']).toBe(
      'application/manifest+json; charset=utf-8',
    );
    expect(manifest.headers['cache-control']).toBe('no-cache');
    expect(manifest.json()).toEqual({ name: 'iTools', short_name: 'iTools' });

    const swManifest = await app.inject({
      method: 'GET',
      url: '/sw-manifest.json',
    });
    expect(swManifest.statusCode).toBe(200);
    expect(swManifest.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(swManifest.headers['cache-control']).toBe('no-cache');
    expect(swManifest.json()).toEqual({ buildId: 'test-build', files: [] });
  });

  it('缺少产物时返回 no-store 404，且不进入 SSR', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'itools-pwa-missing-'));
    tempDirs.push(root);
    let renderCalls = 0;
    const app = await createPwaApp(
      root,
      createRenderer(() => renderCalls++),
    );

    for (const url of [
      '/sw.js',
      '/sw-offline.js',
      '/sw-core.js',
      '/manifest.webmanifest',
      '/sw-manifest.json',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['content-type']).toBe(
        'text/plain; charset=utf-8',
      );
      expect(response.body).toBe('Not Found');
    }
    expect(renderCalls).toBe(0);
  });

  it('没有生产 PWA 根目录时保留开发 middleware 处理', async () => {
    const app = await createApp({
      renderer: createRenderer(),
      siteOrigin: SITE_ORIGIN,
      getTemplate: async () => TEMPLATE,
      registerDevMiddleware: async (instance) => {
        instance.register(middie);
        instance.after(() => {
          instance.use((request, response, next) => {
            if (request.url !== '/sw.js') {
              next();
              return;
            }
            response.statusCode = 200;
            response.setHeader('content-type', 'application/javascript');
            response.end('/* vite public asset */');
          });
        });
      },
    });
    openApps.push(app);

    const response = await app.inject({ method: 'GET', url: '/sw.js' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/javascript');
    expect(response.body).toBe('/* vite public asset */');
  });
});
