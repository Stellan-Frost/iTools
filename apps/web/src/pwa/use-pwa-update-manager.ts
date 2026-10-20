import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getTargetWorker,
  isWorkerMessage,
  queryWorkerBuildId,
  sendToWorker,
} from './sw-client.js';
import {
  clearFailures,
  getFailureCount,
  recordFailure,
  shouldAutomaticallyPrompt,
} from './update-failure-store.js';

export type PwaDialogMode = 'closed' | 'about' | 'update' | 'repair-confirm';
export type PwaUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-ready'
  | 'applying'
  | 'repairing'
  | 'update-failed'
  | 'repair-complete'
  | 'repair-failed'
  | 'initial-install-failed'
  | 'unavailable';

export interface PwaUpdateController {
  readonly currentBuildId: string;
  readonly updateBuildId: string;
  readonly dialogMode: PwaDialogMode;
  readonly status: PwaUpdateStatus;
  readonly failureCount: number;
  readonly automaticPromptSuppressed: boolean;
  readonly isRegistered: boolean;
  openAbout(): void;
  closeDialog(): void;
  checkForUpdates(): Promise<void>;
  openUpdateConfirmation(): void;
  applyUpdate(): void;
  openRepairConfirmation(): void;
  confirmRepair(): void;
  retry(): void;
}

const CURRENT_BUILD_ID = import.meta.env.VITE_BUILD_ID ?? '';

interface ManagerState {
  dialogMode: PwaDialogMode;
  status: PwaUpdateStatus;
  updateBuildId: string;
  failedBuildId: string;
  failureCount: number;
  lastFailureAction: 'update' | 'repair' | undefined;
  automaticPromptSuppressed: boolean;
  isRegistered: boolean;
}

const initialState: ManagerState = {
  dialogMode: 'closed',
  status: 'idle',
  updateBuildId: '',
  failedBuildId: '',
  failureCount: 0,
  lastFailureAction: undefined,
  automaticPromptSuppressed: false,
  isRegistered: false,
};

