import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CircularProgressIndicator,
} from '@itools/design-system-adapter';
import { getCategory } from '@itools/app-core';
import type { Locale, ToolCatalogItem } from '@itools/contracts';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import styles from './AdminPage.module.css';

export interface AdminToolListProps {
  readonly tools: readonly ToolCatalogItem[];
  readonly selectedToolId: string | undefined;
  readonly locale: Locale;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly onSelect: (toolId: string) => void;
}

export function AdminToolList({
  tools,
  selectedToolId,
  locale,
  isLoading,
  hasError,
  onSelect,
}: AdminToolListProps) {
  const { t } = useTranslation(['admin', 'common']);

  return (
    <section
      className={styles.listSection}
      aria-labelledby="admin-tools-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>{t('admin:tools.kicker')}</p>
          <h2 id="admin-tools-heading" className={styles.sectionTitle}>
            {t('admin:tools.title')}
          </h2>
        </div>
        <MetadataChip label={t('admin:tools.count', { total: tools.length })} />
      </div>
      <Card>
        {isLoading ? (
          <div className={styles.listStatus}>
            <CircularProgressIndicator aria-label={t('admin:tools.loading')} />
            <span>{t('admin:tools.loading')}</span>
          </div>
        ) : null}
        {!isLoading && hasError ? (
          <p className={styles.errorText} role="alert">
            {t('admin:tools.loadError')}
          </p>
        ) : null}
        {!isLoading && !hasError && tools.length === 0 ? (
          <p className={styles.muted}>{t('admin:tools.empty')}</p>
        ) : null}
        {tools.length > 0 ? (
          <ul className={styles.toolList}>
            {tools.map((tool) => {
              const category = getCategory(tool.category);
              const isSelected = tool.id === selectedToolId;
              return (
                <li key={tool.id} className={styles.toolRow}>
                  <Button
                    variant={isSelected ? 'tonal' : 'text'}
                    className={styles.toolButton}
                    aria-pressed={isSelected}
                    aria-label={t('admin:tools.selectLabel', {
                      name: tool.name[locale],
                    })}
                    onClick={() => onSelect(tool.id)}
                  >
                    <span className={styles.toolCopy}>
                      <strong>{tool.name[locale]}</strong>
                      <span className={styles.toolMeta}>
                        <MetadataChip
                          label={
                            category ? category.name[locale] : tool.category
                          }
                        />
                        <MetadataChip
                          label={
                            tool.availability === 'disabled'
                              ? t('common:availability.unavailable')
                              : t('admin:tools.enabled')
                          }
                        />
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
