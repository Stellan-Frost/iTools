import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import { findTool, getCategory } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './AdminPage.module.css';

const REFERENCE_TOOL_ID = 'image-inspector';

export function AdminMetadataForm() {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('admin');
  const { show } = useSnackbar();

  const referenceTool = findTool(REFERENCE_TOOL_ID);
  const referenceCategory = referenceTool
    ? getCategory(referenceTool.categoryId)
    : undefined;
  const defaultName = referenceTool ? referenceTool.name[locale] : '';
  const defaultSummary = referenceTool ? referenceTool.description[locale] : '';

  const [title, setTitle] = useState(defaultName);
  const [description, setDescription] = useState(defaultSummary);
  const [formError, setFormError] = useState('');
  const [formFeedback, setFormFeedback] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError(t('metadata.bothRequired'));
      setFormFeedback('');
      return;
    }

    setFormError('');
    setFormFeedback(t('metadata.success'));
    void show({
      message: t('metadata.snackbar'),
      duration: 'short',
    });
  }

  return (
    <section aria-labelledby="metadata-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p>{t('metadata.kicker')}</p>
          <h2 id="metadata-heading">{t('metadata.title')}</h2>
        </div>
        <MetadataChip label={defaultName} />
      </div>
      <Card>
        <form
          className={styles.metadataForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <TextField
            id="admin-tool-title"
            label={t('metadata.nameLabel')}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (formError) setFormError('');
            }}
            error={Boolean(formError && !title.trim())}
            errorText={
              formError && !title.trim()
                ? t('metadata.nameRequired')
                : undefined
            }
            required
          />
          <TextField
            id="admin-tool-description"
            label={t('metadata.summaryLabel')}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (formError) setFormError('');
            }}
            error={Boolean(formError && !description.trim())}
            errorText={
              formError && !description.trim()
                ? t('metadata.summaryRequired')
                : undefined
            }
            multiline
            rows={3}
            maxLength={180}
            required
          />
          <div className={styles.formSummary}>
            <span>{t('metadata.categoryLabel')}</span>
            <MetadataChip
              label={
                referenceCategory
                  ? referenceCategory.name[locale]
                  : t('metadata.categoryLabel')
              }
            />
            <span>{t('metadata.idLabel')}</span>
            <code>{referenceTool ? referenceTool.id : REFERENCE_TOOL_ID}</code>
          </div>
          {formError ? (
            <PreviewNotice tone="error">{formError}</PreviewNotice>
          ) : null}
          {formFeedback ? (
            <PreviewNotice tone="success">{formFeedback}</PreviewNotice>
          ) : null}
          <div className={styles.formActions}>
            <Button type="submit" variant="filled">
              {t('metadata.submit')}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setTitle(defaultName);
                setDescription(defaultSummary);
                setFormError('');
                setFormFeedback('');
              }}
            >
              {t('metadata.reset')}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
