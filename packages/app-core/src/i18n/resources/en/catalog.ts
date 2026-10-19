export const catalog = {
  actions: {
    browseCategory: 'Browse category',
    openTool: 'Open tool',
    startFromCategory: 'Start with a category',
    viewCategorySamples: 'View category samples',
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
    toolCount: '{{total}} enabled tools',
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
    notConnected: 'Execution not connected',
    notice:
      'This page shows the shared tool flow sample. Inputs, task status, and results are never submitted or executed.',
    notFoundTitle: 'Tool not found',
    notFoundBody: 'This tool does not exist or is disabled.',
    input: {
      title: 'Input',
      description:
        'Provides an input area with recoverable field validation feedback.',
      samplePrefix: 'Sample content: {{sample}}',
      submit: 'Check validation sample',
      fillSample: 'Fill sample text',
      emptyError: 'Enter sample content to see the form feedback.',
      success:
        'Form validation passed. This is an interaction sample; no task was created and no data was processed.',
      snackbar:
        'Validation passed · this is a UI preview, no tool was executed.',
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
      title: 'Task status sample',
      description:
        'Queued, progress, cancelled, and failed states will appear here once the runtime is connected.',
      heading: 'Processing task sample',
      subtitle: 'Demo task · not queued',
      status: 'Waiting',
      progressLabel: 'Task progress sample',
      footnote:
        'The progress bar is a component layout sample; the value does not represent real task progress.',
    },
    result: {
      title: 'Result',
      description:
        'A shared area for success, error, and download result content.',
      chip: 'Result sample',
      ariaLabel: 'Result status component sample',
      heading: 'No result yet',
      body: 'Real tool execution and result storage are not connected, so no files or output are produced here.',
    },
    attribution: {
      design:
        'Design language informed by Material Design 3 · components are managed by the shared adapter.',
      stage:
        'Open-source acknowledgment sample · current build is a UI preview.',
    },
  },
};
