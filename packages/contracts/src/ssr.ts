import type { Locale } from './locale.js';

/** 服务端交给渲染器的请求描述；`url` 含路径与查询串。 */
export interface SsrRenderRequest {
  /** 例如 `/en/image/image-inspector?from=search`。 */
  url: string;
  /** 用于 canonical、hreflang 与 sitemap 的绝对来源，例如 `https://itools.wataa.men`。 */
  siteOrigin: string;
}

/**
 * 一次 SSR 渲染的完整结果。
 * `headHtml` 由渲染器生成并负责转义，服务端只做占位符替换；
 * `statusCode` 必须是真实 HTTP 状态，不允许 200 + 页面内 404 文案。
 */
export interface SsrRenderResult {
  statusCode: 200 | 404;
  lang: Locale;
  headHtml: string;
  appHtml: string;
}

/**
 * 服务端唯一依赖的渲染契约。开发环境由 Vite SSR 模块实现，
 * 生产环境由构建产物实现；服务端不得直接依赖 `@itools/web` 源码。
 */
export interface SsrRenderer {
  readonly supportedLocales: readonly Locale[];
  readonly defaultLocale: Locale;
  render(request: SsrRenderRequest): Promise<SsrRenderResult>;
  /** 返回绝对 URL 列表，由服务端包装成 sitemap.xml。 */
  listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
}
