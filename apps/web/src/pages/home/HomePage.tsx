import { Button, Card } from '@itools/design-system-adapter';
import {
  categories,
  getToolsForCategory,
  tools,
} from '../../data/sample-catalog.js';
import type { AppRoute } from '../../app/route.js';
import { CategoryCard } from '../../components/catalog/CategoryCard.js';
import { ToolCard } from '../../components/catalog/ToolCard.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import styles from './HomePage.module.css';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
  onOpenSearch: () => void;
}

export function HomePage({ onNavigate, onOpenSearch }: HomePageProps) {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>iTools · 清晰、轻快的工具入口</p>
          <h1 id="home-title">把日常小工具，放在一个清楚的地方。</h1>
          <p className={styles.intro}>
            浏览分类目录与统一的工具页面样本。所有内容都用于展示界面结构，当前不会处理文件或保存任务。
          </p>
          <div className={styles.heroActions}>
            <Button
              variant="filled"
              startIcon={<AppIcon name="search" />}
              onClick={onOpenSearch}
            >
              搜索工具
            </Button>
            <Button
              variant="text"
              style={{ color: 'var(--md-sys-color-on-primary-container)' }}
              onClick={() =>
                onNavigate({ page: 'category', categoryId: 'image' })
              }
            >
              从分类开始
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
          <div className={styles.artworkNote}>LOCAL · PREVIEW</div>
        </div>
      </section>

      <section className={styles.summary} aria-label="预览目录摘要">
        <MetadataChip label={`${categories.length} 个样本分类`} />
        <MetadataChip label={`${tools.length} 个样本界面`} />
        <MetadataChip label="0 次真实处理" />
      </section>

      <section className={styles.section} aria-labelledby="category-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>BROWSE</p>
            <h2 id="category-heading">按分类浏览</h2>
          </div>
          <Button
            variant="text"
            onClick={() =>
              onNavigate({ page: 'category', categoryId: categories[0]!.id })
            }
          >
            查看分类样本
          </Button>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              toolCount={getToolsForCategory(category.id).length}
              onOpen={() =>
                onNavigate({ page: 'category', categoryId: category.id })
              }
            />
          ))}
        </div>
      </section>

      <section className={styles.featured} aria-labelledby="featured-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>SAMPLE TOOLBOX</p>
            <h2 id="featured-heading">常用工具界面样本</h2>
          </div>
          <MetadataChip label="预览数据 · 不代表真实目录" />
        </div>
        <div className={styles.toolGrid}>
          {tools.slice(0, 3).map((tool) => {
            const category = categories.find(
              (entry) => entry.id === tool.categoryId,
            );
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                categoryName={category?.name ?? '样本分类'}
                onOpen={() => onNavigate({ page: 'tool', toolId: tool.id })}
              />
            );
          })}
        </div>
      </section>

      <Card>
        <aside className={styles.privacyNote}>
          <AppIcon name="shield_lock" />
          <div>
            <h2>本地界面预览</h2>
            <p>
              示例输入、任务和结果仅用于查看页面布局；没有数据库、真实工具处理或管理员认证。
            </p>
          </div>
        </aside>
      </Card>
    </div>
  );
}
