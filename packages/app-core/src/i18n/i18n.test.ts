import { describe, expect, it } from 'vitest';
import type { Locale } from '@itools/contracts';
import { createI18n, NAMESPACES, resources } from './index.js';

const LOCALES: readonly Locale[] = ['zh-CN', 'en'];

interface Leaf {
  readonly key: string;
  readonly value: unknown;
}

function collectLeaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node !== 'object' || node === null) {
    return [{ key: prefix, value: node }];
  }

  return Object.entries(node as Record<string, unknown>).flatMap(
    ([key, child]) =>
      collectLeaves(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('NAMESPACES', () => {
  it('按冻结顺序声明全部命名空间', () => {
    expect(NAMESPACES).toEqual([
      'common',
      'navigation',
      'catalog',
      'tasks',
      'admin',
    ]);
  });
});

describe('createI18n', () => {
  it('返回时实例已同步初始化', () => {
    expect(createI18n('zh-CN').isInitialized).toBe(true);
    expect(createI18n('en').isInitialized).toBe(true);
  });

  it('按语言解析 common 命名空间文案', () => {
    expect(createI18n('en').t('common:actions.close')).toBe('Close');
    expect(createI18n('zh-CN').t('common:actions.close')).toBe('关闭');
  });

  it('对 resultCount 做插值', () => {
    expect(createI18n('en').t('common:search.resultCount', { count: 3 })).toBe(
      '3 results',
    );
    expect(
      createI18n('zh-CN').t('common:search.resultCount', { count: 3 }),
    ).toBe('3 项');
  });

  it('嵌套键可通过点路径访问', () => {
    expect(createI18n('en').t('common:meta.homeTitle')).toBe(
      'iTools · Everyday tools in one clear place',
    );
    expect(createI18n('zh-CN').t('common:theme.darkMode')).toBe('深色模式');
  });
});

describe('common 资源', () => {
  it('两个语言的叶子键集合完全一致', () => {
    const zhKeys = collectLeaves(resources['zh-CN'].common)
      .map((leaf) => leaf.key)
      .sort();
    const enKeys = collectLeaves(resources.en.common)
      .map((leaf) => leaf.key)
      .sort();

    expect(enKeys).toEqual(zhKeys);
    expect(zhKeys.length).toBeGreaterThan(0);
  });

  it('所有叶子值都是非空字符串', () => {
    for (const locale of LOCALES) {
      for (const leaf of collectLeaves(resources[locale].common)) {
        expect(leaf.key).not.toBe('');
        expect(typeof leaf.value, `${locale}:${leaf.key}`).toBe('string');
        expect(
          (leaf.value as string).trim().length,
          `${locale}:${leaf.key}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('两个语言都包含全部命名空间', () => {
    for (const locale of LOCALES) {
      for (const namespace of NAMESPACES) {
        expect(resources[locale], `${locale}:${namespace}`).toHaveProperty(
          namespace,
        );
      }
    }
  });
});
