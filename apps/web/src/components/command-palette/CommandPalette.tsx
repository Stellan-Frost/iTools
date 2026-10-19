import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Button, Dialog, TextField } from '@itools/design-system-adapter';
import { getCategory, searchVisibleTools } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { PreviewBadge } from '../app-shell/PreviewBadge.js';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation('common');
  const { locale, navigate } = useAppNavigation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => searchVisibleTools(query, locale),
    [query, locale],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function selectActiveResult() {
    const selectedTool = results[activeIndex];
    if (!selectedTool) return;
    navigate({ page: 'tool', toolId: selectedTool.metadata.id });
    onClose();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0 ? 0 : (index + 1) % results.length,
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0
          ? 0
          : (index - 1 + results.length) % results.length,
      );
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectActiveResult();
    }
  }

  return (
    <Dialog
      open={open}
      aria-hidden={!open}
      inert={!open}
      onClose={onClose}
      title={t('search.dialogTitle')}
    >
      <div className={styles.content}>
        <TextField
          id="tool-search"
          label={t('search.openLabel')}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          inputRef={(element) => {
            if (open) element?.focus();
          }}
          inputProps={{
            autoComplete: 'off',
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': 'tool-search-results',
            'aria-activedescendant': results[activeIndex]
              ? `tool-option-${results[activeIndex].metadata.id}`
              : undefined,
            onKeyDown: handleInputKeyDown,
          }}
          startIcon={<AppIcon name="search" />}
        />
        <div className={styles.resultHeader}>
          <span>{t('search.sampleLabel')}</span>
          <span>{t('search.resultCount', { count: results.length })}</span>
        </div>
        {results.length > 0 ? (
          <ul
            className={styles.results}
            id="tool-search-results"
            role="listbox"
            aria-label={t('search.resultsLabel')}
          >
            {results.map((entry, index) => {
              const category = getCategory(entry.metadata.category);
              const isActive = activeIndex === index;
              return (
                <li key={entry.metadata.id}>
                  <Button
                    className={styles.result}
                    variant={isActive ? 'tonal' : 'text'}
                    role="option"
                    aria-selected={isActive}
                    id={`tool-option-${entry.metadata.id}`}
                    startIcon={<AppIcon name={entry.metadata.icon} />}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      navigate({ page: 'tool', toolId: entry.metadata.id });
                      onClose();
                    }}
                  >
                    <span className={styles.resultCopy}>
                      <span className={styles.resultHeading}>
                        <span className={styles.resultTitle}>
                          {entry.metadata.name[locale]}
                        </span>
                        {entry.availability === 'preview' ? (
                          <PreviewBadge />
                        ) : null}
                      </span>
                      <span className={styles.resultMeta}>
                        {category?.name[locale]} · {t('search.previewSuffix')}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty} role="status">
            {t('search.empty')}
          </p>
        )}
      </div>
    </Dialog>
  );
}
