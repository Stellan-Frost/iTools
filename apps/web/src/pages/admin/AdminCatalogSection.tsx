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
  const { t } = useTranslation('admin');
  const tools = listTools();

  return (
    <section
      className={styles.catalogSection}
      aria-labelledby="catalog-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p>{t('catalog.kicker')}</p>
          <h2 id="catalog-heading">{t('catalog.title')}</h2>
        </div>
        <MetadataChip label={t('catalog.count', { total: tools.length })} />
      </div>
      <Card>
        <ul className={styles.catalogList}>
          {tools.map((tool) => {
            const category = getCategory(tool.categoryId);
            const active = enabledTools[tool.id] ?? tool.enabled;

            return (
              <li key={tool.id} className={styles.catalogRow}>
                <span className={styles.toolIcon}>
                  <AppIcon name={tool.icon} />
                </span>
                <span className={styles.toolDetails}>
                  <strong>{tool.name[locale]}</strong>
                  <span>
                    <MetadataChip
                      label={category ? category.name[locale] : tool.categoryId}
                    />
                    <MetadataChip
                      label={
                        active ? t('catalog.enabled') : t('catalog.disabled')
                      }
                    />
                  </span>
                </span>
                <Switch
                  selected={active}
                  aria-label={t('catalog.toggleLabel', {
                    name: tool.name[locale],
                  })}
                  onChange={(_event, selected) => {
                    onToggleTool(tool.id, selected);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className={styles.helper}>{t('catalog.helper')}</p>
    </section>
  );
}
