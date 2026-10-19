import { Card } from '@itools/design-system-adapter';
import type { RegistryEntry } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolPage.module.css';

interface WorkspaceSampleProps {
  tool: RegistryEntry;
}

/** 主工作区：只读展示注册表中的示例内容，不运行任何处理。 */
export function WorkspaceSample({ tool }: WorkspaceSampleProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');
  const metadata = tool.metadata;

  const workspacePreview = metadata.preview.workspaceLines
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
              <h3>{metadata.preview.workspaceTitle[locale]}</h3>
            </div>
            <MetadataChip label={t('tool.workspace.chip')} />
          </div>
          <pre
            className={styles.workspacePreview}
            aria-label={t('tool.workspace.ariaLabel', {
              name: metadata.name[locale],
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

/** 任务区：预览态只说明运行能力尚未接入，不展示伪造进度。 */
export function PreviewTaskSection() {
  const { t } = useTranslation('catalog');

  return (
    <section aria-labelledby="tool-task-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>03</span>
        <div>
          <h2 id="tool-task-heading">{t('tool.task.title')}</h2>
        </div>
      </div>
      <Card>
        <div className={styles.taskSample}>
          <div className={styles.taskHeading}>
            <span className={styles.taskIcon}>
              <AppIcon name="hourglass_top" />
            </span>
            <div>
              <p>{t('tool.previewTaskBody')}</p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

/** 结果区：预览态只说明输出尚未接入，不展示伪造结果。 */
export function PreviewResultSection() {
  const { t } = useTranslation('catalog');

  return (
    <section aria-labelledby="tool-result-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>04</span>
        <div>
          <h2 id="tool-result-heading">{t('tool.result.title')}</h2>
        </div>
      </div>
      <Card>
        <div className={styles.resultSample}>
          <span className={styles.taskIcon}>
            <AppIcon name="output" />
          </span>
          <div>
            <h3>{t('tool.result.heading')}</h3>
            <p>{t('tool.previewResultBody')}</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