export function usePwaUpdateManager(): PwaUpdateController {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );
  const updateWorkerRef = useRef<ServiceWorker | undefined>(undefined);
  const approvedActivationRef = useRef(false);
  const approvedBuildIdRef = useRef('');
  const [state, setState] = useState<ManagerState>(initialState);

  const handleWorkerMessage = useCallback((event: MessageEvent<unknown>) => {
    if (!isWorkerMessage(event.data)) return;
    const message = event.data;

    if (message.type === 'update-ready') {
      if (CURRENT_BUILD_ID && message.buildId === CURRENT_BUILD_ID) return;
      if (event.source && 'postMessage' in event.source) {
        updateWorkerRef.current = event.source as ServiceWorker;
      }
      const count = getFailureCount(message.buildId);
      setState((current) => ({
        ...current,
        status: 'update-ready',
        updateBuildId: message.buildId,
        failureCount: count,
        automaticPromptSuppressed: !shouldAutomaticallyPrompt(message.buildId),
        dialogMode: shouldAutomaticallyPrompt(message.buildId)
          ? current.dialogMode === 'about'
            ? 'about'
            : 'update'
          : current.dialogMode,
      }));
      return;
    }

    if (message.type === 'update-failed' || message.type === 'repair-failed') {
      const count = recordFailure(message.buildId);
      const action = message.type === 'update-failed' ? 'update' : 'repair';
      const hasPreviousVersion = Boolean(
        navigator.serviceWorker.controller || registrationRef.current?.active,
      );
      const failureStatus =
        message.type === 'repair-failed'
          ? 'repair-failed'
          : hasPreviousVersion
            ? 'update-failed'
            : 'initial-install-failed';
      setState((current) => ({
        ...current,
        status: failureStatus,
        updateBuildId:
          message.type === 'update-failed' ? '' : current.updateBuildId,
        failedBuildId: message.buildId,
        failureCount: count,
        lastFailureAction: action,
        automaticPromptSuppressed: count >= 2,
        dialogMode:
          count < 2 && current.dialogMode === 'closed'
            ? failureStatus === 'update-failed'
              ? 'update'
              : 'about'
            : current.dialogMode,
      }));
      return;
    }

    clearFailures(message.buildId);
    setState((current) => ({
      ...current,
      status: 'repair-complete',
      failedBuildId: '',
      failureCount: 0,
      lastFailureAction: undefined,
      automaticPromptSuppressed: false,
    }));
    window.setTimeout(() => window.location.reload(), 800);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    const handleControllerChange = () => {
      if (!approvedActivationRef.current) return;
      approvedActivationRef.current = false;
      clearFailures(approvedBuildIdRef.current);
      approvedBuildIdRef.current = '';
      window.location.reload();
    };

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        if (cancelled) return;
        registrationRef.current = registration;
        setState((current) => ({ ...current, isRegistered: true }));
        void queryWorkerBuildId(registration.active ?? undefined).then(
          (buildId) => {
            if (cancelled || CURRENT_BUILD_ID || !buildId) return;
            setState((current) => ({ ...current, updateBuildId: buildId }));
          },
        );

        if (registration.waiting) {
          updateWorkerRef.current = registration.waiting;
          const buildId =
            (await queryWorkerBuildId(registration.waiting)) ||
            CURRENT_BUILD_ID;
          if (cancelled) return;
          if (buildId && buildId === CURRENT_BUILD_ID) {
            setState((current) => ({
              ...current,
              status: 'up-to-date',
              updateBuildId: '',
            }));
            return;
          }
          const count = getFailureCount(buildId);
          setState((current) => ({
            ...current,
            status: 'update-ready',
            updateBuildId: buildId,
            failureCount: count,
            automaticPromptSuppressed: !shouldAutomaticallyPrompt(buildId),
            dialogMode: shouldAutomaticallyPrompt(buildId)
              ? current.dialogMode === 'about'
                ? 'about'
                : 'update'
              : current.dialogMode,
          }));
        }
      } catch {
        if (!cancelled) {
          setState((current) => ({ ...current, status: 'unavailable' }));
        }
      }
    }

    const handleLoad = () => void register();
    navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

    if (document.readyState === 'complete') handleLoad();
    else window.addEventListener('load', handleLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', handleLoad);
      navigator.serviceWorker.removeEventListener(
        'message',
        handleWorkerMessage,
      );
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
      registrationRef.current = undefined;
      updateWorkerRef.current = undefined;
    };
  }, [handleWorkerMessage]);

  const openAbout = useCallback(() => {
    setState((current) => ({ ...current, dialogMode: 'about' }));
  }, []);

  const closeDialog = useCallback(() => {
    setState((current) => ({ ...current, dialogMode: 'closed' }));
  }, []);

  const checkForUpdates = useCallback(async () => {
    const registration = registrationRef.current;
    if (!registration) {
      setState((current) => ({ ...current, status: 'unavailable' }));
      return;
    }

    setState((current) => ({ ...current, status: 'checking' }));
    try {
      await registration.update();
      const waitingWorker = registration.waiting;
      if (waitingWorker) {
        updateWorkerRef.current = waitingWorker;
        const buildId =
          (await queryWorkerBuildId(waitingWorker)) || CURRENT_BUILD_ID;
        if (buildId && buildId === CURRENT_BUILD_ID) {
          setState((current) => ({
            ...current,
            status: 'up-to-date',
            updateBuildId: '',
          }));
          return;
        }
        const count = getFailureCount(buildId);
        setState((current) => ({
          ...current,
          status: 'update-ready',
          updateBuildId: buildId,
          failureCount: count,
          automaticPromptSuppressed: !shouldAutomaticallyPrompt(buildId),
        }));
        return;
      }

      setState((current) => ({
        ...current,
        status: registration.installing ? 'checking' : 'up-to-date',
      }));
    } catch {
      const buildId = state.updateBuildId || CURRENT_BUILD_ID;
      const count = recordFailure(buildId);
      const hasPreviousVersion = Boolean(
        navigator.serviceWorker.controller || registration.active,
      );
      setState((current) => ({
        ...current,
        status: hasPreviousVersion ? 'update-failed' : 'initial-install-failed',
        failedBuildId: buildId,
        failureCount: count,
        lastFailureAction: 'update',
        automaticPromptSuppressed: count >= 2,
      }));
    }
  }, [state.updateBuildId]);

  const openUpdateConfirmation = useCallback(() => {
    setState((current) => ({ ...current, dialogMode: 'update' }));
  }, []);

  const applyUpdate = useCallback(() => {
    if (state.dialogMode !== 'update' || state.status !== 'update-ready')
      return;
    const waitingWorker =
      registrationRef.current?.waiting ?? updateWorkerRef.current;
    if (!waitingWorker) {
      const buildId = state.updateBuildId || CURRENT_BUILD_ID;
      const count = recordFailure(buildId);
      const hasPreviousVersion = Boolean(
        navigator.serviceWorker.controller || registrationRef.current?.active,
      );
      setState((current) => ({
        ...current,
        status: hasPreviousVersion ? 'update-failed' : 'initial-install-failed',
        failedBuildId: buildId,
        failureCount: count,
        lastFailureAction: 'update',
        automaticPromptSuppressed: count >= 2,
      }));
      return;
    }
    approvedActivationRef.current = true;
    approvedBuildIdRef.current = state.updateBuildId;
    if (!sendToWorker(waitingWorker, { type: 'apply-update' })) {
      approvedActivationRef.current = false;
      approvedBuildIdRef.current = '';
      return;
    }
    setState((current) => ({ ...current, status: 'applying' }));
  }, [state.dialogMode, state.status, state.updateBuildId]);

  const openRepairConfirmation = useCallback(() => {
    setState((current) => ({ ...current, dialogMode: 'repair-confirm' }));
  }, []);

  const confirmRepair = useCallback(() => {
    if (state.dialogMode !== 'repair-confirm' || state.status === 'repairing') {
      return;
    }
    if (
      !sendToWorker(getTargetWorker(registrationRef.current), {
        type: 'repair-install',
      })
    ) {
      setState((current) => ({ ...current, status: 'unavailable' }));
      return;
    }
    setState((current) => ({ ...current, status: 'repairing' }));
  }, [state.dialogMode, state.status]);

  const retry = useCallback(() => {
    if (state.lastFailureAction === 'repair') {
      if (
        sendToWorker(getTargetWorker(registrationRef.current), {
          type: 'repair-install',
        })
      ) {
        setState((current) => ({ ...current, status: 'repairing' }));
        return;
      }
      setState((current) => ({ ...current, status: 'unavailable' }));
      return;
    }
    void checkForUpdates();
  }, [checkForUpdates, state.lastFailureAction]);

  return {
    currentBuildId: CURRENT_BUILD_ID,
    updateBuildId: state.updateBuildId,
    dialogMode: state.dialogMode,
    status: state.status,
    failureCount: state.failureCount,
    automaticPromptSuppressed: state.automaticPromptSuppressed,
    isRegistered: state.isRegistered,
    openAbout,
    closeDialog,
    checkForUpdates,
    openUpdateConfirmation,
    applyUpdate,
    openRepairConfirmation,
    confirmRepair,
    retry,
  };
}
