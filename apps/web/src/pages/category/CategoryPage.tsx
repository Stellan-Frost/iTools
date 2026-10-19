import { Button } from '@itools/design-system-adapter';
import {
  CATEGORIES,
  getCategory,
  listEnabledToolsByCategory,
  type CategoryId,
} from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { ToolCard } from '../../components/catalog/ToolCard.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './CategoryPage.module.css';

interface CategoryPageProps {
  categoryId: CategoryId;
}

export function CategoryPage({ categoryId }: CategoryPageProps) {
  const { locale, navigate } = useAppNavigation();
  const { t } = useTranslation(['catalog', 'common']);

  const category = getCategory(categoryId);
  const categoryTools = listEnabledToolsByCategory(categoryId);

  if (!category) {
    return (
      <div className={styles.page}>
        <PageHeading
          title={t('catalog:category.notFoundTitle')}
          description={t('catalog:category.notFoundBody')}
        />
        <Button variant="filled" onClick={() => navigate({ page: 'home' })}>
          {t('common:actions.backHome')}
        </Button>
      </div>
    );
  }

  const anotherCategory = CATEGORIES.find(
    (entry) =>
      entry.id !== categoryId &&
      listEnabledToolsByCategory(entry.id).length > 0,
  );

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('catalog:category.eyebrow')}
        title={category.name[locale]}
        description={category.description[locale]}
        actions={
          <MetadataChip
            label={t('catalog:category.count', {
              total: categoryTools.length,
            })}
          />
        }
      />
      <PreviewNotice>{t('catalog:category.notice')}</PreviewNotice>
      {categoryTools.length > 0 ? (
        <section
          className={styles.list}
          aria-label={t('catalog:category.listLabel', {
            category: category.name[locale],
          })}
        >
          {categoryTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              categoryName={category.name[locale]}
              onOpen={() => navigate({ page: 'tool', toolId: tool.id })}
            />
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <h2>{t('catalog:category.emptyTitle')}</h2>
          <p>{t('catalog:category.emptyBody')}</p>
          <Button
            variant="outlined"
            onClick={() =>
              navigate({
                page: 'category',
                categoryId: anotherCategory?.id ?? categoryId,
              })
            }
          >
            {t('catalog:actions.browseOtherCategory')}
          </Button>
        </div>
      )}
    </div>
  );
}
