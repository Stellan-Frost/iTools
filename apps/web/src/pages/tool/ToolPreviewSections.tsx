import {
  Card,
  CircularProgressIndicator,
  LinearProgressIndicator,
} from '@itools/design-system-adapter';
import type { CatalogTool } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolPage.module.css';

interface WorkspaceSampleProps {
  tool: CatalogTool;
}

export function WorkspaceSample({ tool }: WorkspaceSampleProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');

  const workspacePreview = tool.preview.workspaceLines
    .map((line) => `${line.label[locale]}: ${line.value}`)
    .join('\n');

  return (
    <section aria-labelledby="tool-workspace-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>02</span>
        <div>
          <h2 id="tool-workspace-heading">{t('tool.workspace.title')}</h2>
          <p>{t('tool.workspace.description')}</p>
        </div>
      </div>
      <Card>
        <div className={styles.workspace}>
          <div className={styles.workspaceHeader}>
            <div>
              <p className={styles.sampleLabel}>{t('tool.workspace.kicker')}</p>
              <h3>{tool.preview.workspaceTitle[locale]}</h3>
            </div>
            <MetadataChip label={t('tool.workspace.chip')} />
          </div>
          <pre
            className={styles.workspacePreview}
            aria-label={t('tool.workspace.ariaLabel', {
              name: tool.name[locale],
            })}
          >
            {workspacePreview}
          </pre>
          <p className={styles.workspaceFootnote}>
            {t('tool.workspace.footnote')}
          </p>
        </div>
      </Card>
    </section>
  );
}

export function TaskStatusSample() {
  const { t } = useTranslation('catalog');

  return (
    <section aria-labelledby="tool-task-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>03</span>
        <div>
          <h2 id="tool-task-heading">{t('tool.task.title')}</h2>
          <p>{t('tool.task.description')}</p>
        </div>
      </div>
      <Card>
        <div className={styles.taskSample}>
          <div className={styles.taskHeading}>
            <span className={styles.taskIcon}>
              <AppIcon name="hourglass_top" />
            </span>
            <div>
              <h3>{t('tool.task.heading')}</h3>
              <p>{t('tool.task.subtitle')}</p>
            </div>
            <MetadataChip label={t('tool.task.status')} />
          </div>
          <div className={styles.progressRow}>
            <LinearProgressIndicator
              value={0.42}
              aria-label={t('tool.task.progressLabel')}
            />
            <span>42%</span>
          </div>
          <p className={styles.taskFootnote}>{t('tool.task.footnote')}</p>
        </div>
      </Card>
    </section>
  );
}

export function ResultSample() {
  const { t } = useTranslation('catalog');

  return (
    <section aria-labelledby="tool-result-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>04</span>
        <div>
          <h2 id="tool-result-heading">{t('tool.result.title')}</h2>
          <p>{t('tool.result.description')}</p>
        </div>
      </div>
      <Card>
        <div className={styles.resultSample}>
          <CircularProgressIndicator
            value={0.7}
            aria-label={t('tool.result.ariaLabel')}
          />
          <div>
            <MetadataChip label={t('tool.result.chip')} />
            <h3>{t('tool.result.heading')}</h3>
            <p>{t('tool.result.body')}</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
