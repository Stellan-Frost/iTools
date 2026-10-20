export const catalog = {
  actions: {
    browseCategory: 'Browse category',
    openTool: 'Open tool',
    startFromCategory: 'Start with a category',
    browseOtherCategory: 'Browse another category',
    backHome: 'Back to home',
  },
  card: {
    toolCount: '{{total}} tools',
  },
  home: {
    eyebrow: 'iTools · A clear, lightweight entry point',
    title: 'Everyday tools in one clear place.',
    intro:
      'Browse categories and a consistent tool page. Everything runs locally in your browser; this build shows interface structure only and does not process files or save tasks.',
    summaryLabel: 'Preview catalog summary',
    categoryCount: '{{total}} categories',
    toolCount: '{{total}} tools',
    realRuns: '0 real operations',
    artworkNote: 'LOCAL · PREVIEW',
    browseKicker: 'BROWSE',
    categoryTitle: 'Browse by category',
    categoryAction: 'View category samples',
    featuredKicker: 'SAMPLE TOOLBOX',
    featuredTitle: 'Featured tool previews',
    featuredCaption: 'Preview data · not the live catalog',
    privacyTitle: 'Local UI preview',
    privacyBody:
      'Sample inputs, tasks, and results only show page layout. There is no database, real tool processing, or admin authentication.',
  },
  category: {
    eyebrow: 'Tool category · UI preview',
    count: '{{total}} tools',
    notice:
      'The items below show how catalog browsing works. Tool processing is not connected yet.',
    listLabel: '{{category}} tools',
    emptyTitle: 'No tools in this category yet',
    emptyBody:
      'The category structure is still available. Implemented tools can appear here later.',
    notFoundTitle: 'Category not found',
    notFoundBody: 'This category is not part of the current catalog.',
  },
  tool: {
    eyebrow: '{{category}} · Tool UI preview',
    previewBody:
      'This tool is not implemented yet. This page only shows its layout and sample content.',
    offlinePreviewBody:
      'You are offline. This page remains a UI preview; a processing engine is not guaranteed to be cached or available.',
    previewInputHint: 'Input is disabled until this tool is implemented.',
    previewTaskBody:
      'Task runtime will be connected with the tool implementation.',
    previewResultBody:
      'Real results will appear once this tool is implemented.',
    notFoundTitle: 'Tool not found',
    notFoundBody: 'This tool does not exist or is disabled.',
    input: {
      title: 'Input',
    },
    workspace: {
      title: 'Workspace',
      description:
        'Shows where the main tool content goes without running the sample.',
      kicker: 'WORKSPACE SAMPLE',
      chip: 'Preview data',
      ariaLabel: '{{name}} workspace sample',
      footnote:
        'This area illustrates workspace proportions and information hierarchy. Nothing runs yet.',
    },
    task: {
      title: 'Task status',
    },
    result: {
      title: 'Result',
      heading: 'No result yet',
    },
    attribution: {
      design:
        'Design language informed by Material Design 3 · components are managed by the shared adapter.',
      stage:
        'Open-source acknowledgment sample · current build is a UI preview.',
    },
  },
};
