import { AppThemeProvider, Button } from '@itools/design-system-adapter';
import { createI18n } from '@itools/app-core';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdatePanel } from './PwaUpdatePanel.js';
import { usePwaUpdateManager } from '../../pwa/use-pwa-update-manager.js';

interface ServiceWorkerHarness {
  register: ReturnType<typeof vi.fn>;
  registration: {
    active: ServiceWorker | null;
    waiting: ServiceWorker | null;
    installing: ServiceWorker | null;
    update: ReturnType<typeof vi.fn>;
  };
  dispatch(message: unknown, source?: ServiceWorker | null): void;
}

let restoreServiceWorker: (() => void) | undefined;
let restoreReadyState: (() => void) | undefined;

function installServiceWorkerHarness(): ServiceWorkerHarness {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('MessageChannel', undefined);
  const listeners = new Map<string, EventListener>();
  const registration = {
    active: null,
    waiting: null,
    installing: null,
    update: vi.fn(async () => undefined),
  };
  const register = vi.fn(async () => registration);
  const container = {
    controller: null,
    register,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
  } as unknown as ServiceWorkerContainer;

  const previousServiceWorker = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker',
  );
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  });
  restoreServiceWorker = () => {
    if (previousServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', previousServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  };

  const readyStateSpy = vi
    .spyOn(document, 'readyState', 'get')
    .mockReturnValue('complete');
  restoreReadyState = () => readyStateSpy.mockRestore();

  return {
    register,
    registration,
    dispatch(message, source = null) {
      const listener = listeners.get('message');
      if (!listener)
        throw new Error('Service Worker message listener missing.');
      listener({ data: message, source } as MessageEvent<unknown>);
    },
  };
}

function PwaHarness() {
  const controller = usePwaUpdateManager();
  return (
    <>
      <Button variant="text" onClick={controller.openAbout}>
        Open app information
      </Button>
      <output data-testid="pwa-registration">
        {String(controller.isRegistered)}
      </output>
      <output data-testid="pwa-dialog-mode">{controller.dialogMode}</output>
      <PwaUpdatePanel controller={controller} />
    </>
  );
}

function renderPwaHarness() {
  return render(
    <I18nextProvider i18n={createI18n('en')}>
      <AppThemeProvider mode="light">
        <PwaHarness />
      </AppThemeProvider>
    </I18nextProvider>,
  );
}

afterEach(() => {
  cleanup();
  restoreReadyState?.();
  restoreReadyState = undefined;
  restoreServiceWorker?.();
  restoreServiceWorker = undefined;
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

describe('PWA update panel', () => {
  it('does not prompt when first installation reports the current build', async () => {
    const serviceWorker = installServiceWorkerHarness();
    renderPwaHarness();
    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledOnce();
      expect(screen.getByTestId('pwa-registration')).toHaveTextContent('true');
    });
    const currentBuildId = import.meta.env.VITE_BUILD_ID;
    expect(currentBuildId).toBeTruthy();

    serviceWorker.dispatch({
      type: 'update-ready',
      buildId: currentBuildId,
    });

    expect(screen.getByTestId('pwa-dialog-mode')).toHaveTextContent('closed');
  });

  it('treats a waiting worker for the current build as up to date', async () => {
    const serviceWorker = installServiceWorkerHarness();
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    serviceWorker.registration.waiting = waitingWorker;
    const user = userEvent.setup();
    renderPwaHarness();
    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledOnce();
      expect(screen.getByTestId('pwa-registration')).toHaveTextContent('true');
    });

    await user.click(
      screen.getByRole('button', { name: 'Open app information' }),
    );
    expect(
      await screen.findByText('No update is available.'),
    ).toBeInTheDocument();
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
  });

  it('waits for explicit confirmation before applying a different build', async () => {
    const serviceWorker = installServiceWorkerHarness();
    renderPwaHarness();
    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledOnce();
      expect(screen.getByTestId('pwa-registration')).toHaveTextContent('true');
    });
    const workerPostMessage = vi.fn();
    const waitingWorker = {
      postMessage: workerPostMessage,
    } as unknown as ServiceWorker;
    serviceWorker.registration.waiting = waitingWorker;

    act(() => {
      serviceWorker.dispatch(
        {
          type: 'update-ready',
          buildId: 'different-build',
        },
        waitingWorker,
      );
    });

    const dialog = await screen.findByRole('dialog');
    expect(workerPostMessage).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Apply and reload' }),
    );

    expect(workerPostMessage).toHaveBeenCalledOnce();
    expect(workerPostMessage).toHaveBeenCalledWith({ type: 'apply-update' });
    expect(dialog).toBeInTheDocument();
  });

  it('stops opening failure dialogs after two failures for the same build', async () => {
    const serviceWorker = installServiceWorkerHarness();
    const user = userEvent.setup();
    renderPwaHarness();
    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledOnce();
      expect(screen.getByTestId('pwa-registration')).toHaveTextContent('true');
    });
    const failedBuild = 'repeated-failure-build';

    act(() => {
      serviceWorker.dispatch({ type: 'update-failed', buildId: failedBuild });
    });
    const firstFailure = await screen.findByRole('dialog');
    expect(firstFailure).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    act(() => {
      serviceWorker.dispatch({ type: 'update-failed', buildId: failedBuild });
    });
    expect(screen.getByTestId('pwa-dialog-mode')).toHaveTextContent('closed');

    await user.click(
      screen.getByRole('button', { name: 'Open app information' }),
    );
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'automatic prompts are paused',
    );
  });
});
