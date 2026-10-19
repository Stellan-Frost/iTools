import { Button, Chip } from '@itools/design-system-adapter';
import type { AppRoute } from '../../app/route.js';
import { categories, getTool } from '../../data/sample-catalog.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { ToolInputSection } from './ToolInputSection.js';
import {
  ResultSample,
  TaskStatusSample,
  WorkspaceSample,
} from './ToolPreviewSections.js';
import styles from './ToolPage.module.css';

interface ToolPageProps {
  toolId: string;
  onNavigate: (route: AppRoute) => void;
}

export function ToolPage({ toolId, onNavigate }: ToolPageProps) {
  const tool = getTool(toolId);
  if (!tool) {
    return (
      <div className={styles.page}>
        <PageHeading
          title="工具界面样本不存在"
          description="该工具不在当前预览目录中。"
        />
        <Button variant="filled" onClick={() => onNavigate({ page: 'home' })}>
          返回首页
        </Button>
      </div>
    );
  }

  const category = categories.find((entry) => entry.id === tool.categoryId);

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={`${category?.name ?? '工具'} · 工具界面预览`}
        title={tool.title}
        description={tool.summary}
        actions={<Chip label="尚未接入执行" />}
      />
      <PreviewNotice>
        本页展示统一工具流程样本。输入、任务状态和结果都不会提交或执行。
      </PreviewNotice>
      <div className={styles.sections}>
        <ToolInputSection tool={tool} />
        <WorkspaceSample tool={tool} />
        <TaskStatusSample />
        <ResultSample />
      </div>
      <footer className={styles.attribution}>
        <p>设计语义参考 Material Design 3 · 组件来源由统一适配层管理。</p>
        <p>本项目开放源码致谢样本 · 当前为阶段 2 界面预览。</p>
      </footer>
    </div>
  );
}
