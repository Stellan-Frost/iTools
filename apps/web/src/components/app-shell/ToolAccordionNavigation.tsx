import {
  CATEGORIES,
  listEnabledToolsByCategory,
  type CategoryId,
} from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import { AppIcon } from '../app-icon/AppIcon.js';
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
      <button
        className={styles.home}
        type="button"
        onClick={onNavigateHome}
        aria-label={t('home')}
      >
        <span className={styles.categoryIcon}>
          <AppIcon name="home" />
        </span>
        <span>{t('home')}</span>
      </button>

      {CATEGORIES.map((category) => {
        const isExpanded = expandedCategoryIds.has(category.id);
        const toolListId = `tool-list-${category.id}`;
        const categoryName = category.name[locale];
        const categoryTools = listEnabledToolsByCategory(category.id);

        return (
          <section
            className={styles.categoryGroup}
            key={category.id}
            data-expanded={isExpanded}
          >
            <button
              className={styles.categoryTrigger}
              type="button"
              aria-expanded={isExpanded}
              aria-controls={toolListId}
              onClick={() => onToggleCategory(category.id)}
            >
              <span className={styles.categoryIcon}>
                <AppIcon name={category.icon} />
              </span>
              <span className={styles.categoryLabel}>{categoryName}</span>
              <span className={styles.chevron}>
                <AppIcon name="expand_more" />
              </span>
            </button>
            <ul
              className={styles.toolList}
              id={toolListId}
              aria-label={t('categoryTools', { category: categoryName })}
              aria-hidden={!isExpanded}
              inert={!isExpanded}
              data-expanded={isExpanded}
            >
              {categoryTools.length > 0 ? (
                categoryTools.map((tool) => (
                  <li key={tool.id}>
                    <button
                      className={styles.toolItem}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => onOpenTool(tool.id)}
                    >
                      <span className={styles.toolIcon}>
                        <AppIcon name={tool.icon} />
                      </span>
                      <span className={styles.toolLabel}>
                        {tool.name[locale]}
                      </span>
                    </button>
                  </li>
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
