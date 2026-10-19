import { Button, Card, Chip } from '@itools/design-system-adapter';
import type { AppRoute } from '../../app/route.js';
import { sampleTasks } from '../../data/sample-catalog.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import styles from './TasksPage.module.css';

interface TasksPageProps {
  onNavigate: (route: AppRoute) => void;
}

export function TasksPage({ onNavigate }: TasksPageProps) {
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="任务管理 · 界面预览"
        title="最近任务样本"
        description="查看任务列表、状态标签和回到工具的入口。当前没有实际运行记录。"
      />
      <PreviewNotice>
        下列任务是静态样本，用于展示任务管理页面，不是用户真实历史。
      </PreviewNotice>
      <Card>
        <div className={styles.listHeader}>
          <h2>任务列表</h2>
          <span>样本 {sampleTasks.length} 条</span>
        </div>
        <ul className={styles.taskList}>
          {sampleTasks.map((task) => (
            <li key={task.id}>
              <div className={styles.taskIcon}>
                <AppIcon name="task_alt" />
              </div>
              <div className={styles.taskDetails}>
                <strong>{task.title}</strong>
                <span>
                  {task.category} · {task.timeLabel}
                </span>
              </div>
              <Chip label={task.status} />
              <Button
                variant="text"
                onClick={() =>
                  onNavigate({ page: 'tool', toolId: task.toolId })
                }
              >
                打开预览
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
