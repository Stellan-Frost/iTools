import { useEffect, useState, type ReactNode } from 'react';
import {
  findTool,
  type CategoryId,
  type RegistryEntry,
} from '@itools/app-core';
import type { Locale } from '@itools/contracts';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import type { AppRoute } from '../../app/route.js';
import { AppShellDrawer } from './AppShellDrawer.js';
import { AppShellTopBar } from './AppShellTopBar.js';
import { ToolAccordionNavigation } from './ToolAccordionNavigation.js';
import { ToolInfoDialog } from './ToolInfoDialog.js';
import { useCompactViewport } from './use-compact-viewport.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onOpenAppInfo: () => void;
}

function routeToCategoryId(route: AppRoute): CategoryId | undefined {
  if (route.page === 'category') return route.categoryId;
  if (route.page === 'tool') {
    return findTool(route.toolId)?.metadata.category;
  }
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
  onOpenAppInfo,
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
  const [selectedTool, setSelectedTool] = useState<RegistryEntry | null>(null);

  const languageTarget = nextLocale(locale);
  const languageTargetLabel =
    languageTarget === 'en'
      ? t('common:language.en')
      : t('common:language.zhCN');

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

  function toggleCategory(categoryId: CategoryId) {
    setExpandedCategoryIds((expandedIds) => {
      const nextExpandedIds = new Set(expandedIds);
      if (nextExpandedIds.has(categoryId)) nextExpandedIds.delete(categoryId);
      else nextExpandedIds.add(categoryId);
      return nextExpandedIds;
    });
  }

  function navigateHome() {
    setIsDrawerOpen(false);
    navigate({ page: 'home' });
  }

  function navigateAdmin() {
    setIsRecentOpen(false);
    setIsDrawerOpen(false);
    navigate({ page: 'admin' });
  }

  function navigateTasks() {
    setIsDrawerOpen(false);
    navigate({ page: 'tasks' });
  }

  function switchLanguage() {
    switchLocale(languageTarget);
    setIsDrawerOpen(false);
  }

  function openToolInformation(toolId: string) {
    const tool = findTool(toolId);
    if (!tool) return;
    if (isCompact) setIsDrawerOpen(false);
    setSelectedTool(tool);
  }

  function navigateToTool(toolId: string) {
    setSelectedTool(null);
    setIsDrawerOpen(false);
    navigate({ page: 'tool', toolId });
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        {t('common:skipToContent')}
      </a>
      <AppShellTopBar
        isCompact={isCompact}
        themeMode={themeMode}
        isDrawerOpen={isDrawerOpen}
        isRecentOpen={isRecentOpen}
        onToggleRecent={() => setIsRecentOpen((isOpen) => !isOpen)}
        onToggleTheme={onToggleTheme}
        onOpenSearch={onOpenSearch}
        onOpenAppInfo={onOpenAppInfo}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onNavigateHome={navigateHome}
        onNavigateAdmin={navigateAdmin}
        onSwitchLanguage={switchLanguage}
      />

      <div className={styles.layout}>
        {!isCompact ? (
          <aside
            className={styles.desktopNavigation}
            aria-label={t('navigation:desktopLabel')}
          >
            <ToolAccordionNavigation
              expandedCategoryIds={expandedCategoryIds}
              onToggleCategory={toggleCategory}
              onNavigateHome={navigateHome}
              onOpenTool={openToolInformation}
            />
          </aside>
        ) : null}
        <main className={styles.mainContent} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {isCompact ? (
        <AppShellDrawer
          open={isDrawerOpen}
          themeMode={themeMode}
          languageTargetLabel={languageTargetLabel}
          expandedCategoryIds={expandedCategoryIds}
          onClose={() => setIsDrawerOpen(false)}
          onToggleTheme={onToggleTheme}
          onSwitchLanguage={switchLanguage}
          onNavigateHome={navigateHome}
          onNavigateAdmin={navigateAdmin}
          onNavigateTasks={navigateTasks}
          onOpenAppInfo={() => {
            setIsDrawerOpen(false);
            onOpenAppInfo();
          }}
          onToggleCategory={toggleCategory}
          onOpenTool={openToolInformation}
        />
      ) : null}

      <ToolInfoDialog
        tool={selectedTool}
        onClose={() => setSelectedTool(null)}
        onNavigate={navigateToTool}
      />
    </div>
  );
}
