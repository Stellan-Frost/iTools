import { useTranslation } from 'react-i18next';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import styles from './AdminPage.module.css';

export function AdminFeedbackExamples() {
  const { t } = useTranslation('admin');

  return (
    <section
      className={styles.feedbackSection}
      aria-labelledby="feedback-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p>{t('feedback.kicker')}</p>
          <h2 id="feedback-heading">{t('feedback.title')}</h2>
        </div>
      </div>
      <div className={styles.feedbackGrid}>
        <PreviewNotice tone="success">{t('feedback.success')}</PreviewNotice>
        <PreviewNotice tone="error">{t('feedback.error')}</PreviewNotice>
      </div>
    </section>
  );
}
