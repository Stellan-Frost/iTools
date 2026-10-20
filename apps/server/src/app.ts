import fastifyStatic from '@fastify/static';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SsrRenderer } from '@itools/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAdmin } from './admin/register.js';
import type { AdminRegistrationDeps } from './admin/register.js';
import { registerOpenApi } from './api/openapi.js';
import type { ApiOptions } from './api/options.js';
import { registerApi } from './api/routes.js';
import { injectHtml } from './html.js';
import { createRequestLogger } from './logging/request-log.js';
import type { RequestLoggerOptions } from './logging/request-log.js';
import { buildRobotsTxt } from './robots.js';
import { createSecurityHeadersHook } from './security/headers.js';
import { buildSitemap } from './sitemap.js';

export type { ApiOptions } from './api/options.js';
export type { AdminRegistrationDeps } from './admin/register.js';

export interface StaticRoots {
  readonly assets: string;
  readonly brandIcons: string;
  /** 生产客户端根目录；只从中暴露固定的 PWA 文件。 */
  readonly pwa?: string;
}

export interface CreateAppOptions {
  readonly renderer: SsrRenderer;
  readonly siteOrigin: string;
  getTemplate(url: string): Promise<string>;
  /** 开发环境注入 Vite middleware；测试与生产不提供。 */
  registerDevMiddleware?(app: FastifyInstance): Promise<void>;
  staticRoots?: StaticRoots;
  /** 只读 API 依赖；缺省时端点仍存在，但目录相关请求返回 503。 */
  readonly api?: ApiOptions;
  /** 管理后台依赖；缺省时管理端点整体不存在（返回 404）。 */
  readonly admin?: AdminRegistrationDeps;
  /** 生产环境启用严格 CSP；缺省按开发策略。 */
  readonly isProduction?: boolean;
  /** 提供时每个请求写一行脱敏日志。 */
  readonly logRequests?: RequestLoggerOptions;
}

const HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const NOT_FOUND_CACHE_CONTROL = 'no-store';
const METADATA_CACHE_CONTROL = 'public, max-age=300';
const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const BRAND_ICON_CACHE_CONTROL = 'public, max-age=86400';
const PWA_CACHE_CONTROL = 'no-cache';

const PWA_FILES = [
  {
    url: '/sw.js',
    file: 'sw.js',
    contentType: 'application/javascript',
    serviceWorker: true,
  },
  {
    url: '/sw-offline.js',
    file: 'sw-offline.js',
    contentType: 'application/javascript',
    serviceWorker: false,
  },
  {
    url: '/sw-core.js',
    file: 'sw-core.js',
    contentType: 'application/javascript',
    serviceWorker: false,
  },
  {
    url: '/manifest.webmanifest',
    file: 'manifest.webmanifest',
    contentType: 'application/manifest+json; charset=utf-8',
    serviceWorker: false,
  },
  {
    url: '/sw-manifest.json',
    file: 'sw-manifest.json',
    contentType: 'application/json; charset=utf-8',
    serviceWorker: false,
  },
] as const;

export async function createApp(
  options: CreateAppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // 安全头覆盖全部响应（HTML / API / 404 / 静态资源）。
  app.addHook(
    'onSend',
    createSecurityHeadersHook({
      isProduction: options.isProduction === true,
      siteOrigin: options.siteOrigin,
    }),
  );

  if (options.logRequests !== undefined) {
    app.addHook('onResponse', createRequestLogger(options.logRequests));
  }

  if (options.registerDevMiddleware !== undefined) {
    await options.registerDevMiddleware(app);
  }

  if (options.staticRoots !== undefined) {
    registerStatic(app, options.staticRoots);
    if (options.staticRoots.pwa !== undefined) {
      registerPwa(app, options.staticRoots.pwa);
    }
  }

  app.get('/', async (_request, reply) =>
    reply.redirect(`/${options.renderer.defaultLocale}`, 302),
  );

  app.get('/sitemap.xml', async (_request, reply) => {
    const urls = await options.renderer.listSitemapUrls(options.siteOrigin);
    return reply
      .type('application/xml; charset=utf-8')
      .header('cache-control', METADATA_CACHE_CONTROL)
      .send(buildSitemap(urls));
  });

  app.get('/robots.txt', async (_request, reply) =>
    reply
      .type('text/plain; charset=utf-8')
      .header('cache-control', METADATA_CACHE_CONTROL)
      .send(buildRobotsTxt(options.siteOrigin)),
  );

  // API 必须先于 404 处理器注册，避免被 SSR 通配逻辑吞掉。
  // 未注入依赖时仍提供端点，由路由返回 503 明确表达不可用。
  await registerOpenApi(app);
  registerApi(app, options.api ?? {});
  if (options.admin !== undefined) {
    registerAdmin(app, options.admin);
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply
        .code(404)
        .type('text/plain; charset=utf-8')
        .header('cache-control', NOT_FOUND_CACHE_CONTROL)
        .send('Not Found');
    }

    const { pathname, search } = splitRequestUrl(request.url);
    const withoutTrailingSlash = pathname.replace(/\/+$/, '');

    if (withoutTrailingSlash !== pathname && withoutTrailingSlash !== '') {
      return reply.redirect(`${withoutTrailingSlash}${search}`, 308);
    }

    const url = `${pathname}${search}`;
    const [template, result] = await Promise.all([
      options.getTemplate(url),
      options.renderer.render({ url, siteOrigin: options.siteOrigin }),
    ]);
    const html = injectHtml(template, result);

    return reply
      .code(result.statusCode)
      .type('text/html; charset=utf-8')
      .header(
        'cache-control',
        result.statusCode === 200
          ? HTML_CACHE_CONTROL
          : NOT_FOUND_CACHE_CONTROL,
      )
      .send(html);
  });

  return app;
}

function registerStatic(app: FastifyInstance, roots: StaticRoots): void {
  app.register(fastifyStatic, {
    root: roots.assets,
    prefix: '/assets/',
    decorateReply: false,
    cacheControl: false,
    setHeaders: (reply) => reply.header('cache-control', ASSET_CACHE_CONTROL),
  });

  app.register(fastifyStatic, {
    root: roots.brandIcons,
    prefix: '/brand-icon/',
    decorateReply: false,
    cacheControl: false,
    setHeaders: (reply) =>
      reply.header('cache-control', BRAND_ICON_CACHE_CONTROL),
  });
}

function registerPwa(app: FastifyInstance, root: string): void {
  for (const asset of PWA_FILES) {
    app.get(asset.url, async (_request, reply) => {
      let content: Buffer;
      try {
        content = await readFile(path.join(root, asset.file));
      } catch (error: unknown) {
        if (isMissingFileError(error)) {
          return reply
            .code(404)
            .type('text/plain; charset=utf-8')
            .header('cache-control', NOT_FOUND_CACHE_CONTROL)
            .send('Not Found');
        }
        throw error;
      }

      reply.type(asset.contentType).header('cache-control', PWA_CACHE_CONTROL);
      if (asset.serviceWorker) {
        reply.header('service-worker-allowed', '/');
      }
      return reply.send(content);
    });
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

/** 拆出路径与查询串，保留原始编码，不做 URL 归一化。 */
function splitRequestUrl(url: string): { pathname: string; search: string } {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return { pathname: url, search: '' };
  }
  return { pathname: url.slice(0, queryIndex), search: url.slice(queryIndex) };
}
