import { createInstance } from 'i18next';
import type { i18n, InitOptions, Resource } from 'i18next';
import {
  LOCALES,
  type Locale,
  type ToolTranslationResources,
} from '@itools/contracts';
import { NAMESPACES } from './namespaces.js';
import { resources } from './resources/index.js';

/**
 * 创建绑定单一语言的 i18next 实例。
 * 资源随包内置，且 initAsync 关闭，因此返回时实例已初始化完成。
 *
 * `extraResources` 用于注入工具包自带的 `tools/<id>` 命名空间；
 * 按语言做浅合并，不传时行为与内置资源完全一致。
 */
export function createI18n(
  locale: Locale,
  extraResources?: ToolTranslationResources,
): i18n {
  const instance = createInstance();

  const builtInResources: Resource = resources;
  const mergedResources: Resource = { ...builtInResources };
  const namespaces = new Set<string>(NAMESPACES);

  for (const resourceLocale of LOCALES) {
    const extra = extraResources?.[resourceLocale];
    if (extra === undefined) {
      continue;
    }

    mergedResources[resourceLocale] = {
      ...(builtInResources[resourceLocale] ?? {}),
      ...extra,
    };

    for (const namespace of Object.keys(extra)) {
      namespaces.add(namespace);
    }
  }

  const options: InitOptions = {
    lng: locale,
    fallbackLng: 'zh-CN',
    supportedLngs: [...LOCALES],
    ns: [...namespaces],
    defaultNS: 'common',
    resources: mergedResources,
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  };

  void instance.init(options);

  return instance;
}
