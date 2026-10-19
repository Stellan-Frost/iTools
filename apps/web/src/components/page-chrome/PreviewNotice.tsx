import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './PreviewNotice.module.css';

interface PreviewNoticeProps {
  children: string;
  tone?: 'info' | 'error' | 'success';
}

const icons = {
  info: 'info',
  error: 'error',
  success: 'check_circle',
};

export function PreviewNotice({ children, tone = 'info' }: PreviewNoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <AppIcon name={icons[tone]} />
      <p>{children}</p>
    </div>
  );
}
