import { Card, Switch } from '@itools/design-system-adapter';
import { categories, tools } from '../../data/sample-catalog.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import styles from './AdminPage.module.css';

interface AdminCatalogSectionProps {
  enabledTools: Readonly<Record<string, boolean>>;
  onToggleTool: (toolId: string, isEnabled: boolean) => void;
}

export function AdminCatalogSection({
  enabledTools,
  onToggleTool,
}: AdminCatalogSectionProps) {
  return (
    <section
      className={styles.catalogSection}
      aria-labelledby="catalog-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p>CATALOG PREVIEW</p>
          <h2 id="catalog-heading">工具目录样本</h2>
        </div>
        <MetadataChip label={`${tools.length} 项`} />
      </div>
      <Card>
        <ul className={styles.catalogList}>
          {tools.slice(0, 4).map((tool) => {
            const category = categories.find(
              (entry) => entry.id === tool.categoryId,
            );
            const active = enabledTools[tool.id] ?? false;
            return (
              <li key={tool.id} className={styles.catalogRow}>
                <span className={styles.toolIcon}>
                  <AppIcon name={tool.icon} />
                </span>
                <span className={styles.toolDetails}>
                  <strong>{tool.title}</strong>
                  <span>
                    <MetadataChip label={category?.name ?? '样本分类'} />
                    <MetadataChip label={active ? '启用样本' : '停用样本'} />
                  </span>
                </span>
                <Switch
                  selected={active}
                  aria-label={`切换${tool.title}样本状态`}
                  onChange={(_event, selected) => {
                    onToggleTool(tool.id, selected);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className={styles.helper}>
        状态开关只用于查看交互状态，目录数据不会持久化。
      </p>
    </section>
  );
}
