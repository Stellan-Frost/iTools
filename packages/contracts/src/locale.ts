/** 阶段 3 冻结的语言集合；新增语言须先更新 docs/02 与本文对应决策。 */
export const LOCALES = ['zh-CN', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
