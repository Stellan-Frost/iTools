import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  IconButton,
  NavigationDrawer,
  NavigationRail,
} from '@itools/design-system-adapter';
import type { AppRoute } from '../../app/route.js';
import { getTool } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { NavigationItems } from './NavigationItems.js';
import { RecentTasksPanel } from '../recent-tasks/RecentTasksPanel.js';
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

function routeToDestination(route: AppRoute) {
  if (route.page === 'category') return route.categoryId;
  if (route.page === 'tool') return getTool(route.toolId)?.categoryId ?? 'home';
  return 'home';
}

function destinationToRoute(destination: string): AppRoute {
  return destination === 'home'
    ? { page: 'home' }
    : { page: 'category', categoryId: destination };
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
  const [isRailExpanded, setIsRailExpanded] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const selectedDestination = routeToDestination(route);

  useEffect(() => {
    if (!isCompact) setIsDrawerOpen(false);
  }, [isCompact]);

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

  const selectDestination = (_event: unknown, destination: string) => {
    onNavigate(destinationToRoute(destination));
    setIsDrawerOpen(false);
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
        {isCompact ? (
          <IconButton
            icon={<AppIcon name="menu" />}
            aria-label="打开分类导航"
            onClick={() => setIsDrawerOpen(true)}
          />
        ) : null}
        <button
          className={styles.brand}
          type="button"
          onClick={() => onNavigate({ page: 'home' })}
          aria-label="iTools 首页"
        >
          <span className={styles.brandMark} aria-hidden="true">
            i
          </span>
          <span>iTools</span>
        </button>
        <span className={styles.previewTag}>界面预览</span>
        <div className={styles.topActions}>
          <Button
            className={styles.searchButton}
            variant="outlined"
            startIcon={<AppIcon name="search" />}
            onClick={onOpenSearch}
          >
            <span className={styles.searchLabel}>搜索工具</span>
            <kbd>⌘ K</kbd>
          </Button>
          <div className={styles.recentAnchor}>
            <Button
              variant="text"
              startIcon={<AppIcon name="history" />}
              aria-label="最近任务"
              aria-expanded={isRecentOpen}
              aria-controls="recent-tasks-panel"
              onClick={() => setIsRecentOpen((isOpen) => !isOpen)}
            >
              <span className={styles.recentLabel}>最近任务</span>
            </Button>
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
            icon={
              <AppIcon
                name={themeMode === 'light' ? 'dark_mode' : 'light_mode'}
              />
            }
            aria-label={themeMode === 'light' ? '切换深色模式' : '切换浅色模式'}
            onClick={onToggleTheme}
          />
          <Button variant="tonal" onClick={() => onNavigate({ page: 'admin' })}>
            {isCompact ? '后台' : '管理预览'}
          </Button>
        </div>
      </header>

      <div
        className={`${styles.layout} ${isRailExpanded ? styles.railExpanded : styles.railCollapsed}`}
      >
        {!isCompact ? (
          <aside className={styles.desktopNavigation} aria-label="桌面分类导航">
            <NavigationRail
              aria-label="工具分类"
              value={selectedDestination}
              onChange={selectDestination}
              variant={isRailExpanded ? 'expanded' : 'collapsed'}
              header={
                <div className={styles.railHeader}>
                  <IconButton
                    icon={
                      <AppIcon
                        name={isRailExpanded ? 'chevron_left' : 'chevron_right'}
                      />
                    }
                    aria-label={
                      isRailExpanded ? '收起分类侧栏' : '展开分类侧栏'
                    }
                    aria-expanded={isRailExpanded}
                    onClick={() => setIsRailExpanded((expanded) => !expanded)}
                  />
                  {isRailExpanded ? <span>浏览分类</span> : null}
                </div>
              }
            >
              <NavigationItems type="rail" isRailExpanded={isRailExpanded} />
            </NavigationRail>
          </aside>
        ) : null}
        <main className={styles.mainContent} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {isCompact ? (
        <NavigationDrawer
          aria-label="工具分类"
          aria-hidden={!isDrawerOpen}
          inert={!isDrawerOpen}
          variant="modal"
          open={isDrawerOpen}
          value={selectedDestination}
          onChange={selectDestination}
          onClose={() => setIsDrawerOpen(false)}
        >
          <NavigationItems type="drawer" />
        </NavigationDrawer>
      ) : null}
    </div>
  );
}
