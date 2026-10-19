import { Button, Dialog } from '@itools/design-system-adapter';
import { getCategory, type ToolDefinition } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './ToolInfoDialog.module.css';

interface ToolInfoDialogProps {
  tool: ToolDefinition | null;
  onClose: () => void;
  onNavigate: (toolId: string) => void;
}

export function ToolInfoDialog({
  tool,
  onClose,
  onNavigate,
}: ToolInfoDialogProps) {
  if (!tool) return null;

  const category = getCategory(tool.categoryId);

  return (
    <Dialog
      open
      onClose={onClose}
      title={<span className={styles.title}>{tool.title}</span>}
      icon={<AppIcon name={tool.icon} />}
      actions={
        <div className={styles.actions}>
          <Button variant="text" onClick={onClose} data-autofocus>
            关闭
          </Button>
          <Button variant="filled" onClick={() => onNavigate(tool.id)}>
            前往
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <p className={styles.eyebrow}>工具样本 · 界面预览</p>
        <p className={styles.description}>{tool.summary}</p>
        <dl className={styles.metadata}>
          <div>
            <dt>分类</dt>
            <dd>
              <span>{category?.name ?? '样本分类'}</span>
              {category ? <span>{category.description}</span> : null}
            </dd>
          </div>
          <div>
            <dt>输入样本</dt>
            <dd>
              <span>{tool.inputLabel}</span>
              <code>{tool.sampleInput}</code>
            </dd>
          </div>
          <div>
            <dt>{tool.workspaceTitle}</dt>
            <dd>
              <ul>
                {tool.workspaceLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
