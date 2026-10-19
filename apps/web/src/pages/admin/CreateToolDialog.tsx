import { useState } from 'react';
import {
  Button,
  Dialog,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import styles from './AdminPage.module.css';

export function CreateToolDialog() {
  const { t } = useTranslation('admin');
  const [isOpen, setIsOpen] = useState(false);
  const [toolName, setToolName] = useState('');
  const [error, setError] = useState('');
  const { show } = useSnackbar();

  function validatePreview() {
    if (!toolName.trim()) {
      setError(t('create.nameError'));
      return;
    }

    setError('');
    setIsOpen(false);
    setToolName('');
    void show({
      message: t('create.snackbar'),
      duration: 'short',
    });
  }

  return (
    <>
      <Button
        variant="filled"
        startIcon={<AppIcon name="add" />}
        onClick={() => setIsOpen(true)}
      >
        {t('create.open')}
      </Button>
      <Dialog
        open={isOpen}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onClose={() => {
          setIsOpen(false);
          setError('');
        }}
        title={t('create.title')}
        actions={
          <>
            <Button
              variant="text"
              onClick={() => {
                setIsOpen(false);
                setError('');
              }}
            >
              {t('create.cancel')}
            </Button>
            <Button variant="text" onClick={validatePreview}>
              {t('create.submit')}
            </Button>
          </>
        }
      >
        <div className={styles.dialogBody}>
          <p>{t('create.body')}</p>
          <TextField
            id="new-tool-name"
            label={t('create.nameLabel')}
            value={toolName}
            onChange={(event) => {
              setToolName(event.target.value);
              if (error) setError('');
            }}
            required
            error={Boolean(error)}
            errorText={error || undefined}
          />
        </div>
      </Dialog>
    </>
  );
}
