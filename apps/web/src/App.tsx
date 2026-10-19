import { useState } from 'react';
import {
  AppThemeProvider,
  SnackbarProvider,
} from '@itools/design-system-adapter';
import type { AppRoute } from './app/route.js';
import { CommandPalette } from './components/command-palette/CommandPalette.js';
import { AppShell } from './components/app-shell/AppShell.js';
import { AdminPage } from './pages/admin/AdminPage.js';
import { CategoryPage } from './pages/category/CategoryPage.js';
import { HomePage } from './pages/home/HomePage.js';
import { TasksPage } from './pages/tasks/TasksPage.js';
import { ToolPage } from './pages/tool/ToolPage.js';

function CurrentPage({
  route,
  onNavigate,
  onOpenSearch,
}: {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenSearch: () => void;
}) {
  if (route.page === 'home')
    return <HomePage onNavigate={onNavigate} onOpenSearch={onOpenSearch} />;
  if (route.page === 'category')
    return (
      <CategoryPage categoryId={route.categoryId} onNavigate={onNavigate} />
    );
  if (route.page === 'tool')
    return <ToolPage toolId={route.toolId} onNavigate={onNavigate} />;
  if (route.page === 'tasks') return <TasksPage onNavigate={onNavigate} />;
  return <AdminPage />;
}

export function App() {
  const [route, setRoute] = useState<AppRoute>({ page: 'home' });
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  function openTool(toolId: string) {
    setRoute({ page: 'tool', toolId });
  }

  return (
    <AppThemeProvider mode={themeMode}>
      <SnackbarProvider>
        <AppShell
          route={route}
          themeMode={themeMode}
          onNavigate={setRoute}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleTheme={() =>
            setThemeMode((mode) => (mode === 'light' ? 'dark' : 'light'))
          }
        >
          <CurrentPage
            route={route}
            onNavigate={setRoute}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        </AppShell>
        <CommandPalette
          open={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onOpenTool={openTool}
        />
      </SnackbarProvider>
    </AppThemeProvider>
  );
}
