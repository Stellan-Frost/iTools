import { Button, Card } from '@itools/design-system-adapter';
import type { RegistryEntry } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolCard.module.css';

interface ToolCardProps {
  tool: RegistryEntry;
  categoryName: string;
  onOpen: () => void;
}

export function ToolCard({ tool, categoryName, onOpen }: ToolCardProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation(['catalog', 'common']);
  const metadata = tool.metadata;

  return (
    <Card>
      <article className={styles.card}>
        <div className={styles.iconWrap}>
          <AppIcon name={metadata.icon} />
        </div>
        <div className={styles.copy}>
          <div className={styles.heading}>
            <h3>{metadata.name[locale]}</h3>
            <MetadataChip label={categoryName} />
            {tool.availability === 'preview' ? (
              <MetadataChip label={t('catalog:tool.previewBadge')} />
            ) : null}
          </div>
          <p>{metadata.summary[locale]}</p>
          <Button variant="text" onClick={onOpen}>
            {t('catalog:actions.openTool')}
          </Button>
        </div>
      </article>
    </Card>
  );
}
