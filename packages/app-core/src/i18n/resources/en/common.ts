export const common = {
  skipToContent: 'Skip to main content',
  brandHomeLabel: 'iTools home',
  theme: {
    toggleToDark: 'Switch to dark theme',
    toggleToLight: 'Switch to light theme',
    darkMode: 'Dark theme',
    lightMode: 'Light theme',
  },
  adminPreview: 'Admin preview',
  recentTasks: 'Recent tasks',
  availability: {
    preview: 'Preview',
    unavailable: 'Unavailable',
  },
  actions: {
    close: 'Close',
    later: 'Later',
    backHome: 'Back to home',
    openPreview: 'Open preview',
    goToTool: 'Go to tool',
  },
  search: {
    openLabel: 'Search tools',
    dialogTitle: 'Search tools',
    placeholder: 'Search by name, summary, or category',
    resultsLabel: 'Tool search results',
    resultCount: '{{count}} results',
    empty: 'No matching tools. Try a category or tool name.',
    sampleLabel: 'Tools',
    previewSuffix: 'UI preview',
  },
  language: {
    zhCN: '简体中文',
    en: 'English',
    switchLanguage: 'Switch language',
  },
  pwa: {
    aboutTitle: 'App and offline information',
    aboutLabel: 'App information',
    aboutBody:
      'App shell resources are cached on demand; offline startup depends on whether the required page resources were cached.',
    currentBuildId: 'Current build',
    unknownBuildId: 'Not available',
    updateBuildId: 'Pending build',
    fontFallback:
      'Fonts load on demand. System fonts are used offline when needed; not every font is guaranteed to be cached.',
    offlineLimits:
      'Tasks and admin pages require a connection. Tool pages remain previews; processing engines are not guaranteed to be available offline.',
    updateTitle: 'Update ready',
    updateReadyBody:
      'The new build has been downloaded. Applying it will reload the page.',
    updateRisk:
      'If you are editing or processing content, reloading may interrupt your work. This build has no live task detector.',
    reviewUpdate: 'Review update',
    applyUpdate: 'Apply and reload',
    applying: 'Applying…',
    checkUpdates: 'Check for updates',
    checking: 'Checking…',
    retry: 'Retry',
    repairInstallation: 'Repair offline installation',
    repairConfirmTitle: 'Repair the installation?',
    repairConfirmBody:
      'Repair downloads the app cache again and clears damaged or incomplete app cache entries.',
    repairAssetsNote:
      'This only affects the app cache. Local assets and task data are not deleted.',
    confirmRepair: 'Confirm repair',
    repairing: 'Repairing…',
    automaticPromptSuppressed:
      'This build has failed twice, so automatic prompts are paused. You can still check or retry manually from app information.',
    status: {
      checking: 'Checking for available updates…',
      upToDate: 'No update is available.',
      updateReady: 'A new build is ready to install.',
      applying: 'Applying the update. The page will reload when it is ready.',
      repairing: 'Repairing the offline cache…',
      updateFailed:
        'The update did not complete. The current build remains available. You can retry.',
      repairComplete:
        'Repair complete. The app offline cache has been installed again.',
      repairFailed:
        'Repair failed. The current app remains available. You can retry.',
      initialInstallFailed:
        'Offline setup did not complete. Stay connected and retry; no offline build is available yet.',
      unavailable:
        'Service Worker updates are not available in this environment. Connect and refresh the app.',
    },
  },
  notFound: {
    eyebrow: '404',
    title: 'Page not found',
    description:
      'This address has no matching page. It may have moved or is not enabled.',
  },
  meta: {
    homeTitle: 'iTools · Everyday tools in one clear place',
    homeDescription:
      'Browse iTools categories and a consistent tool page. All processing stays in your browser.',
    tasksTitle: 'Recent tasks · iTools',
    tasksDescription:
      'Review recent tasks, their status, and links back to each tool.',
    adminTitle: 'Catalog admin · iTools',
    adminDescription: 'Manage tool availability and display metadata.',
    notFoundTitle: 'Page not found · iTools',
    notFoundDescription:
      'The requested page does not exist, may have moved, or is not enabled.',
    titleSuffix: 'iTools',
  },
};
