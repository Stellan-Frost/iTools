import { createI18n } from '@itools/app-core';
import { describe, expect, it } from 'vitest';
import { buildHeadHtml } from './seo.js';

const siteOrigin = 'https://itools.example';
const i18n = createI18n('zh-CN');

function headFor(route: Parameters<typeof buildHeadHtml>[0]['route']) {
  return buildHeadHtml({
    locale: 'zh-CN',
    route,
    siteOrigin,
    t: (key) => i18n.getFixedT('zh-CN', 'common')(key),
  });
}

describe('stage 4 SEO head', () => {
  it('keeps home and category pages indexable', () => {
    expect(headFor({ page: 'home' })).not.toContain('noindex');
    expect(headFor({ page: 'category', categoryId: 'text' })).not.toContain(
      'noindex',
    );
  });

  it('marks preview tool pages as noindex while keeping canonical', () => {
    const head = headFor({ page: 'tool', toolId: 'json-viewer' });

    expect(head).toContain('name="robots" content="noindex"');
    expect(head).toContain(
      `rel="canonical" href="${siteOrigin}/zh-CN/text/json-viewer"`,
    );
  });

  it('keeps tasks, admin and not-found pages out of the index', () => {
    for (const route of [
      { page: 'tasks' as const },
      { page: 'admin' as const },
      { page: 'not-found' as const },
    ]) {
      expect(headFor(route)).toContain('name="robots" content="noindex"');
    }
  });
});
