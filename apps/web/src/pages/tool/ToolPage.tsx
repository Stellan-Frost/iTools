import { Button } from '@itools/design-system-adapter';
import { findEnabledTool, getCategory } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import { ToolInputSection } from './ToolInputSection.js';
import {
  ResultSample,
  TaskStatusSample,
  WorkspaceSample,
} from './ToolPreviewSections.js';
import styles from './ToolPage.module.css';

interface ToolPageProps {
  toolId: string;
}

export function ToolPage({ toolId }: ToolPageProps) {
  const { locale, navigate } = useAppNavigation();
  const { t } = useTranslation(['catalog', 'common']);

  const tool = findEnabledTool(toolId);
  if (!tool) {
    return (
      <div className={styles.page}>
        <PageHeading
          title={t('catalog:tool.notFoundTitle')}
          description={t('catalog:tool.notFoundBody')}
        />
        <Button variant="filled" onClick={() => navigate({ page: 'home' })}>
          {t('common:actions.backHome')}
        </Button>
      </div>
    );
  }

  const category = getCategory(tool.categoryId);
  const categoryName = category ? category.name[locale] : tool.categoryId;

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('catalog:tool.eyebrow', { category: categoryName })}
        title={tool.name[locale]}
        description={tool.summary[locale]}
        actions={<MetadataChip label={t('catalog:tool.notConnected')} />}
      />
      <PreviewNotice>{t('catalog:tool.notice')}</PreviewNotice>
      <div className={styles.sections}>
        <ToolInputSection tool={tool} />
        <WorkspaceSample tool={tool} />
        <TaskStatusSample />
        <ResultSample />
      </div>
      <footer className={styles.attribution}>
        <p>{t('catalog:tool.attribution.design')}</p>
        <p>{t('catalog:tool.attribution.stage')}</p>
      </footer>
    </div>
  );
}
