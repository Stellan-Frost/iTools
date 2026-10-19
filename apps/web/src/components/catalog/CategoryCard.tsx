import { Button, Card } from '@itools/design-system-adapter';
import type { CatalogCategory } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './CategoryCard.module.css';

interface CategoryCardProps {
  category: CatalogCategory;
  toolCount: number;
  onOpen: () => void;
}

export function CategoryCard({
  category,
  toolCount,
  onOpen,
}: CategoryCardProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');

  return (
    <Card>
      <article className={styles.card}>
        <div className={styles.iconWrap}>
          <AppIcon name={category.icon} />
        </div>
        <MetadataChip label={t('card.toolCount', { total: toolCount })} />
        <h3>{category.name[locale]}</h3>
        <p className={styles.description}>{category.description[locale]}</p>
        <Button variant="text" onClick={onOpen}>
          {t('actions.browseCategory')}
        </Button>
      </article>
    </Card>
  );
}
