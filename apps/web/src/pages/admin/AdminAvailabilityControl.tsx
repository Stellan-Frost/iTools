import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dialog } from '@itools/design-system-adapter';
import type { AdminAvailabilityOverride } from '../../api/admin-types.js';
import type { Locale, ToolCatalogItem } from '@itools/contracts';
import styles from './AdminPage.module.css';

export interface AdminAvailabilityControlProps {
  readonly tool: ToolCatalogItem;
  readonly locale: Locale;
  readonly onSetAvailability: (
    tool: ToolCatalogItem,
    override: AdminAvailabilityOverride,
  ) => Promise<void>;
}

export function AdminAvailabilityControl({
  tool,
  locale,
  onSetAvailability,
}: AdminAvailabilityControlProps) {
  const { t } = useTranslation('admin');
  const [pending, setPending] = useState<AdminAvailabilityOverride | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);

  const isDisabled = tool.availability === 'disabled';
  const override: AdminAvailabilityOverride = isDisabled
    ? 'registry'
    : 'disabled';
  const name = tool.name[locale];

  async function confirm() {
    if (pending === undefined) {
      return;
    }
    setBusy(true);
    try {
      await onSetAvailability(tool, pending);
      setPending(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className={styles.availabilityBar}>
        <div>
          <p className={styles.kicker}>{t('availability.kicker')}</p>
          <strong>{name}</strong>
        </div>
        <Button
          variant={isDisabled ? 'filled' : 'outlined'}
          onClick={() => setPending(override)}
        >
          {isDisabled ? t('availability.restore') : t('availability.disable')}
        </Button>
      </div>
      <Dialog
        open={pending !== undefined}
        onClose={() => setPending(undefined)}
        title={
          isDisabled
            ? t('availability.restoreTitle')
            : t('availability.disableTitle')
        }
        actions={
          <>
            <Button variant="text" onClick={() => setPending(undefined)}>
              {t('actions.cancel')}
            </Button>
            <Button
              variant="filled"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {isDisabled
                ? t('availability.confirmRestore')
                : t('availability.confirmDisable')}
            </Button>
          </>
        }
      >
        <p>
          {isDisabled
            ? t('availability.restoreBody', { name })
            : t('availability.disableBody', { name })}
        </p>
      </Dialog>
    </Card>
  );
}
