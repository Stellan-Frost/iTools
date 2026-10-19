import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ADMIN_PASSWORD_MIN_LENGTH } from '@itools/contracts';
import { Button, Card, TextField } from '@itools/design-system-adapter';
import type {
  AdminApiClient,
  AdminSessionInfo,
} from '../../api/admin-types.js';
import { isRateLimited, readFailure } from './admin-state.js';
import styles from './AdminPage.module.css';

export type AdminAuthMode = 'setup' | 'login';

export interface AdminAuthSectionProps {
  readonly mode: AdminAuthMode;
  readonly adminClient: AdminApiClient;
  readonly notice: 'expired' | 'none';
  readonly onAuthenticated: (session: AdminSessionInfo) => void;
}

export function AdminAuthSection({
  mode,
  adminClient,
  notice,
  onAuthenticated,
}: AdminAuthSectionProps) {
  const { t } = useTranslation('admin');

  return (
    <Card>
      <div className={styles.authCard}>
        {notice === 'expired' ? (
          <p className={styles.errorText} role="alert">
            {t('session.expired')}
          </p>
        ) : null}
        {mode === 'setup' ? (
          <SetupForm
            adminClient={adminClient}
            onAuthenticated={onAuthenticated}
          />
        ) : (
          <LoginForm
            adminClient={adminClient}
            onAuthenticated={onAuthenticated}
          />
        )}
      </div>
    </Card>
  );
}

interface AuthFormProps {
  readonly adminClient: AdminApiClient;
  readonly onAuthenticated: (session: AdminSessionInfo) => void;
}

function SetupForm({ adminClient, onAuthenticated }: AuthFormProps) {
  const { t } = useTranslation('admin');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [tokenError, setTokenError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined,
  );
  const [confirmationError, setConfirmationError] = useState<
    string | undefined
  >(undefined);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    let valid = true;

    if (!token.trim()) {
      setTokenError(t('setup.tokenRequired'));
      valid = false;
    }
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
      setPasswordError(
        t('setup.passwordTooShort', { minLength: ADMIN_PASSWORD_MIN_LENGTH }),
      );
      valid = false;
    }
    if (password !== confirmation) {
      setConfirmationError(t('setup.passwordMismatch'));
      valid = false;
    }
    if (!valid) {
      return;
    }

    setSubmitting(true);
    try {
      const session = await adminClient.setup({
        token: token.trim(),
        password,
      });
      onAuthenticated(session);
    } catch (error) {
      const failure = readFailure(error);
      if (
        failure?.status === 401 ||
        failure?.code === 'ADMIN_INVALID_CREDENTIALS'
      ) {
        setFormError(t('setup.invalidToken'));
      } else if (failure?.code === 'ADMIN_ALREADY_INITIALIZED') {
        setFormError(t('setup.alreadyInitialized'));
      } else {
        setFormError(t('setup.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={handleSubmit} noValidate>
      <div>
        <p className={styles.kicker}>{t('setup.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('setup.title')}</h2>
        <p className={styles.muted}>
          {t('setup.description', { minLength: ADMIN_PASSWORD_MIN_LENGTH })}
        </p>
      </div>
      <TextField
        id="admin-setup-token"
        label={t('setup.tokenLabel')}
        value={token}
        autoComplete="off"
        onChange={(event) => {
          setToken(event.target.value);
          setTokenError(undefined);
          setFormError('');
        }}
        error={tokenError !== undefined}
        errorText={tokenError}
      />
      <TextField
        id="admin-setup-password"
        label={t('setup.passwordLabel')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setPasswordError(undefined);
          setConfirmationError(undefined);
          setFormError('');
        }}
        error={passwordError !== undefined}
        errorText={passwordError}
      />
      <TextField
        id="admin-setup-confirmation"
        label={t('setup.confirmLabel')}
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value);
          setConfirmationError(undefined);
          setFormError('');
        }}
        error={confirmationError !== undefined}
        errorText={confirmationError}
      />
      {formError ? (
        <p className={styles.errorText} role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="filled" disabled={submitting}>
        {submitting ? t('setup.submitting') : t('setup.submit')}
      </Button>
    </form>
  );
}

function LoginForm({ adminClient, onAuthenticated }: AuthFormProps) {
  const { t } = useTranslation('admin');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined,
  );
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (!password) {
      setPasswordError(t('login.passwordRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const session = await adminClient.login(password);
      onAuthenticated(session);
    } catch (error) {
      if (isRateLimited(error)) {
        setFormError(t('login.rateLimited'));
      } else if (readFailure(error)?.status === 401) {
        setFormError(t('login.invalidPassword'));
      } else {
        setFormError(t('login.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={handleSubmit} noValidate>
      <div>
        <p className={styles.kicker}>{t('login.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('login.title')}</h2>
        <p className={styles.muted}>{t('login.description')}</p>
      </div>
      <TextField
        id="admin-login-password"
        label={t('login.passwordLabel')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setPasswordError(undefined);
          setFormError('');
        }}
        error={passwordError !== undefined}
        errorText={passwordError}
      />
      {formError ? (
        <p className={styles.errorText} role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="filled" disabled={submitting}>
        {submitting ? t('login.submitting') : t('login.submit')}
      </Button>
    </form>
  );
}
