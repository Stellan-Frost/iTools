import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CircularProgressIndicator,
  Dialog,
  useSnackbar,
} from '@itools/design-system-adapter';
import type { AdminVersion, Locale } from '@itools/contracts';
import type { AdminApiClient } from '../../api/admin-types.js';
import {
  formatDateTime,
  isVersionConflict,
  readFailure,
} from './admin-state.js';
import styles from './AdminPage.module.css';

export interface AdminVersionsPanelProps {
  readonly adminClient: AdminApiClient;
  readonly toolId: string;
  readonly locale: Locale;
  readonly onUnauthorized: () => void;
  readonly onRolledBack: () => void;
}

function latestVersionId(
  versions: readonly AdminVersion[],
  locale: Locale,
): number | undefined {
  let latest: number | undefined;
  for (const version of versions) {
    if (version.locale !== locale) {
      continue;
    }
    if (latest === undefined || version.versionId > latest) {
      latest = version.versionId;
    }
  }
  return latest;
}

export function AdminVersionsPanel({
  adminClient,
  toolId,
  locale,
  onUnauthorized,
  onRolledBack,
}: AdminVersionsPanelProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { show } = useSnackbar();
  const [versions, setVersions] = useState<readonly AdminVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [pending, setPending] = useState<AdminVersion | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const loadVersions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const next = await adminClient.listVersions(toolId);
      setVersions(next);
      setHasError(false);
    } catch (error) {
      if (readFailure(error)?.status === 401) {
        onUnauthorized();
        return;
      }
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [adminClient, toolId, onUnauthorized]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  async function confirmRollback() {
    if (pending === undefined) {
      return;
    }
    const expectedVersionId = latestVersionId(versions, pending.locale);
    if (expectedVersionId === undefined) {
      setPending(undefined);
      void show({ message: t('versions.missingExpected'), duration: 'short' });
      return;
    }

    setBusy(true);
    try {
      await adminClient.rollback(toolId, {
        versionId: pending.versionId,
        expectedVersionId,
      });
      setPending(undefined);
      setHasConflict(false);
      onRolledBack();
      void show({ message: t('versions.success'), duration: 'short' });
      await loadVersions();
    } catch (error) {
      setPending(undefined);
      const failure = readFailure(error);
      if (failure?.status === 401) {
        onUnauthorized();
        return;
      }
      if (isVersionConflict(error)) {
        setHasConflict(true);
        await loadVersions();
      } else {
        void show({ message: t('versions.error'), duration: 'short' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-versions-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>{t('versions.kicker')}</p>
          <h2 id="admin-versions-heading" className={styles.sectionTitle}>
            {t('versions.title')}
          </h2>
        </div>
      </div>
      <Card>
        {hasConflict ? (
          <p className={styles.errorText} role="alert">
            {t('versions.conflict')}
          </p>
        ) : null}
        {isLoading ? (
          <div className={styles.listStatus}>
            <CircularProgressIndicator aria-label={t('versions.loading')} />
            <span>{t('versions.loading')}</span>
          </div>
        ) : null}
        {!isLoading && hasError ? (
          <p className={styles.errorText} role="alert">
            {t('versions.loadError')}
          </p>
        ) : null}
        {!isLoading && !hasError && versions.length === 0 ? (
          <p className={styles.muted}>{t('versions.empty')}</p>
        ) : null}
        {versions.length > 0 ? (
          <ul className={styles.versionList}>
            {versions.map((version) => {
              const formatted = formatDateTime(version.createdAt, locale);
              return (
                <li key={version.versionId} className={styles.versionRow}>
                  <div className={styles.versionCopy}>
                    <strong>{version.name}</strong>
                    <span className={styles.versionMeta}>
                      {t('versions.localeLabel')}:{' '}
                      {version.locale === 'zh-CN'
                        ? t('common:language.zhCN')
                        : t('common:language.en')}{' '}
                      · {t('versions.timeLabel')}: {formatted}
                    </span>
                  </div>
                  <Button
                    variant="outlined"
                    onClick={() => setPending(version)}
                  >
                    {t('versions.rollback')}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
      <Dialog
        open={pending !== undefined}
        onClose={() => setPending(undefined)}
        title={t('versions.confirmTitle')}
        actions={
          <>
            <Button variant="text" onClick={() => setPending(undefined)}>
              {t('actions.cancel')}
            </Button>
            <Button
              variant="filled"
              disabled={busy}
              onClick={() => void confirmRollback()}
            >
              {t('versions.confirmRollback')}
            </Button>
          </>
        }
      >
        {pending !== undefined ? (
          <p>
            {t('versions.confirmBody', {
              name: pending.name,
              time: formatDateTime(pending.createdAt, locale),
            })}
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}
