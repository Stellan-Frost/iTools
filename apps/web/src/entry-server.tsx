import { renderToString } from 'react-dom/server';
import { createI18n, listSitemapPaths } from '@itools/app-core';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type SsrRenderRequest,
  type SsrRenderResult,
} from '@itools/contracts';
import { App } from './App.js';
import { parseAppPath } from './app/route.js';
import { buildHeadHtml } from './app/seo.js';

export const supportedLocales: readonly Locale[] = LOCALES;
export const defaultLocale: Locale = DEFAULT_LOCALE;

function pathnameOf(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

export async function render(
  request: SsrRenderRequest,
): Promise<SsrRenderResult> {
  const { locale, route } = parseAppPath(pathnameOf(request.url));
  const i18n = createI18n(locale);
  const translate = i18n.getFixedT(locale, 'common');

  const headHtml = buildHeadHtml({
    locale,
    route,
    siteOrigin: request.siteOrigin,
    t: (key) => translate(key),
  });

  const appHtml = renderToString(
    <App initialLocale={locale} initialRoute={route} />,
  );

  return {
    statusCode: route.page === 'not-found' ? 404 : 200,
    lang: locale,
    headHtml,
    appHtml,
  };
}

export async function listSitemapUrls(
  siteOrigin: string,
): Promise<readonly string[]> {
  const origin = siteOrigin.replace(/\/+$/, '');
  const urls: string[] = [];

  for (const locale of supportedLocales) {
    for (const path of listSitemapPaths(locale)) {
      urls.push(origin + path);
    }
  }

  return urls;
}
