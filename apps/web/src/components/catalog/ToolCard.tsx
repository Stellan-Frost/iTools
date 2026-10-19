import { Button, Card } from '@itools/design-system-adapter';
import type { CatalogTool } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolCard.module.css';

interface ToolCardProps {
  tool: CatalogTool;
  categoryName: string;
  onOpen: () => void;
}

export function ToolCard({ tool, categoryName, onOpen }: ToolCardProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');

  return (
    <Card>
      <article className={styles.card}>
        <div className={styles.iconWrap}>
          <AppIcon name={tool.icon} />
        </div>
        <div className={styles.copy}>
          <div className={styles.heading}>
            <h3>{tool.name[locale]}</h3>
            <MetadataChip label={categoryName} />
          </div>
          <p>{tool.summary[locale]}</p>
          <Button variant="text" onClick={onOpen}>
            {t('actions.openTool')}
          </Button>
        </div>
      </article>
    </Card>
  );
}
