import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Button, Dialog, TextField } from '@itools/design-system-adapter';
import { categories, tools, getCategory } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenTool: (toolId: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  onOpenTool,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return tools.filter((tool) => {
      const category = getCategory(tool.categoryId)?.name ?? '';
      return (
        !search ||
        `${tool.title} ${tool.summary} ${category}`
          .toLocaleLowerCase()
          .includes(search)
      );
    });
  }, [query]);

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
    onOpenTool(selectedTool.id);
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
      title="搜索工具"
    >
      <div className={styles.content}>
        <TextField
          id="tool-search"
          label="搜索工具"
          placeholder="按名称、说明或分类搜索"
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
              ? `tool-option-${results[activeIndex].id}`
              : undefined,
            onKeyDown: handleInputKeyDown,
          }}
          startIcon={<AppIcon name="search" />}
          supportingText="使用 ↑ ↓ 浏览，Enter 打开，Esc 关闭。"
        />
        <div className={styles.resultHeader}>
          <span>工具样本</span>
          <span>{results.length} 项</span>
        </div>
        {results.length > 0 ? (
          <ul
            className={styles.results}
            id="tool-search-results"
            role="listbox"
            aria-label="工具搜索结果"
          >
            {results.map((tool, index) => {
              const category = categories.find(
                (entry) => entry.id === tool.categoryId,
              );
              const isActive = activeIndex === index;
              return (
                <li key={tool.id}>
                  <Button
                    className={styles.result}
                    variant={isActive ? 'tonal' : 'text'}
                    role="option"
                    aria-selected={isActive}
                    id={`tool-option-${tool.id}`}
                    startIcon={<AppIcon name={tool.icon} />}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onOpenTool(tool.id);
                      onClose();
                    }}
                  >
                    <span className={styles.resultCopy}>
                      <span className={styles.resultTitle}>{tool.title}</span>
                      <span className={styles.resultMeta}>
                        {category?.name} · 界面预览
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty} role="status">
            没有匹配的样本工具。试试“文档”或“JSON”。
          </p>
        )}
      </div>
    </Dialog>
  );
}
