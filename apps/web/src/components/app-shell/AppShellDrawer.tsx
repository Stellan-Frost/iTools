import { IconButton, NavigationDrawer } from '@itools/design-system-adapter';
import type { CategoryId } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { ToolAccordionNavigation } from './ToolAccordionNavigation.js';
import styles from './AppShell.module.css';

interface AppShellDrawerProps {
  open: boolean;
  themeMode: 'light' | 'dark';
  languageTargetLabel: string;
  expandedCategoryIds: ReadonlySet<CategoryId>;
  onClose: () => void;
  onToggleTheme: () => void;
  onSwitchLanguage: () => void;
  onNavigateHome: () => void;
  onNavigateAdmin: () => void;
  onNavigateTasks: () => void;
  onOpenAppInfo: () => void;
  onToggleCategory: (categoryId: CategoryId) => void;
  onOpenTool: (toolId: string) => void;
}

/** 紧凑布局的模态抽屉：复用桌面手风琴导航与全局操作。 */
export function AppShellDrawer({
  open,
  themeMode,
  languageTargetLabel,
  expandedCategoryIds,
  onClose,
  onToggleTheme,
  onSwitchLanguage,
  onNavigateHome,
  onNavigateAdmin,
  onNavigateTasks,
  onOpenAppInfo,
  onToggleCategory,
  onOpenTool,
}: AppShellDrawerProps) {
  const { t } = useTranslation(['navigation', 'common']);

  return (
    <NavigationDrawer
      id="mobile-navigation-drawer"
      aria-label={t('navigation:categoriesLabel')}
      aria-hidden={!open}
      inert={!open}
      variant="modal"
      open={open}
      onClose={onClose}
    >
      <div className={styles.drawerContent}>
        <div className={styles.drawerHeader}>
          <span>{t('navigation:browseCategories')}</span>
          <IconButton
            icon={<AppIcon name="close" />}
            aria-label={t('navigation:closeNavigation')}
            onClick={onClose}
          />
        </div>
        <div
          className={styles.drawerActions}
          aria-label={t('navigation:appActions')}
        >
          <IconButton
            className={styles.topBarIcon}
            icon={
              <AppIcon
                name={themeMode === 'light' ? 'dark_mode' : 'light_mode'}
              />
            }
            aria-label={
              themeMode === 'light'
                ? t('common:theme.toggleToDark')
                : t('common:theme.toggleToLight')
            }
            onClick={onToggleTheme}
          />
          <span className={styles.drawerActionLabel}>
            {themeMode === 'light'
              ? t('common:theme.darkMode')
              : t('common:theme.lightMode')}
          </span>
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="translate" />}
            aria-label={t('common:language.switchLanguage')}
            onClick={onSwitchLanguage}
          />
          <span className={styles.drawerActionLabel}>
            {languageTargetLabel}
          </span>
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="admin_panel_settings" />}
            aria-label={t('common:adminPreview')}
            onClick={onNavigateAdmin}
          />
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="history" />}
            aria-label={t('common:recentTasks')}
            onClick={onNavigateTasks}
          />
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="info" />}
            aria-label={t('common:pwa.aboutLabel')}
            onClick={onOpenAppInfo}
          />
          <span className={styles.drawerActionLabel}>
            {t('common:pwa.aboutLabel')}
          </span>
        </div>
        <ToolAccordionNavigation
          expandedCategoryIds={expandedCategoryIds}
          onToggleCategory={onToggleCategory}
          onNavigateHome={onNavigateHome}
          onOpenTool={onOpenTool}
        />
      </div>
    </NavigationDrawer>
  );
}
