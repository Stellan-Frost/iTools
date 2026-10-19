import { useEffect, useRef } from 'react';
import { Button } from '@itools/design-system-adapter';
import { findTool, SAMPLE_TASKS } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './RecentTasksPanel.module.css';

interface RecentTasksPanelProps {
  onClose: () => void;
}

export function RecentTasksPanel({ onClose }: RecentTasksPanelProps) {
  const { t } = useTranslation(['common', 'navigation']);
  const { locale, navigate } = useAppNavigation();
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
      aria-label={t('navigation:recentTasksTitle')}
    >
      <div className={styles.heading}>
        <div>
          <h2>{t('common:recentTasks')}</h2>
          <p>{t('navigation:tasksSampleNote')}</p>
        </div>
        <Button
          variant="text"
          onClick={onClose}
          aria-label={t('navigation:closeRecentTasks')}
        >
          {t('common:actions.close')}
        </Button>
      </div>
      <ul className={styles.taskList}>
        {SAMPLE_TASKS.map((task) => {
          const tool = findTool(task.toolId);

          return (
            <li key={task.id}>
              <Button
                className={styles.taskButton}
                variant="text"
                startIcon={
                  <span className={styles.statusDot} aria-hidden="true" />
                }
                onClick={() => {
                  navigate({ page: 'tool', toolId: task.toolId });
                  onClose();
                }}
              >
                <span className={styles.taskCopy}>
                  <span className={styles.taskTitle}>
                    {tool?.name[locale] ?? task.toolId}
                  </span>
                  <span className={styles.taskMeta}>
                    {task.status[locale]} · {task.timeLabel[locale]}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        className={styles.viewAll}
        variant="outlined"
        onClick={() => {
          navigate({ page: 'tasks' });
          onClose();
        }}
      >
        {t('navigation:viewAllTasks')}
      </Button>
    </section>
  );
}
