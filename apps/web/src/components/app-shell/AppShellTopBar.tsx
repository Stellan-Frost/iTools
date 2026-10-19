import { IconButton } from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { RecentTasksPanel } from '../recent-tasks/RecentTasksPanel.js';
import { ToolSearchEntry } from '../tool-search-entry/ToolSearchEntry.js';
import styles from './AppShell.module.css';

interface AppShellTopBarProps {
  isCompact: boolean;
  themeMode: 'light' | 'dark';
  isDrawerOpen: boolean;
  isRecentOpen: boolean;
  onToggleRecent: () => void;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onOpenDrawer: () => void;
  onNavigateHome: () => void;
  onNavigateAdmin: () => void;
  onSwitchLanguage: () => void;
}

/** 桌面与紧凑布局共用的顶部栏。 */
export function AppShellTopBar({
  isCompact,
  themeMode,
  isDrawerOpen,
  isRecentOpen,
  onToggleRecent,
  onToggleTheme,
  onOpenSearch,
  onOpenDrawer,
  onNavigateHome,
  onNavigateAdmin,
  onSwitchLanguage,
}: AppShellTopBarProps) {
  const { t } = useTranslation('common');

  return (
    <header className={styles.topBar}>
      <IconButton
        className={styles.brandButton}
        icon={
          <img
            className={styles.brandMark}
            src="/brand-icon/icon-preview.svg"
            alt=""
            aria-hidden="true"
          />
        }
        aria-label={t('brandHomeLabel')}
        onClick={onNavigateHome}
      />
      {isCompact ? (
        <ToolSearchEntry
          onOpenSearch={onOpenSearch}
          onOpenNavigation={onOpenDrawer}
          navigationExpanded={isDrawerOpen}
        />
      ) : (
        <ToolSearchEntry onOpenSearch={onOpenSearch} />
      )}
      {!isCompact ? (
        <div className={styles.topActions}>
          <div className={styles.recentAnchor}>
            <IconButton
              className={styles.topBarIcon}
              icon={<AppIcon name="history" />}
              aria-label={t('recentTasks')}
              aria-expanded={isRecentOpen}
              aria-controls="recent-tasks-panel"
              onClick={onToggleRecent}
            />
            {isRecentOpen ? (
              <RecentTasksPanel onClose={onToggleRecent} />
            ) : null}
          </div>
          <IconButton
            className={styles.topBarIcon}
            icon={
              <AppIcon
                name={themeMode === 'light' ? 'dark_mode' : 'light_mode'}
              />
            }
            aria-label={
              themeMode === 'light'
                ? t('theme.toggleToDark')
                : t('theme.toggleToLight')
            }
            onClick={onToggleTheme}
          />
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="translate" />}
            aria-label={t('language.switchLanguage')}
            onClick={onSwitchLanguage}
          />
          <IconButton
            className={styles.topBarIcon}
            icon={<AppIcon name="admin_panel_settings" />}
            aria-label={t('adminPreview')}
            onClick={onNavigateAdmin}
          />
        </div>
      ) : null}
    </header>
  );
}
