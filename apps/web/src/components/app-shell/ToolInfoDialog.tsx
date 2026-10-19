import { Button, Dialog } from '@itools/design-system-adapter';
import { getCategory, type RegistryEntry } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import { PreviewBadge } from '../page-chrome/PreviewBadge.js';
import styles from './ToolInfoDialog.module.css';

interface ToolInfoDialogProps {
  tool: RegistryEntry | null;
  onClose: () => void;
  onNavigate: (toolId: string) => void;
}

export function ToolInfoDialog({
  tool,
  onClose,
  onNavigate,
}: ToolInfoDialogProps) {
  const { t } = useTranslation(['common', 'navigation', 'catalog']);
  const { locale } = useAppNavigation();

  if (!tool) return null;

  const { metadata } = tool;
  const category = getCategory(metadata.category);
  const categoryLabel = category?.name[locale] ?? '';
  const isPreview = tool.availability === 'preview';

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <span className={styles.titleRow}>
          <span className={styles.title}>{metadata.name[locale]}</span>
          {isPreview ? <PreviewBadge /> : null}
        </span>
      }
      icon={
        <span className={styles.iconSurface}>
          <AppIcon name={metadata.icon} />
        </span>
      }
      actions={
        <div className={styles.actions}>
          <Button variant="text" onClick={onClose} data-autofocus>
            {t('common:actions.close')}
          </Button>
          <Button variant="filled" onClick={() => onNavigate(metadata.id)}>
            {t('common:actions.goToTool')}
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <p className={styles.eyebrow}>{t('navigation:toolDialogEyebrow')}</p>
        <p className={styles.description}>{metadata.summary[locale]}</p>
        {isPreview ? (
          <p className={styles.previewNote}>{t('catalog:tool.previewBody')}</p>
        ) : null}
        <dl className={styles.metadata}>
          <div>
            <dt>{t('navigation:toolCategoryLabel')}</dt>
            <dd>
              <MetadataChip label={categoryLabel} />
              {category ? <span>{category.description[locale]}</span> : null}
            </dd>
          </div>
          <div>
            <dt>{t('navigation:toolInputLabel')}</dt>
            <dd>
              <span>{metadata.preview.inputLabel[locale]}</span>
              <code>{metadata.preview.sampleInput[locale]}</code>
            </dd>
          </div>
          <div>
            <dt>{metadata.preview.workspaceTitle[locale]}</dt>
            <dd>
              <ul>
                {metadata.preview.workspaceLines.map((line) => (
                  <li key={`${line.label[locale]}-${line.value}`}>
                    {line.label[locale]}
                    <span aria-hidden="true"> {line.value}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
