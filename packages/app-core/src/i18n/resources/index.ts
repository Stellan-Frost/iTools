import { common as zhCommon } from './zh-CN/common.js';
import { navigation as zhNavigation } from './zh-CN/navigation.js';
import { catalog as zhCatalog } from './zh-CN/catalog.js';
import { tasks as zhTasks } from './zh-CN/tasks.js';
import { admin as zhAdmin } from './zh-CN/admin.js';
import { common as enCommon } from './en/common.js';
import { navigation as enNavigation } from './en/navigation.js';
import { catalog as enCatalog } from './en/catalog.js';
import { tasks as enTasks } from './en/tasks.js';
import { admin as enAdmin } from './en/admin.js';

/**
 * 唯一 i18n 资源聚合入口，由根 Agent 维护。
 * 各命名空间文件按 docs/12 的文件所有权分别由不同 Agent 维护。
 */
export const resources = {
  'zh-CN': {
    common: zhCommon,
    navigation: zhNavigation,
    catalog: zhCatalog,
    tasks: zhTasks,
    admin: zhAdmin,
  },
  en: {
    common: enCommon,
    navigation: enNavigation,
    catalog: enCatalog,
    tasks: enTasks,
    admin: enAdmin,
  },
} as const;
