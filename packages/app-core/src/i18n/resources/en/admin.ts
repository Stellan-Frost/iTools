export const admin = {
  eyebrow: 'Catalog maintenance · UI preview',
  title: 'Admin preview',
  description:
    'Review tool availability, metadata editing, and feedback samples. All changes live only in this page memory.',
  notice:
    'Preview mode: there is no admin authentication, database, or catalog write API.',
  catalog: {
    kicker: 'CATALOG PREVIEW',
    title: 'Tool catalog',
    count: '{{total}} items',
    enabled: 'Enabled',
    disabled: 'Disabled',
    toggleLabel: 'Toggle {{name}} status',
    helper:
      'The switches only demonstrate interaction state; catalog data is not persisted.',
  },
  metadata: {
    kicker: 'METADATA FORM',
    title: 'Metadata edit sample',
    nameLabel: 'Tool name',
    summaryLabel: 'Tool summary',
    categoryLabel: 'Category',
    idLabel: 'Identifier',
    bothRequired: 'Both the tool name and summary are required.',
    nameRequired: 'Enter a tool name.',
    summaryRequired: 'Enter a tool summary.',
    success:
      'Form validation passed. Changes exist only in this page memory and were not written to the catalog.',
    snackbar: 'Form validation passed · nothing was saved to a backend.',
    submit: 'Validate form sample',
    reset: 'Reset sample',
  },
  feedback: {
    kicker: 'FEEDBACK STATES',
    title: 'Status and error feedback samples',
    success:
      'Success state sample: field validation completed, nothing was written to a server.',
    error:
      'Error state sample: the catalog service is not connected, so save and rollback are unavailable.',
  },
  create: {
    open: 'Add tool sample',
    title: 'Add tool sample',
    body: 'Enter a name to see validation feedback for the add flow. This sample does not enter the catalog.',
    nameLabel: 'Tool name',
    nameError: 'Enter a tool name to see the dialog validation feedback.',
    cancel: 'Cancel',
    submit: 'Check validation feedback',
    snackbar:
      'Add form sample validation passed · no catalog record was created.',
  },
};
