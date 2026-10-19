import {
  CATEGORIES,
  listVisibleByCategory,
  type CategoryId,
} from '@itools/app-core';
import { ListItem } from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { PreviewBadge } from '../page-chrome/PreviewBadge.js';
import styles from './ToolAccordionNavigation.module.css';

export interface ToolAccordionNavigationProps {
  expandedCategoryIds: ReadonlySet<CategoryId>;
  onToggleCategory: (categoryId: CategoryId) => void;
  onNavigateHome: () => void;
  onOpenTool: (toolId: string) => void;
}

export function ToolAccordionNavigation({
  expandedCategoryIds,
  onToggleCategory,
  onNavigateHome,
  onOpenTool,
}: ToolAccordionNavigationProps) {
  const { t } = useTranslation('navigation');
  const { locale } = useAppNavigation();

  return (
    <nav className={styles.root} aria-label={t('categoriesLabel')}>
      <ul className={styles.plainList}>
        <ListItem
          headline={t('home')}
          leading={
            <span className={styles.categoryIcon}>
              <AppIcon name="home" />
            </span>
          }
          onClick={onNavigateHome}
        />
      </ul>

      {CATEGORIES.map((category) => {
        const isExpanded = expandedCategoryIds.has(category.id);
        const toolListId = `tool-list-${category.id}`;
        const categoryName = category.name[locale];
        const categoryTools = listVisibleByCategory(category.id);

        return (
          <section
            className={styles.categoryGroup}
            key={category.id}
            data-expanded={isExpanded}
          >
            <ul className={styles.plainList}>
              <ListItem
                headline={categoryName}
                selected={isExpanded}
                leading={
                  <span className={styles.categoryIcon}>
                    <AppIcon name={category.icon} />
                  </span>
                }
                trailing={
                  <span className={styles.chevron}>
                    <AppIcon name="expand_more" />
                  </span>
                }
                aria-expanded={isExpanded}
                aria-controls={toolListId}
                onClick={() => onToggleCategory(category.id)}
              />
            </ul>
            <ul
              className={styles.toolList}
              id={toolListId}
              aria-label={t('categoryTools', { category: categoryName })}
              aria-hidden={!isExpanded}
              inert={!isExpanded}
              data-expanded={isExpanded}
            >
              {categoryTools.length > 0 ? (
                categoryTools.map((entry) => (
                  <ListItem
                    key={entry.metadata.id}
                    headline={
                      <span className={styles.toolLabel}>
                        {entry.metadata.name[locale]}
                        {entry.availability === 'preview' ? (
                          <PreviewBadge />
                        ) : null}
                      </span>
                    }
                    leading={
                      <span className={styles.toolIcon}>
                        <AppIcon name={entry.metadata.icon} />
                      </span>
                    }
                    aria-haspopup="dialog"
                    onClick={() => onOpenTool(entry.metadata.id)}
                  />
                ))
              ) : (
                <li className={styles.emptyState}>{t('emptyCategory')}</li>
              )}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
