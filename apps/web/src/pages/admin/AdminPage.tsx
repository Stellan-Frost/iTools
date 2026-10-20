import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CircularProgressIndicator,
  useSnackbar,
} from '@itools/design-system-adapter';
import type { Locale, ToolCatalogItem } from '@itools/contracts';
import { createAdminApiClient } from '../../api/admin-client.js';
import { createToolApiClient } from '../../api/client.js';
import type { ToolApiClient } from '../../api/client.js';
import type {
  AdminApiClient,
  AdminAvailabilityOverride,
  AdminMetadataPatch,
  AdminSessionInfo,
} from '../../api/admin-types.js';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { useAppNavigation } from '../../app/navigation.js';
import { useOnlineStatus } from '../../pwa/use-online-status.js';
import { AdminAuthSection } from './AdminAuthSection.js';
import { AdminAvailabilityControl } from './AdminAvailabilityControl.js';
import { AdminMetadataForm } from './AdminMetadataForm.js';
import { AdminSessionBar } from './AdminSessionBar.js';
import { AdminToolList } from './AdminToolList.js';
import { AdminVersionsPanel } from './AdminVersionsPanel.js';
import { readFailure, type AdminPhase } from './admin-state.js';
import styles from './AdminPage.module.css';

export interface AdminPageProps {
  readonly adminClient?: AdminApiClient;
  readonly catalogClient?: ToolApiClient;
}

