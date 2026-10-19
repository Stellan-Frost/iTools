import { Button, Dialog } from '@itools/design-system-adapter';
import { getCategory, type CatalogTool } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolInfoDialog.module.css';

interface ToolInfoDialogProps {
  tool: CatalogTool | null;
  onClose: () => void;
  onNavigate: (toolId: string) => void;
}

export function ToolInfoDialog({
  tool,
  onClose,
  onNavigate,
}: ToolInfoDialogProps) {
  const { t } = useTranslation(['common', 'navigation']);
  const { locale } = useAppNavigation();

  if (!tool) return null;

  const category = getCategory(tool.categoryId);
  const categoryLabel = category?.name[locale] ?? '';

  return (
    <Dialog
      open
      onClose={onClose}
      title={<span className={styles.title}>{tool.name[locale]}</span>}
      icon={
        <span className={styles.iconSurface}>
          <AppIcon name={tool.icon} />
        </span>
      }
      actions={
        <div className={styles.actions}>
          <Button variant="text" onClick={onClose} data-autofocus>
            {t('common:actions.close')}
          </Button>
          <Button variant="filled" onClick={() => onNavigate(tool.id)}>
            {t('common:actions.goToTool')}
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <p className={styles.eyebrow}>{t('navigation:toolDialogEyebrow')}</p>
        <p className={styles.description}>{tool.summary[locale]}</p>
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
              <span>{tool.preview.inputLabel[locale]}</span>
              <code>{tool.preview.sampleInput[locale]}</code>
            </dd>
          </div>
          <div>
            <dt>{tool.preview.workspaceTitle[locale]}</dt>
            <dd>
              <ul>
                {tool.preview.workspaceLines.map((line) => (
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
