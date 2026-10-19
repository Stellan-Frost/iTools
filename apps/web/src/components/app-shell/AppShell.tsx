import { useEffect, useState, type ReactNode } from 'react';
import { IconButton, NavigationDrawer } from '@itools/design-system-adapter';
import { findTool, type CatalogTool, type CategoryId } from '@itools/app-core';
import type { Locale } from '@itools/contracts';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import type { AppRoute } from '../../app/route.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { RecentTasksPanel } from '../recent-tasks/RecentTasksPanel.js';
import { ToolSearchEntry } from '../tool-search-entry/ToolSearchEntry.js';
import { ToolAccordionNavigation } from './ToolAccordionNavigation.js';
import { ToolInfoDialog } from './ToolInfoDialog.js';
import { useCompactViewport } from './use-compact-viewport.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
}

function routeToCategoryId(route: AppRoute): CategoryId | undefined {
  if (route.page === 'category') return route.categoryId;
  if (route.page === 'tool') return findTool(route.toolId)?.categoryId;
  return undefined;
}

function nextLocale(locale: Locale): Locale {
  return locale === 'zh-CN' ? 'en' : 'zh-CN';
}

export function AppShell({
  children,
  themeMode,
  onToggleTheme,
  onOpenSearch,
}: AppShellProps) {
  const { t } = useTranslation(['common', 'navigation']);
  const { locale, route, navigate, switchLocale } = useAppNavigation();
  const isCompact = useCompactViewport();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<
    ReadonlySet<CategoryId>
  >(() => {
    const categoryId = routeToCategoryId(route);
    return categoryId ? new Set([categoryId]) : new Set();
  });
  const [selectedTool, setSelectedTool] = useState<CatalogTool | null>(null);

  const languageTarget = nextLocale(locale);
  const languageTargetLabel =
    languageTarget === 'en'
      ? t('common:language.en')
      : t('common:language.zhCN');
  const switchLanguageLabel = t('common:language.switchLanguage');

  useEffect(() => {
    if (!isCompact) setIsDrawerOpen(false);
  }, [isCompact]);

  useEffect(() => {
    const categoryId = routeToCategoryId(route);
    if (!categoryId) return;
    setExpandedCategoryIds((expandedIds) => {
      if (expandedIds.has(categoryId)) return expandedIds;
      return new Set(expandedIds).add(categoryId);
    });
  }, [route]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenSearch();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [onOpenSearch]);

  const toggleCategory = (categoryId: CategoryId) => {
    setExpandedCategoryIds((expandedIds) => {
      const nextExpandedIds = new Set(expandedIds);
      if (nextExpandedIds.has(categoryId)) nextExpandedIds.delete(categoryId);
      else nextExpandedIds.add(categoryId);
      return nextExpandedIds;
    });
  };

  const openToolInformation = (toolId: string) => {
    const tool = findTool(toolId);
    if (!tool) return;
    if (isCompact) setIsDrawerOpen(false);
    setSelectedTool(tool);
  };

  const navigateToTool = (toolId: string) => {
    setSelectedTool(null);
    setIsDrawerOpen(false);
    navigate({ page: 'tool', toolId });
  };

  const handleSwitchLanguage = () => {
    switchLocale(languageTarget);
    setIsDrawerOpen(false);
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        {t('common:skipToContent')}
      </a>
      <header className={styles.topBar}>
        <button
          className={styles.brand}
          type="button"
          onClick={() => navigate({ page: 'home' })}
          aria-label={t('common:brandHomeLabel')}
        >
          <img
            className={styles.brandMark}
            src="/brand-icon/icon-preview.svg"
            alt=""
            aria-hidden="true"
          />
        </button>
        {isCompact ? (
          <ToolSearchEntry
            onOpenSearch={onOpenSearch}
            onOpenNavigation={() => setIsDrawerOpen(true)}
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
                aria-label={t('common:recentTasks')}
                aria-expanded={isRecentOpen}
                aria-controls="recent-tasks-panel"
                onClick={() => setIsRecentOpen((isOpen) => !isOpen)}
              />
              {isRecentOpen ? (
                <RecentTasksPanel onClose={() => setIsRecentOpen(false)} />
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
                  ? t('common:theme.toggleToDark')
                  : t('common:theme.toggleToLight')
              }
              onClick={onToggleTheme}
            />
            <IconButton
              className={styles.topBarIcon}
              icon={<AppIcon name="translate" />}
              aria-label={switchLanguageLabel}
              onClick={handleSwitchLanguage}
            />
            <IconButton
              className={styles.topBarIcon}
              icon={<AppIcon name="admin_panel_settings" />}
              aria-label={t('common:adminPreview')}
              onClick={() => navigate({ page: 'admin' })}
            />
          </div>
        ) : null}
      </header>

      <div className={styles.layout}>
        {!isCompact ? (
          <aside
            className={styles.desktopNavigation}
            aria-label={t('navigation:desktopLabel')}
          >
            <ToolAccordionNavigation
              expandedCategoryIds={expandedCategoryIds}
              onToggleCategory={toggleCategory}
              onNavigateHome={() => navigate({ page: 'home' })}
              onOpenTool={openToolInformation}
            />
          </aside>
        ) : null}
        <main className={styles.mainContent} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {isCompact ? (
        <NavigationDrawer
          id="mobile-navigation-drawer"
          aria-label={t('navigation:categoriesLabel')}
          aria-hidden={!isDrawerOpen}
          inert={!isDrawerOpen}
          variant="modal"
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          <div className={styles.drawerContent}>
            <div className={styles.drawerHeader}>
              <span>{t('navigation:browseCategories')}</span>
              <IconButton
                icon={<AppIcon name="close" />}
                aria-label={t('navigation:closeNavigation')}
                onClick={() => setIsDrawerOpen(false)}
              />
            </div>
            <div
              className={styles.drawerActions}
              aria-label={t('navigation:appActions')}
            >
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
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
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={<AppIcon name="translate" />}
                aria-label={switchLanguageLabel}
                onClick={handleSwitchLanguage}
              />
              <span className={styles.drawerActionLabel}>
                {languageTargetLabel}
              </span>
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={<AppIcon name="admin_panel_settings" />}
                aria-label={t('common:adminPreview')}
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate({ page: 'admin' });
                }}
              />
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={<AppIcon name="history" />}
                aria-label={t('common:recentTasks')}
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate({ page: 'tasks' });
                }}
              />
            </div>
            <ToolAccordionNavigation
              expandedCategoryIds={expandedCategoryIds}
              onToggleCategory={toggleCategory}
              onNavigateHome={() => {
                setIsDrawerOpen(false);
                navigate({ page: 'home' });
              }}
              onOpenTool={openToolInformation}
            />
          </div>
        </NavigationDrawer>
      ) : null}
      <ToolInfoDialog
        tool={selectedTool}
        onClose={() => setSelectedTool(null)}
        onNavigate={navigateToTool}
      />
    </div>
  );
}
