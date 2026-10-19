import { findTool, getCategory } from '@itools/app-core';
import { DEFAULT_LOCALE, type Locale } from '@itools/contracts';
import { buildAppPath, type AppRoute } from './route.js';

export type Translate = (key: string) => string;

export interface HeadHtmlInput {
  locale: Locale;
  route: AppRoute;
  siteOrigin: string;
  t: Translate;
}

interface PageMeta {
  title: string;
  description: string;
  noindex: boolean;
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function normalizeOrigin(siteOrigin: string): string {
  return siteOrigin.replace(/\/+$/, '');
}

function pageMeta(locale: Locale, route: AppRoute, t: Translate): PageMeta {
  const suffix = t('meta.titleSuffix');

  switch (route.page) {
    case 'home':
      return {
        title: t('meta.homeTitle'),
        description: t('meta.homeDescription'),
        noindex: false,
      };
    case 'category': {
      const category = getCategory(route.categoryId);
      if (category) {
        return {
          title: suffix
            ? `${category.name[locale]} · ${suffix}`
            : category.name[locale],
          description: category.description[locale],
          noindex: false,
        };
      }
      break;
    }
    case 'tool': {
      const tool = findTool(route.toolId);
      if (tool) {
        return {
          title: tool.name[locale],
          description: tool.description[locale],
          noindex: false,
        };
      }
      break;
    }
    case 'tasks':
      return {
        title: t('meta.tasksTitle'),
        description: t('meta.tasksDescription'),
        noindex: true,
      };
    case 'admin':
      return {
        title: t('meta.adminTitle'),
        description: t('meta.adminDescription'),
        noindex: true,
      };
    default:
      break;
  }

  return {
    title: t('meta.notFoundTitle'),
    description: t('meta.notFoundDescription'),
    noindex: true,
  };
}

/** 生成 `<head>` 片段；所有文本与属性值均已转义。 */
export function buildHeadHtml({
  locale,
  route,
  siteOrigin,
  t,
}: HeadHtmlInput): string {
  const origin = normalizeOrigin(siteOrigin);
  const meta = pageMeta(locale, route, t);
  const canonicalPath = buildAppPath(locale, route);

  const alternates = [
    { hreflang: 'zh-CN', href: origin + buildAppPath('zh-CN', route) },
    { hreflang: 'en', href: origin + buildAppPath('en', route) },
    {
      hreflang: 'x-default',
      href: origin + buildAppPath(DEFAULT_LOCALE, route),
    },
  ];

  const lines = [
    `<title>${escapeText(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(meta.description)}" />`,
    `<link rel="canonical" href="${escapeAttribute(origin + canonicalPath)}" />`,
    ...alternates.map(
      (alternate) =>
        `<link rel="alternate" hreflang="${escapeAttribute(alternate.hreflang)}" href="${escapeAttribute(alternate.href)}" />`,
    ),
  ];

  if (meta.noindex) {
    lines.push('<meta name="robots" content="noindex" />');
  }

  return lines.join('\n    ');
}
