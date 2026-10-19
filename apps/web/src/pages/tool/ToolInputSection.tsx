import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import type { CatalogTool } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolPage.module.css';

interface ToolInputSectionProps {
  tool: CatalogTool;
}

export function ToolInputSection({ tool }: ToolInputSectionProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [feedback, setFeedback] = useState('');
  const { show } = useSnackbar();

  const sampleInput = tool.preview.sampleInput[locale];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) {
      setInputError(t('tool.input.emptyError'));
      setFeedback('');
      return;
    }

    setInputError('');
    setFeedback(t('tool.input.success'));
    await show({
      message: t('tool.input.snackbar'),
      duration: 'short',
    });
  }

  return (
    <section aria-labelledby="tool-input-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>01</span>
        <div>
          <h2 id="tool-input-heading">{t('tool.input.title')}</h2>
          <p>{t('tool.input.description')}</p>
        </div>
      </div>
      <Card>
        <form className={styles.inputForm} onSubmit={handleSubmit} noValidate>
          <TextField
            id="tool-sample-input"
            label={tool.preview.inputLabel[locale]}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (inputError) setInputError('');
            }}
            error={Boolean(inputError)}
            errorText={inputError || undefined}
            supportingText={t('tool.input.samplePrefix', {
              sample: sampleInput.split('\n')[0],
            })}
            multiline={
              tool.id === 'markdown-preview' || tool.id === 'json-viewer'
            }
            rows={
              tool.id === 'markdown-preview' || tool.id === 'json-viewer'
                ? 4
                : 2
            }
            maxLength={1600}
          />
          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="filled"
              startIcon={<AppIcon name="check" />}
            >
              {t('tool.input.submit')}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setInput(sampleInput);
                setInputError('');
                setFeedback('');
              }}
            >
              {t('tool.input.fillSample')}
            </Button>
          </div>
          {feedback ? (
            <p className={styles.feedback} role="status">
              <AppIcon name="check_circle" /> {feedback}
            </p>
          ) : null}
        </form>
      </Card>
    </section>
  );
}
