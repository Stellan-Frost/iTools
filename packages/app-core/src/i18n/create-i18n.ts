import { createInstance } from 'i18next';
import type { i18n, InitOptions } from 'i18next';
import { LOCALES, type Locale } from '@itools/contracts';
import { NAMESPACES } from './namespaces.js';
import { resources } from './resources/index.js';

/**
 * 创建绑定单一语言的 i18next 实例。
 * 资源随包内置，且 initAsync 关闭，因此返回时实例已初始化完成。
 */
export function createI18n(locale: Locale): i18n {
  const instance = createInstance();

  const options: InitOptions = {
    lng: locale,
    fallbackLng: 'zh-CN',
    supportedLngs: [...LOCALES],
    ns: [...NAMESPACES],
    defaultNS: 'common',
    resources,
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  };

  void instance.init(options);

  return instance;
}
