import { useState } from 'react';
import { listTools } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { useAppNavigation } from '../../app/navigation.js';
import { AdminCatalogSection } from './AdminCatalogSection.js';
import { AdminFeedbackExamples } from './AdminFeedbackExamples.js';
import { AdminMetadataForm } from './AdminMetadataForm.js';
import { CreateToolDialog } from './CreateToolDialog.js';
import styles from './AdminPage.module.css';

export function AdminPage() {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('admin');
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        listTools().map(
          (tool) =>
            [tool.metadata.id, tool.availability !== 'disabled'] as const,
        ),
      ),
  );

  function updateToolEnabled(toolId: string, isEnabled: boolean) {
    setEnabledTools((current) => ({ ...current, [toolId]: isEnabled }));
  }

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={<CreateToolDialog />}
      />

      <PreviewNotice>{t('notice')}</PreviewNotice>

      <div className={styles.adminGrid}>
        <AdminCatalogSection
          enabledTools={enabledTools}
          onToggleTool={updateToolEnabled}
        />
        <AdminMetadataForm key={locale} />
      </div>

      <AdminFeedbackExamples />
    </div>
  );
}