export function AdminPage({ adminClient, catalogClient }: AdminPageProps = {}) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('admin');
  const isOnline = useOnlineStatus();
  const { show } = useSnackbar();
  const resolvedAdminClient = useMemo(
    () => adminClient ?? createAdminApiClient(),
    [adminClient],
  );
  const resolvedCatalogClient = useMemo(
    () => catalogClient ?? createToolApiClient({ baseUrl: '' }),
    [catalogClient],
  );

  const [phase, setPhase] = useState<AdminPhase>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [tools, setTools] = useState<readonly ToolCatalogItem[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string | undefined>(
    undefined,
  );
  const [metadataRevision, setMetadataRevision] = useState(0);

  const expireSession = useCallback(() => {
    setPhase({ kind: 'login', notice: 'expired' });
    setTools([]);
    setToolsError(false);
    setSelectedToolId(undefined);
  }, []);

  const refreshTools = useCallback(async (): Promise<void> => {
    setToolsLoading(true);
    try {
      const next = await resolvedCatalogClient.listTools();
      setTools(next);
      setToolsError(false);
    } catch (error) {
      if (readFailure(error)?.status === 401) {
        expireSession();
        return;
      }
      setToolsError(true);
    } finally {
      setToolsLoading(false);
    }
  }, [expireSession, resolvedCatalogClient]);

  useEffect(() => {
    if (isOnline !== true) return;
    let cancelled = false;

    async function bootstrap() {
      setPhase({ kind: 'loading' });
      try {
        const [status, session] = await Promise.all([
          resolvedAdminClient.getSetupStatus(),
          resolvedAdminClient.getSession().catch(() => undefined),
        ]);
        if (cancelled) {
          return;
        }
        if (status.available) {
          setPhase({ kind: 'setup' });
          return;
        }
        if (session !== undefined) {
          setPhase({ kind: 'ready', session });
          void refreshTools();
          return;
        }
        setPhase({ kind: 'login', notice: 'none' });
      } catch {
        if (!cancelled) {
          setPhase({ kind: 'error' });
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isOnline, reloadToken, refreshTools, resolvedAdminClient]);

  const handleAuthenticated = useCallback(
    (session: AdminSessionInfo) => {
      setPhase({ kind: 'ready', session });
      void refreshTools();
    },
    [refreshTools],
  );

  async function handleLogout() {
    await resolvedAdminClient.logout().catch(() => undefined);
    setTools([]);
    setToolsError(false);
    setSelectedToolId(undefined);
    setPhase({ kind: 'login', notice: 'none' });
    void show({ message: t('session.loggedOut'), duration: 'short' });
  }

  async function handleSaveMetadata(
    toolId: string,
    patch: AdminMetadataPatch,
  ): Promise<boolean> {
    try {
      await resolvedAdminClient.updateMetadata(toolId, patch);
      void show({ message: t('metadata.success'), duration: 'short' });
      await refreshTools();
      return true;
    } catch (error) {
      if (readFailure(error)?.status === 401) {
        expireSession();
        return false;
      }
      void show({ message: t('metadata.saveError'), duration: 'short' });
      return false;
    }
  }

  async function handleSetAvailability(
    tool: ToolCatalogItem,
    override: AdminAvailabilityOverride,
  ): Promise<void> {
    try {
      await resolvedAdminClient.setAvailability(tool.id, override);
      void show({
        message:
          override === 'disabled'
            ? t('availability.successDisabled')
            : t('availability.successRestored'),
        duration: 'short',
      });
      await refreshTools();
    } catch (error) {
      if (readFailure(error)?.status === 401) {
        expireSession();
        return;
      }
      void show({ message: t('availability.error'), duration: 'short' });
    }
  }

  const selectedTool = tools.find((tool) => tool.id === selectedToolId);
  const contentLocale: Locale = locale;

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
      />

      {isOnline === false ? (
        <Card>
          <div className={styles.statusPanel} role="status">
            <h2>{t('offlineUnavailable.title')}</h2>
            <p>{t('offlineUnavailable.body')}</p>
          </div>
        </Card>
      ) : (
        <>
          {phase.kind === 'loading' ? (
            <Card>
              <div className={styles.listStatus}>
                <CircularProgressIndicator aria-label={t('loading')} />
                <span>{t('loading')}</span>
              </div>
            </Card>
          ) : null}

          {phase.kind === 'error' ? (
            <Card>
              <div className={styles.statusPanel}>
                <p className={styles.errorText} role="alert">
                  {t('loadError')}
                </p>
                <Button
                  variant="outlined"
                  onClick={() => setReloadToken((current) => current + 1)}
                >
                  {t('retry')}
                </Button>
              </div>
            </Card>
          ) : null}

          {phase.kind === 'setup' || phase.kind === 'login' ? (
            <div className={styles.authWrap}>
              <AdminAuthSection
                mode={phase.kind}
                adminClient={resolvedAdminClient}
                notice={phase.kind === 'login' ? phase.notice : 'none'}
                onAuthenticated={handleAuthenticated}
              />
            </div>
          ) : null}

          {phase.kind === 'ready' ? (
            <div className={styles.readyArea}>
              <AdminSessionBar
                session={phase.session}
                locale={contentLocale}
                onLogout={() => {
                  void handleLogout();
                }}
              />
              <div className={styles.adminGrid}>
                <AdminToolList
                  tools={tools}
                  selectedToolId={selectedToolId}
                  locale={contentLocale}
                  isLoading={toolsLoading}
                  hasError={toolsError}
                  onSelect={setSelectedToolId}
                />
                <div className={styles.detailColumn}>
                  {selectedTool === undefined ? (
                    <Card>
                      <p className={styles.muted}>{t('tools.noSelection')}</p>
                    </Card>
                  ) : (
                    <>
                      <AdminAvailabilityControl
                        tool={selectedTool}
                        locale={contentLocale}
                        onSetAvailability={handleSetAvailability}
                      />
                      <AdminMetadataForm
                        key={`${selectedTool.id}-${metadataRevision}`}
                        tool={selectedTool}
                        onSave={handleSaveMetadata}
                      />
                      <AdminVersionsPanel
                        key={`versions-${selectedTool.id}`}
                        adminClient={resolvedAdminClient}
                        toolId={selectedTool.id}
                        locale={contentLocale}
                        onUnauthorized={expireSession}
                        onRolledBack={() => {
                          setMetadataRevision((current) => current + 1);
                          void refreshTools();
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
