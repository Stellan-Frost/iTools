import { Card, Switch } from '@itools/design-system-adapter';
import { getCategory, listTools } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './AdminPage.module.css';

interface AdminCatalogSectionProps {
  enabledTools: Readonly<Record<string, boolean>>;
  onToggleTool: (toolId: string, isEnabled: boolean) => void;
}

export function AdminCatalogSection({
  enabledTools,
  onToggleTool,
}: AdminCatalogSectionProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation(['admin', 'common']);
  const tools = listTools();

  return (
    <section
      className={styles.catalogSection}
      aria-labelledby="catalog-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p>{t('admin:catalog.kicker')}</p>
          <h2 id="catalog-heading">{t('admin:catalog.title')}</h2>
        </div>
        <MetadataChip
          label={t('admin:catalog.count', { total: tools.length })}
        />
      </div>
      <Card>
        <ul className={styles.catalogList}>
          {tools.map((tool) => {
            const metadata = tool.metadata;
            const category = getCategory(metadata.category);
            const active =
              enabledTools[metadata.id] ?? tool.availability !== 'disabled';

            return (
              <li key={metadata.id} className={styles.catalogRow}>
                <span className={styles.toolIcon}>
                  <AppIcon name={metadata.icon} />
                </span>
                <span className={styles.toolDetails}>
                  <strong>{metadata.name[locale]}</strong>
                  <span>
                    <MetadataChip
                      label={
                        category ? category.name[locale] : metadata.category
                      }
                    />
                    <MetadataChip
                      label={
                        tool.availability === 'disabled'
                          ? t('common:availability.unavailable')
                          : t('common:availability.preview')
                      }
                    />
                  </span>
                </span>
                <Switch
                  selected={active}
                  aria-label={t('admin:catalog.toggleLabel', {
                    name: metadata.name[locale],
                  })}
                  onChange={(_event, selected) => {
                    onToggleTool(metadata.id, selected);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className={styles.helper}>{t('admin:catalog.helper')}</p>
    </section>
  );
}
