import {
  findTool,
  findVisibleTool,
  getCategory,
  isCategoryId,
  type CategoryId,
} from '@itools/app-core';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@itools/contracts';

export type AppRoute =
  | { page: 'home' }
  | { page: 'category'; categoryId: CategoryId }
  | { page: 'tool'; toolId: string }
  | { page: 'tasks' }
  | { page: 'admin' }
  | { page: 'not-found' };

const NOT_FOUND_ROUTE: AppRoute = { page: 'not-found' };

function segmentsOf(pathname: string): readonly string[] {
  const path = pathname.split(/[?#]/, 1)[0] ?? '';
  return path.split('/').filter((segment) => segment.length > 0);
}

/**
 * 解析应用内路径，永不抛错。
 * 未知语言回到默认语言并标记 404；分类/工具不存在、停用或分类不匹配同样为 404。
 */
export function parseAppPath(pathname: string): {
  locale: Locale;
  route: AppRoute;
} {
  const segments = segmentsOf(pathname);
  const [localeSegment, ...rest] = segments;

  if (!localeSegment || !isLocale(localeSegment)) {
    return { locale: DEFAULT_LOCALE, route: NOT_FOUND_ROUTE };
  }

  const locale = localeSegment;

  if (rest.length === 0) {
    return { locale, route: { page: 'home' } };
  }

  if (rest.length === 1) {
    const [first] = rest;

    if (first === 'tasks') return { locale, route: { page: 'tasks' } };
    if (first === 'admin') return { locale, route: { page: 'admin' } };
    if (first && isCategoryId(first) && getCategory(first)) {
      return { locale, route: { page: 'category', categoryId: first } };
    }

    return { locale, route: NOT_FOUND_ROUTE };
  }

  if (rest.length === 2) {
    const [categoryId, toolId] = rest;

    if (!categoryId || !toolId) {
      return { locale, route: NOT_FOUND_ROUTE };
    }

    if (!isCategoryId(categoryId) || !getCategory(categoryId)) {
      return { locale, route: NOT_FOUND_ROUTE };
    }

    const tool = findVisibleTool(toolId);

    if (!tool || tool.metadata.category !== categoryId) {
      return { locale, route: NOT_FOUND_ROUTE };
    }

    return { locale, route: { page: 'tool', toolId: tool.metadata.id } };
  }

  return { locale, route: NOT_FOUND_ROUTE };
}

/**
 * 生成规范路径。工具路径包含所属分类；未知或停用工具与 404 回退到该语言首页。
 * 预览工具与已实现工具都生成路径（预览页返回 200 但 noindex）。
 */
export function buildAppPath(locale: Locale, route: AppRoute): string {
  const home = `/${locale}`;

  switch (route.page) {
    case 'home':
      return home;
    case 'category':
      return `${home}/${route.categoryId}`;
    case 'tool': {
      const tool = findTool(route.toolId);
      if (!tool || tool.availability === 'disabled') return home;
      return `${home}/${tool.metadata.category}/${tool.metadata.id}`;
    }
    case 'tasks':
      return `${home}/tasks`;
    case 'admin':
      return `${home}/admin`;
    default:
      return home;
  }
}
