import {
  Card,
  Chip,
  CircularProgressIndicator,
  LinearProgressIndicator,
} from '@itools/design-system-adapter';
import type { ToolDefinition } from '../../data/sample-catalog.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import styles from './ToolPage.module.css';

interface WorkspaceSampleProps {
  tool: ToolDefinition;
}

export function WorkspaceSample({ tool }: WorkspaceSampleProps) {
  return (
    <section aria-labelledby="tool-workspace-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>02</span>
        <div>
          <h2 id="tool-workspace-heading">主工作区</h2>
          <p>展示工具主要内容的布局位置，不运行样本内容。</p>
        </div>
      </div>
      <Card>
        <div className={styles.workspace}>
          <div className={styles.workspaceHeader}>
            <div>
              <p className={styles.sampleLabel}>WORKSPACE SAMPLE</p>
              <h3>{tool.workspaceTitle}</h3>
            </div>
            <Chip label="预览数据" />
          </div>
          <pre
            className={styles.workspacePreview}
            aria-label={`${tool.title}工作区样本`}
          >
            {tool.workspaceLines.join('\n')}
          </pre>
          <p className={styles.workspaceFootnote}>
            这块区域用于说明工作区比例和信息层级，当前没有实际运行。
          </p>
        </div>
      </Card>
    </section>
  );
}

export function TaskStatusSample() {
  return (
    <section aria-labelledby="tool-task-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>03</span>
        <div>
          <h2 id="tool-task-heading">任务状态样本</h2>
          <p>未来运行时会在这里显示排队、进度、取消和失败状态。</p>
        </div>
      </div>
      <Card>
        <div className={styles.taskSample}>
          <div className={styles.taskHeading}>
            <span className={styles.taskIcon}>
              <AppIcon name="hourglass_top" />
            </span>
            <div>
              <h3>处理任务状态样本</h3>
              <p>演示任务 · 未加入队列</p>
            </div>
            <Chip label="等待中" />
          </div>
          <div className={styles.progressRow}>
            <LinearProgressIndicator
              value={0.42}
              aria-label="任务进度状态样本"
            />
            <span>42%</span>
          </div>
          <p className={styles.taskFootnote}>
            进度条仅作为组件布局样本，数值不代表真实任务进度。
          </p>
        </div>
      </Card>
    </section>
  );
}

export function ResultSample() {
  return (
    <section aria-labelledby="tool-result-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>04</span>
        <div>
          <h2 id="tool-result-heading">结果</h2>
          <p>呈现成功、错误、下载等结果内容的统一区域。</p>
        </div>
      </div>
      <Card>
        <div className={styles.resultSample}>
          <CircularProgressIndicator
            value={0.7}
            aria-label="结果状态组件样本"
          />
          <div>
            <Chip label="结果展示样本" />
            <h3>尚无处理结果</h3>
            <p>
              真实工具运行和结果保存尚未接入，因此不会在这里生成文件或输出。
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
