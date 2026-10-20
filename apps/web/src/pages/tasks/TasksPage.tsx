import { Button, Card } from '@itools/design-system-adapter';
import { SAMPLE_TASKS, findTool, getCategory } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import { useOnlineStatus } from '../../pwa/use-online-status.js';
import styles from './TasksPage.module.css';

export function TasksPage() {
  const { locale, navigate } = useAppNavigation();
  const { t } = useTranslation(['tasks', 'common']);
  const isOnline = useOnlineStatus();

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('tasks:eyebrow')}
        title={t('tasks:title')}
        description={t('tasks:description')}
      />
      <PreviewNotice>{t('tasks:notice')}</PreviewNotice>
      {isOnline === false ? (
        <Card>
          <section aria-labelledby="tasks-offline-title" role="status">
            <h2 id="tasks-offline-title">{t('tasks:offline.title')}</h2>
            <p>{t('tasks:offline.body')}</p>
          </section>
        </Card>
      ) : (
        <Card>
          <div className={styles.listHeader}>
            <h2>{t('tasks:listTitle')}</h2>
            <MetadataChip
              label={t('tasks:count', { total: SAMPLE_TASKS.length })}
            />
          </div>
          <ul className={styles.taskList}>
            {SAMPLE_TASKS.map((task) => {
              const tool = findTool(task.toolId);
              const category = tool
                ? getCategory(tool.metadata.category)
                : undefined;

              return (
                <li key={task.id}>
                  <div className={styles.taskIcon}>
                    <AppIcon name="task_alt" />
                  </div>
                  <div className={styles.taskDetails}>
                    <strong>
                      {tool
                        ? tool.metadata.name[locale]
                        : t('tasks:fallbackTool')}
                    </strong>
                    <span>
                      <MetadataChip
                        label={
                          category
                            ? category.name[locale]
                            : t('tasks:fallbackCategory')
                        }
                      />
                      <MetadataChip label={task.timeLabel[locale]} />
                    </span>
                  </div>
                  <MetadataChip label={task.status[locale]} />
                  <Button
                    variant="text"
                    onClick={() =>
                      navigate({ page: 'tool', toolId: task.toolId })
                    }
                  >
                    {t('common:actions.openPreview')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
