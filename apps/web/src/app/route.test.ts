import { describe, expect, it } from 'vitest';
import { buildAppPath, parseAppPath, type AppRoute } from './route.js';

const ROUTES: readonly AppRoute[] = [
  { page: 'home' },
  { page: 'category', categoryId: 'audio' },
  { page: 'tool', toolId: 'image-inspector' },
  { page: 'tasks' },
  { page: 'admin' },
];

describe('parseAppPath', () => {
  it.each([
    ['/zh-CN', 'zh-CN', { page: 'home' }],
    ['/en', 'en', { page: 'home' }],
    ['/en/', 'en', { page: 'home' }],
  ])('parses %s as the home route', (path, locale, route) => {
    expect(parseAppPath(path)).toEqual({ locale, route });
  });

  it.each([
    ['/zh-CN/audio', 'zh-CN', { page: 'category', categoryId: 'audio' }],
    ['/en/text', 'en', { page: 'category', categoryId: 'text' }],
    ['/en/other/', 'en', { page: 'category', categoryId: 'other' }],
  ])('parses %s as a category route', (path, locale, route) => {
    expect(parseAppPath(path)).toEqual({ locale, route });
  });

  it.each([
    [
      '/zh-CN/image/image-inspector',
      'zh-CN',
      { page: 'tool', toolId: 'image-inspector' },
    ],
    [
      '/en/text/markdown-preview',
      'en',
      { page: 'tool', toolId: 'markdown-preview' },
    ],
    [
      '/en/other/timestamp-converter/?from=search',
      'en',
      { page: 'tool', toolId: 'timestamp-converter' },
    ],
  ])('parses %s as a tool route', (path, locale, route) => {
    expect(parseAppPath(path)).toEqual({ locale, route });
  });

  it.each([
    ['/zh-CN/tasks', 'zh-CN', { page: 'tasks' }],
    ['/en/admin', 'en', { page: 'admin' }],
    ['/en/tasks?ref=drawer', 'en', { page: 'tasks' }],
  ])('parses %s as a static page route', (path, locale, route) => {
    expect(parseAppPath(path)).toEqual({ locale, route });
  });

  it.each([
    ['/fr'],
    ['/fr/text'],
    ['/'],
    [''],
    ['/zh-CN/text/unknown-tool'],
    ['/zh-CN/nope'],
    ['/zh-CN/text/csv-inspector'],
    ['/zh-CN/image/markdown-preview'],
    ['/zh-CN/text/markdown-preview/extra'],
    ['/zh-CN/tasks/extra'],
  ])('returns the default locale and a 404 route for %s', (path) => {
    expect(parseAppPath(path)).toEqual({
      locale: 'zh-CN',
      route: { page: 'not-found' },
    });
  });

  it('keeps a known locale when the rest of the path is unknown', () => {
    expect(parseAppPath('/en/nope')).toEqual({
      locale: 'en',
      route: { page: 'not-found' },
    });
  });

  it('accepts an empty category as a valid route', () => {
    expect(parseAppPath('/zh-CN/video')).toEqual({
      locale: 'zh-CN',
      route: { page: 'category', categoryId: 'video' },
    });
  });
});

describe('buildAppPath', () => {
  it('builds canonical paths for every route', () => {
    expect(buildAppPath('zh-CN', { page: 'home' })).toBe('/zh-CN');
    expect(buildAppPath('en', { page: 'category', categoryId: 'text' })).toBe(
      '/en/text',
    );
    expect(buildAppPath('zh-CN', { page: 'tool', toolId: 'json-viewer' })).toBe(
      '/zh-CN/text/json-viewer',
    );
    expect(buildAppPath('en', { page: 'tasks' })).toBe('/en/tasks');
    expect(buildAppPath('en', { page: 'admin' })).toBe('/en/admin');
    expect(buildAppPath('en', { page: 'not-found' })).toBe('/en');
  });

  it('falls back to the locale home for unknown tools', () => {
    expect(buildAppPath('zh-CN', { page: 'tool', toolId: 'missing' })).toBe(
      '/zh-CN',
    );
  });

  it.each(['zh-CN', 'en'] as const)(
    'round-trips every route in %s',
    (locale) => {
      for (const route of ROUTES) {
        expect(parseAppPath(buildAppPath(locale, route))).toEqual({
          locale,
          route,
        });
      }
    },
  );
});
