import { categories, getToolsForCategory } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './ToolAccordionNavigation.module.css';

export interface ToolAccordionNavigationProps {
  expandedCategoryIds: ReadonlySet<string>;
  onToggleCategory: (categoryId: string) => void;
  onNavigateHome: () => void;
  onOpenTool: (toolId: string) => void;
}

export function ToolAccordionNavigation({
  expandedCategoryIds,
  onToggleCategory,
  onNavigateHome,
  onOpenTool,
}: ToolAccordionNavigationProps) {
  return (
    <nav className={styles.root} aria-label="工具分类">
      <button
        className={styles.home}
        type="button"
        onClick={onNavigateHome}
        aria-label="首页"
      >
        <span className={styles.categoryIcon}>
          <AppIcon name="home" />
        </span>
        <span>首页</span>
      </button>

      {categories.map((category) => {
        const isExpanded = expandedCategoryIds.has(category.id);
        const toolListId = `tool-list-${category.id}`;
        const categoryTools = getToolsForCategory(category.id);

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
              <span className={styles.categoryLabel}>{category.name}</span>
              <span className={styles.chevron}>
                <AppIcon name="expand_more" />
              </span>
            </button>
            <ul
              className={styles.toolList}
              id={toolListId}
              aria-label={`${category.name}中的工具`}
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
                      <span className={styles.toolLabel}>{tool.title}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className={styles.emptyState}>暂无样本工具</li>
              )}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
