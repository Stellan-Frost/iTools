import { Button } from '@itools/design-system-adapter';
import type { AppRoute } from '../../app/route.js';
import {
  categories,
  getCategory,
  getToolsForCategory,
} from '../../data/sample-catalog.js';
import { ToolCard } from '../../components/catalog/ToolCard.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import styles from './CategoryPage.module.css';

interface CategoryPageProps {
  categoryId: string;
  onNavigate: (route: AppRoute) => void;
}

export function CategoryPage({ categoryId, onNavigate }: CategoryPageProps) {
  const category = getCategory(categoryId);
  const categoryTools = getToolsForCategory(categoryId);

  if (!category) {
    return (
      <div className={styles.page}>
        <PageHeading
          title="分类样本不存在"
          description="这个分类不在当前界面预览目录中。"
        />
        <Button variant="filled" onClick={() => onNavigate({ page: 'home' })}>
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="工具分类 · 界面预览"
        title={category.name}
        description={category.description}
        actions={
          <span className={styles.count}>
            {categoryTools.length} 个样本工具
          </span>
        }
      />
      <PreviewNotice>
        以下内容是用于展示目录浏览方式的样本，不代表已接入真实工具。
      </PreviewNotice>
      {categoryTools.length > 0 ? (
        <section
          className={styles.list}
          aria-label={`${category.name}工具样本`}
        >
          {categoryTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              categoryName={category.name}
              onOpen={() => onNavigate({ page: 'tool', toolId: tool.id })}
            />
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <h2>此分类暂时没有样本工具</h2>
          <p>分类结构仍可查看；之后可以在此呈现已实现的工具。</p>
          <Button
            variant="outlined"
            onClick={() =>
              onNavigate({ page: 'category', categoryId: categories[0]!.id })
            }
          >
            浏览其他分类
          </Button>
        </div>
      )}
    </div>
  );
}
