import { Card, Button } from '@itools/design-system-adapter';
import type { ToolCategory } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './CategoryCard.module.css';

interface CategoryCardProps {
  category: ToolCategory;
  toolCount: number;
  onOpen: () => void;
}

export function CategoryCard({
  category,
  toolCount,
  onOpen,
}: CategoryCardProps) {
  return (
    <Card>
      <article className={styles.card}>
        <div className={styles.iconWrap}>
          <AppIcon name={category.icon} />
        </div>
        <p className={styles.count}>{toolCount} 个工具 · 样本目录</p>
        <h3>{category.name}</h3>
        <p className={styles.description}>{category.description}</p>
        <Button variant="text" onClick={onOpen}>
          浏览分类
        </Button>
      </article>
    </Card>
  );
}
