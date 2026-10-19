import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import styles from './AdminPage.module.css';

export function AdminFeedbackExamples() {
  return (
    <section
      className={styles.feedbackSection}
      aria-labelledby="feedback-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <p>FEEDBACK STATES</p>
          <h2 id="feedback-heading">状态与错误反馈样本</h2>
        </div>
      </div>
      <div className={styles.feedbackGrid}>
        <PreviewNotice tone="success">
          成功状态样本：字段校验完成，没有写入服务器。
        </PreviewNotice>
        <PreviewNotice tone="error">
          错误状态样本：目录服务尚未接入，保存和回滚不可用。
        </PreviewNotice>
      </div>
    </section>
  );
}
