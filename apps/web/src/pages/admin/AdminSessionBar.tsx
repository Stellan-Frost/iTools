import { useTranslation } from 'react-i18next';
import { Button, Card } from '@itools/design-system-adapter';
import type { AdminSessionInfo } from '../../api/admin-types.js';
import type { Locale } from '@itools/contracts';
import { formatDateTime } from './admin-state.js';
import styles from './AdminPage.module.css';

export interface AdminSessionBarProps {
  readonly session: AdminSessionInfo;
  readonly locale: Locale;
  readonly onLogout: () => void;
}

export function AdminSessionBar({
  session,
  locale,
  onLogout,
}: AdminSessionBarProps) {
  const { t } = useTranslation('admin');

  return (
    <Card>
      <div className={styles.sessionBar}>
        <span className={styles.sessionText}>
          {t('session.expiresAt', {
            time: formatDateTime(session.expiresAt, locale),
          })}
        </span>
        <Button variant="outlined" onClick={onLogout}>
          {t('session.logout')}
        </Button>
      </div>
    </Card>
  );
}
