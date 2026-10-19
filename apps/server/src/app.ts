import fastifyStatic from '@fastify/static';
import type { SsrRenderer } from '@itools/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { injectHtml } from './html.js';
import { buildRobotsTxt } from './robots.js';
import { buildSitemap } from './sitemap.js';

export interface StaticRoots {
  readonly assets: string;
  readonly brandIcons: string;
}

export interface CreateAppOptions {
  readonly renderer: SsrRenderer;
  readonly siteOrigin: string;
  getTemplate(url: string): Promise<string>;
  /** 开发环境注入 Vite middleware；测试与生产不提供。 */
  registerDevMiddleware?(app: FastifyInstance): Promise<void>;
  staticRoots?: StaticRoots;
}

const HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const NOT_FOUND_CACHE_CONTROL = 'no-store';
const METADATA_CACHE_CONTROL = 'public, max-age=300';
const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const BRAND_ICON_CACHE_CONTROL = 'public, max-age=86400';

export async function createApp(
  options: CreateAppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  if (options.registerDevMiddleware !== undefined) {
    await options.registerDevMiddleware(app);
  }

  if (options.staticRoots !== undefined) {
    registerStatic(app, options.staticRoots);
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

/** 拆出路径与查询串，保留原始编码，不做 URL 归一化。 */
function splitRequestUrl(url: string): { pathname: string; search: string } {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return { pathname: url, search: '' };
  }
  return { pathname: url.slice(0, queryIndex), search: url.slice(queryIndex) };
}
