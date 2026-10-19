import { Button, Card } from '@itools/design-system-adapter';
import {
  CATEGORIES,
  getCategory,
  listEnabledTools,
  listEnabledToolsByCategory,
} from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { CategoryCard } from '../../components/catalog/CategoryCard.js';
import { ToolCard } from '../../components/catalog/ToolCard.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { ToolSearchEntry } from '../../components/tool-search-entry/ToolSearchEntry.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './HomePage.module.css';

export function HomePage() {
  const { locale, navigate, openSearch } = useAppNavigation();
  const { t } = useTranslation(['catalog', 'common']);

  const enabledTools = listEnabledTools();
  const firstCategory =
    CATEGORIES.find(
      (category) => listEnabledToolsByCategory(category.id).length > 0,
    ) ?? CATEGORIES[0]!;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t('catalog:home.eyebrow')}</p>
          <h1 id="home-title">{t('catalog:home.title')}</h1>
          <p className={styles.intro}>{t('catalog:home.intro')}</p>
          <div className={styles.heroActions}>
            <ToolSearchEntry onOpenSearch={openSearch} />
            <Button
              variant="text"
              style={{ color: 'var(--md-sys-color-on-primary-container)' }}
              onClick={() =>
                navigate({ page: 'category', categoryId: firstCategory.id })
              }
            >
              {t('catalog:actions.startFromCategory')}
            </Button>
          </div>
        </div>
        <div className={styles.heroArtwork} aria-hidden="true">
          <div className={styles.artworkMain}>
            <span className={styles.artworkSymbol}>
              <AppIcon name="auto_awesome" />
            </span>
            <span className={styles.artworkLine} />
            <span className={styles.artworkLineShort} />
          </div>
          <div className={styles.artworkOrb} />
          <div className={styles.artworkNote}>
            {t('catalog:home.artworkNote')}
          </div>
        </div>
      </section>

      <section
        className={styles.summary}
        aria-label={t('catalog:home.summaryLabel')}
      >
        <MetadataChip
          label={t('catalog:home.categoryCount', {
            total: CATEGORIES.length,
          })}
        />
        <MetadataChip
          label={t('catalog:home.toolCount', { total: enabledTools.length })}
        />
        <MetadataChip label={t('catalog:home.realRuns')} />
      </section>

      <section className={styles.section} aria-labelledby="category-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>
              {t('catalog:home.browseKicker')}
            </p>
            <h2 id="category-heading">{t('catalog:home.categoryTitle')}</h2>
          </div>
          <Button
            variant="text"
            onClick={() =>
              navigate({ page: 'category', categoryId: firstCategory.id })
            }
          >
            {t('catalog:home.categoryAction')}
          </Button>
        </div>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              toolCount={listEnabledToolsByCategory(category.id).length}
              onOpen={() =>
                navigate({ page: 'category', categoryId: category.id })
              }
            />
          ))}
        </div>
      </section>

      <section className={styles.featured} aria-labelledby="featured-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>
              {t('catalog:home.featuredKicker')}
            </p>
            <h2 id="featured-heading">{t('catalog:home.featuredTitle')}</h2>
          </div>
          <MetadataChip label={t('catalog:home.featuredCaption')} />
        </div>
        <div className={styles.toolGrid}>
          {enabledTools.map((tool) => {
            const category = getCategory(tool.categoryId);
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                categoryName={
                  category ? category.name[locale] : tool.categoryId
                }
                onOpen={() => navigate({ page: 'tool', toolId: tool.id })}
              />
            );
          })}
        </div>
      </section>

      <Card>
        <aside className={styles.privacyNote}>
          <AppIcon name="shield_lock" />
          <div>
            <h2>{t('catalog:home.privacyTitle')}</h2>
            <p>{t('catalog:home.privacyBody')}</p>
          </div>
        </aside>
      </Card>
    </div>
  );
}
