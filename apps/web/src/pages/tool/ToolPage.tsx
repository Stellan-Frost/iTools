import { Button } from '@itools/design-system-adapter';
import { findVisibleTool, getCategory } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { PreviewBadge } from '../../components/page-chrome/PreviewBadge.js';
import { useAppNavigation } from '../../app/navigation.js';
import { ToolInputSection } from './ToolInputSection.js';
import {
  PreviewResultSection,
  PreviewTaskSection,
  WorkspaceSample,
} from './ToolPreviewSections.js';
import styles from './ToolPage.module.css';

interface ToolPageProps {
  toolId: string;
}

export function ToolPage({ toolId }: ToolPageProps) {
  const { locale, navigate } = useAppNavigation();
  const { t } = useTranslation(['catalog', 'common']);

  const tool = findVisibleTool(toolId);
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

  const metadata = tool.metadata;
  const category = getCategory(metadata.category);
  const categoryName = category ? category.name[locale] : metadata.category;

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('catalog:tool.eyebrow', { category: categoryName })}
        title={metadata.name[locale]}
        description={metadata.summary[locale]}
        actions={tool.availability === 'preview' ? <PreviewBadge /> : null}
      />
      <PreviewNotice>{t('catalog:tool.previewBody')}</PreviewNotice>
      <div className={styles.sections}>
        <ToolInputSection tool={tool} />
        <WorkspaceSample tool={tool} />
        <PreviewTaskSection />
        <PreviewResultSection />
      </div>
      <footer className={styles.attribution}>
        <p>{t('catalog:tool.attribution.design')}</p>
        <p>{t('catalog:tool.attribution.stage')}</p>
      </footer>
    </div>
  );
}
