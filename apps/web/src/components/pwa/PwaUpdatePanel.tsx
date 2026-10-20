import { Button, Dialog } from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
import type { PwaUpdateController } from '../../pwa/use-pwa-update-manager.js';
import styles from './PwaUpdatePanel.module.css';

interface PwaUpdatePanelProps {
  controller: PwaUpdateController;
}

function statusTranslationKey(
  status: PwaUpdateController['status'],
): string | undefined {
  switch (status) {
    case 'checking':
      return 'pwa.status.checking';
    case 'up-to-date':
      return 'pwa.status.upToDate';
    case 'update-ready':
      return 'pwa.status.updateReady';
    case 'applying':
      return 'pwa.status.applying';
    case 'repairing':
      return 'pwa.status.repairing';
    case 'update-failed':
      return 'pwa.status.updateFailed';
    case 'repair-complete':
      return 'pwa.status.repairComplete';
    case 'repair-failed':
      return 'pwa.status.repairFailed';
    case 'initial-install-failed':
      return 'pwa.status.initialInstallFailed';
    case 'unavailable':
      return 'pwa.status.unavailable';
    default:
      return undefined;
  }
}

export function PwaUpdatePanel({ controller }: PwaUpdatePanelProps) {
  const { t } = useTranslation('common');
  const isBusy =
    controller.status === 'checking' ||
    controller.status === 'applying' ||
    controller.status === 'repairing';
  const mode = controller.dialogMode;
  const title =
    mode === 'update'
      ? t('pwa.updateTitle')
      : mode === 'repair-confirm'
        ? t('pwa.repairConfirmTitle')
        : t('pwa.aboutTitle');
  const statusKey = statusTranslationKey(controller.status);
  const statusIsError =
    controller.status === 'update-failed' ||
    controller.status === 'repair-failed' ||
    controller.status === 'initial-install-failed' ||
    controller.status === 'unavailable';

  let actions;
  if (mode === 'update') {
    actions = (
      <>
        <Button variant="text" onClick={controller.closeDialog}>
          {t('actions.later')}
        </Button>
        {statusIsError ? (
          <Button
            variant="outlined"
            disabled={!controller.isRegistered || isBusy}
            onClick={controller.retry}
          >
            {t('pwa.retry')}
          </Button>
        ) : null}
        <Button
          variant="filled"
          disabled={
            !controller.isRegistered ||
            controller.status !== 'update-ready' ||
            isBusy
          }
          onClick={controller.applyUpdate}
        >
          {controller.status === 'applying'
            ? t('pwa.applying')
            : t('pwa.applyUpdate')}
        </Button>
      </>
    );
  } else if (mode === 'repair-confirm') {
    actions = (
      <>
        <Button variant="text" onClick={controller.closeDialog}>
          {t('actions.cancel')}
        </Button>
        {controller.status === 'repair-failed' ? (
          <Button
            variant="outlined"
            disabled={!controller.isRegistered || isBusy}
            onClick={controller.retry}
          >
            {t('pwa.retry')}
          </Button>
        ) : null}
        <Button
          variant="filled"
          disabled={!controller.isRegistered || isBusy}
          onClick={controller.confirmRepair}
        >
          {controller.status === 'repairing'
            ? t('pwa.repairing')
            : t('pwa.confirmRepair')}
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        <Button variant="text" onClick={controller.closeDialog}>
          {t('actions.close')}
        </Button>
        {(controller.status === 'update-failed' ||
          controller.status === 'repair-failed' ||
          controller.status === 'initial-install-failed') && (
          <Button
            variant="outlined"
            disabled={!controller.isRegistered || isBusy}
            onClick={controller.retry}
          >
            {t('pwa.retry')}
          </Button>
        )}
        {controller.status === 'update-ready' ? (
          <Button variant="filled" onClick={controller.openUpdateConfirmation}>
            {t('pwa.reviewUpdate')}
          </Button>
        ) : null}
        <Button
          variant="outlined"
          disabled={!controller.isRegistered || isBusy}
          onClick={() => void controller.checkForUpdates()}
        >
          {isBusy && controller.status === 'checking'
            ? t('pwa.checking')
            : t('pwa.checkUpdates')}
        </Button>
        <Button
          variant="outlined"
          disabled={!controller.isRegistered || isBusy}
          onClick={controller.openRepairConfirmation}
        >
          {t('pwa.repairInstallation')}
        </Button>
      </>
    );
  }

  return (
    <Dialog
      open={mode !== 'closed'}
      onClose={controller.closeDialog}
      title={title}
      actions={actions}
    >
      <div className={styles.content}>
        {mode === 'about' ? (
          <>
            <p className={styles.buildId}>
              <span>{t('pwa.currentBuildId')}</span>
              <code>
                {controller.currentBuildId || t('pwa.unknownBuildId')}
              </code>
            </p>
            {controller.updateBuildId ? (
              <p className={styles.buildId}>
                <span>{t('pwa.updateBuildId')}</span>
                <code>{controller.updateBuildId}</code>
              </p>
            ) : null}
            <p>{t('pwa.aboutBody')}</p>
            <p>{t('pwa.fontFallback')}</p>
            <p>{t('pwa.offlineLimits')}</p>
          </>
        ) : null}

        {mode === 'update' ? (
          <>
            <p>{t('pwa.updateReadyBody')}</p>
            {controller.updateBuildId ? (
              <p className={styles.buildId}>
                <span>{t('pwa.updateBuildId')}</span>
                <code>{controller.updateBuildId}</code>
              </p>
            ) : null}
            <p className={styles.riskNotice} role="note">
              {t('pwa.updateRisk')}
            </p>
          </>
        ) : null}

        {mode === 'repair-confirm' ? (
          <>
            <p>{t('pwa.repairConfirmBody')}</p>
            <p className={styles.riskNotice} role="note">
              {t('pwa.repairAssetsNote')}
            </p>
          </>
        ) : null}

        {statusKey ? (
          <p
            className={statusIsError ? styles.error : styles.status}
            role={statusIsError ? 'alert' : 'status'}
            aria-live={statusIsError ? 'assertive' : 'polite'}
          >
            {t(statusKey)}
          </p>
        ) : null}
        {controller.automaticPromptSuppressed ? (
          <p className={styles.status} role="status">
            {t('pwa.automaticPromptSuppressed')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
