import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, TextField } from '@itools/design-system-adapter';
import type { ToolCatalogItem } from '@itools/contracts';
import type { AdminMetadataPatch } from '../../api/admin-types.js';
import styles from './AdminPage.module.css';

const FIELD_KEYS = [
  'zhName',
  'zhSummary',
  'zhDescription',
  'enName',
  'enSummary',
  'enDescription',
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

type Draft = Record<FieldKey, string> & { readonly order: string };

export interface AdminMetadataFormProps {
  readonly tool: ToolCatalogItem;
  readonly onSave: (
    toolId: string,
    patch: AdminMetadataPatch,
  ) => Promise<boolean>;
}

function toDraft(tool: ToolCatalogItem): Draft {
  return {
    zhName: tool.name['zh-CN'],
    zhSummary: tool.summary['zh-CN'],
    zhDescription: tool.description['zh-CN'],
    enName: tool.name.en,
    enSummary: tool.summary.en,
    enDescription: tool.description.en,
    order: String(tool.order),
  };
}

function buildPatch(next: Draft, base: Draft): AdminMetadataPatch | undefined {
  const zh: { name?: string; summary?: string; description?: string } = {};
  if (next.zhName !== base.zhName) zh.name = next.zhName;
  if (next.zhSummary !== base.zhSummary) zh.summary = next.zhSummary;
  if (next.zhDescription !== base.zhDescription) {
    zh.description = next.zhDescription;
  }

  const en: { name?: string; summary?: string; description?: string } = {};
  if (next.enName !== base.enName) en.name = next.enName;
  if (next.enSummary !== base.enSummary) en.summary = next.enSummary;
  if (next.enDescription !== base.enDescription) {
    en.description = next.enDescription;
  }

  const localizations: {
    'zh-CN'?: { name?: string; summary?: string; description?: string };
    en?: { name?: string; summary?: string; description?: string };
  } = {};
  if (Object.keys(zh).length > 0) localizations['zh-CN'] = zh;
  if (Object.keys(en).length > 0) localizations.en = en;

  const orderChanged = next.order.trim() !== base.order.trim();
  if (!orderChanged && Object.keys(localizations).length === 0) {
    return undefined;
  }
  if (!orderChanged) {
    return { localizations };
  }
  return { localizations, order: Number(next.order) };
}

export function AdminMetadataForm({ tool, onSave }: AdminMetadataFormProps) {
  const { t } = useTranslation('admin');
  const [draft, setDraft] = useState<Draft>(() => toDraft(tool));
  const [baseline, setBaseline] = useState<Draft>(() => toDraft(tool));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [orderError, setOrderError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const labels: Record<FieldKey, string> = {
    zhName: t('metadata.zhName'),
    zhSummary: t('metadata.zhSummary'),
    zhDescription: t('metadata.zhDescription'),
    enName: t('metadata.enName'),
    enSummary: t('metadata.enSummary'),
    enDescription: t('metadata.enDescription'),
  };

  const dirty =
    FIELD_KEYS.some((key) => draft[key] !== baseline[key]) ||
    draft.order.trim() !== baseline.order.trim();

  function updateField(key: FieldKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const key of FIELD_KEYS) {
      if (!draft[key].trim()) {
        nextErrors[key] = t('metadata.required', { field: labels[key] });
      }
    }
    setErrors(nextErrors);

    const trimmedOrder = draft.order.trim();
    const order = Number(trimmedOrder);
    if (trimmedOrder === '' || !Number.isInteger(order)) {
      setOrderError(t('metadata.orderInvalid'));
      return false;
    }
    setOrderError(undefined);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    const patch = buildPatch(draft, baseline);
    if (patch === undefined) {
      return;
    }

    setSubmitting(true);
    try {
      const saved = await onSave(tool.id, patch);
      if (saved) {
        setBaseline(draft);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="admin-metadata-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>{t('metadata.kicker')}</p>
          <h2 id="admin-metadata-heading" className={styles.sectionTitle}>
            {t('metadata.title')}
          </h2>
        </div>
      </div>
      <Card>
        <form
          className={styles.metadataForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <h3 className={styles.formGroupTitle}>{t('metadata.zhSection')}</h3>
          <TextField
            id="admin-metadata-zh-name"
            label={labels.zhName}
            value={draft.zhName}
            maxLength={200}
            onChange={(event) => updateField('zhName', event.target.value)}
            error={errors.zhName !== undefined}
            errorText={errors.zhName}
          />
          <TextField
            id="admin-metadata-zh-summary"
            label={labels.zhSummary}
            value={draft.zhSummary}
            maxLength={400}
            multiline
            rows={2}
            onChange={(event) => updateField('zhSummary', event.target.value)}
            error={errors.zhSummary !== undefined}
            errorText={errors.zhSummary}
          />
          <TextField
            id="admin-metadata-zh-description"
            label={labels.zhDescription}
            value={draft.zhDescription}
            maxLength={1000}
            multiline
            rows={3}
            onChange={(event) =>
              updateField('zhDescription', event.target.value)
            }
            error={errors.zhDescription !== undefined}
            errorText={errors.zhDescription}
          />
          <h3 className={styles.formGroupTitle}>{t('metadata.enSection')}</h3>
          <TextField
            id="admin-metadata-en-name"
            label={labels.enName}
            value={draft.enName}
            maxLength={200}
            onChange={(event) => updateField('enName', event.target.value)}
            error={errors.enName !== undefined}
            errorText={errors.enName}
          />
          <TextField
            id="admin-metadata-en-summary"
            label={labels.enSummary}
            value={draft.enSummary}
            maxLength={400}
            multiline
            rows={2}
            onChange={(event) => updateField('enSummary', event.target.value)}
            error={errors.enSummary !== undefined}
            errorText={errors.enSummary}
          />
          <TextField
            id="admin-metadata-en-description"
            label={labels.enDescription}
            value={draft.enDescription}
            maxLength={1000}
            multiline
            rows={3}
            onChange={(event) =>
              updateField('enDescription', event.target.value)
            }
            error={errors.enDescription !== undefined}
            errorText={errors.enDescription}
          />
          <TextField
            id="admin-metadata-order"
            label={t('metadata.orderLabel')}
            type="number"
            value={draft.order}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                order: event.target.value,
              }));
              setOrderError(undefined);
            }}
            error={orderError !== undefined}
            errorText={orderError}
          />
          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="filled"
              disabled={submitting || !dirty}
            >
              {submitting ? t('actions.saving') : t('actions.save')}
            </Button>
            <Button
              variant="text"
              disabled={submitting || !dirty}
              onClick={() => {
                setDraft(baseline);
                setErrors({});
                setOrderError(undefined);
              }}
            >
              {t('actions.discard')}
            </Button>
          </div>
          {!dirty ? (
            <p className={styles.muted}>{t('metadata.noChanges')}</p>
          ) : null}
        </form>
      </Card>
    </section>
  );
}
