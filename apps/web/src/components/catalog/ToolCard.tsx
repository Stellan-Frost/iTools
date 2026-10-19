import { Button, Card } from '@itools/design-system-adapter';
import type { ToolDefinition } from '../../data/sample-catalog.js';
import { AppIcon } from '../app-icon/AppIcon.js';
import { MetadataChip } from '../page-chrome/MetadataChip.js';
import styles from './ToolCard.module.css';

interface ToolCardProps {
  tool: ToolDefinition;
  categoryName: string;
  onOpen: () => void;
}

export function ToolCard({ tool, categoryName, onOpen }: ToolCardProps) {
  return (
    <Card>
      <article className={styles.card}>
        <div className={styles.iconWrap}>
          <AppIcon name={tool.icon} />
        </div>
        <div className={styles.copy}>
          <div className={styles.heading}>
            <h3>{tool.title}</h3>
            <MetadataChip label={categoryName} />
          </div>
          <p>{tool.summary}</p>
          <Button variant="text" onClick={onOpen}>
            打开工具预览
          </Button>
        </div>
      </article>
    </Card>
  );
}
