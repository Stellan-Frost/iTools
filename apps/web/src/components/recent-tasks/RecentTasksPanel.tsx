import { useEffect, useRef } from 'react';
import { Button } from '@itools/design-system-adapter';
import { sampleTasks } from '../../data/sample-catalog.js';
import styles from './RecentTasksPanel.module.css';

interface RecentTasksPanelProps {
  onClose: () => void;
  onOpenTool: (toolId: string) => void;
  onViewAll: () => void;
}

export function RecentTasksPanel({
  onClose,
  onOpenTool,
  onViewAll,
}: RecentTasksPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      )
        onClose();
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      id="recent-tasks-panel"
      role="dialog"
      aria-label="最近任务样本"
    >
      <div className={styles.heading}>
        <div>
          <h2>最近任务</h2>
          <p>样本数据 · 未连接真实任务</p>
        </div>
        <Button variant="text" onClick={onClose} aria-label="关闭最近任务面板">
          关闭
        </Button>
      </div>
      <ul className={styles.taskList}>
        {sampleTasks.map((task) => (
          <li key={task.id}>
            <Button
              className={styles.taskButton}
              variant="text"
              startIcon={
                <span className={styles.statusDot} aria-hidden="true" />
              }
              onClick={() => onOpenTool(task.toolId)}
            >
              <span className={styles.taskCopy}>
                <span className={styles.taskTitle}>{task.title}</span>
                <span className={styles.taskMeta}>
                  {task.status} · {task.timeLabel}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <Button className={styles.viewAll} variant="outlined" onClick={onViewAll}>
        查看全部样本
      </Button>
    </section>
  );
}
