import { useEffect, useState, type ReactNode } from 'react';
import { IconButton, NavigationDrawer } from '@itools/design-system-adapter';
import type { AppRoute } from '../../app/route.js';
import { getTool, type ToolDefinition } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { ToolAccordionNavigation } from './ToolAccordionNavigation.js';
import { ToolInfoDialog } from './ToolInfoDialog.js';
import { RecentTasksPanel } from '../recent-tasks/RecentTasksPanel.js';
import { ToolSearchEntry } from '../tool-search-entry/ToolSearchEntry.js';
import { useCompactViewport } from './use-compact-viewport.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  route: AppRoute;
  themeMode: 'light' | 'dark';
  onNavigate: (route: AppRoute) => void;
  onOpenSearch: () => void;
  onToggleTheme: () => void;
}

function routeToCategoryId(route: AppRoute) {
  if (route.page === 'category') return route.categoryId;
  if (route.page === 'tool') return getTool(route.toolId)?.categoryId;
  return undefined;
}

export function AppShell({
  children,
  route,
  themeMode,
  onNavigate,
  onOpenSearch,
  onToggleTheme,
}: AppShellProps) {
  const isCompact = useCompactViewport();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => {
      const categoryId = routeToCategoryId(route);
      return categoryId ? new Set([categoryId]) : new Set();
    },
  );
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

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

  const toggleCategory = (categoryId: string) => {
    setExpandedCategoryIds((expandedIds) => {
      const nextExpandedIds = new Set(expandedIds);
      if (nextExpandedIds.has(categoryId)) nextExpandedIds.delete(categoryId);
      else nextExpandedIds.add(categoryId);
      return nextExpandedIds;
    });
  };

  const openToolInformation = (toolId: string) => {
    const tool = getTool(toolId);
    if (!tool) return;
    if (isCompact) setIsDrawerOpen(false);
    setSelectedTool(tool);
  };

  const navigateToTool = (toolId: string) => {
    setSelectedTool(null);
    setIsDrawerOpen(false);
    onNavigate({ page: 'tool', toolId });
  };

  const openTaskTool = (toolId: string) => {
    onNavigate({ page: 'tool', toolId });
    setIsRecentOpen(false);
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        跳到主要内容
      </a>
      <header className={styles.topBar}>
        <button
          className={styles.brand}
          type="button"
          onClick={() => onNavigate({ page: 'home' })}
          aria-label="iTools 首页"
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
                aria-label="最近任务"
                aria-expanded={isRecentOpen}
                aria-controls="recent-tasks-panel"
                onClick={() => setIsRecentOpen((isOpen) => !isOpen)}
              />
              {isRecentOpen ? (
                <RecentTasksPanel
                  onClose={() => setIsRecentOpen(false)}
                  onOpenTool={openTaskTool}
                  onViewAll={() => {
                    onNavigate({ page: 'tasks' });
                    setIsRecentOpen(false);
                  }}
                />
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
                themeMode === 'light' ? '切换深色模式' : '切换浅色模式'
              }
              onClick={onToggleTheme}
            />
            <IconButton
              className={styles.topBarIcon}
              icon={<AppIcon name="admin_panel_settings" />}
              aria-label="管理预览"
              onClick={() => onNavigate({ page: 'admin' })}
            />
          </div>
        ) : null}
      </header>

      <div className={styles.layout}>
        {!isCompact ? (
          <aside className={styles.desktopNavigation} aria-label="桌面分类导航">
            <ToolAccordionNavigation
              expandedCategoryIds={expandedCategoryIds}
              onToggleCategory={toggleCategory}
              onNavigateHome={() => onNavigate({ page: 'home' })}
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
          aria-label="工具分类"
          aria-hidden={!isDrawerOpen}
          inert={!isDrawerOpen}
          variant="modal"
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          <div className={styles.drawerContent}>
            <div className={styles.drawerHeader}>
              <span>浏览分类</span>
              <IconButton
                icon={<AppIcon name="close" />}
                aria-label="关闭分类导航"
                onClick={() => setIsDrawerOpen(false)}
              />
            </div>
            <div className={styles.drawerActions} aria-label="应用操作">
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={
                  <AppIcon
                    name={themeMode === 'light' ? 'dark_mode' : 'light_mode'}
                  />
                }
                aria-label={
                  themeMode === 'light' ? '切换深色模式' : '切换浅色模式'
                }
                onClick={onToggleTheme}
              />
              <span>{themeMode === 'light' ? '深色模式' : '浅色模式'}</span>
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={<AppIcon name="admin_panel_settings" />}
                aria-label="管理预览"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onNavigate({ page: 'admin' });
                }}
              />
              <IconButton
                className={styles.topBarIcon}
                style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
                icon={<AppIcon name="history" />}
                aria-label="最近任务"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onNavigate({ page: 'tasks' });
                }}
              />
            </div>
            <ToolAccordionNavigation
              expandedCategoryIds={expandedCategoryIds}
              onToggleCategory={toggleCategory}
              onNavigateHome={() => {
                setIsDrawerOpen(false);
                onNavigate({ page: 'home' });
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
