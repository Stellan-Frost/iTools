import { Button } from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  const { navigate } = useAppNavigation();
  const { t } = useTranslation('common');

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('notFound.eyebrow')}
        title={t('notFound.title')}
        description={t('notFound.description')}
      />
      <div className={styles.actions}>
        <Button variant="filled" onClick={() => navigate({ page: 'home' })}>
          {t('actions.backHome')}
        </Button>
      </div>
    </div>
  );
}
