import { Card, TextField } from '@itools/design-system-adapter';
import type { RegistryEntry } from '@itools/app-core';
import { useTranslation } from 'react-i18next';
import { useAppNavigation } from '../../app/navigation.js';
import styles from './ToolPage.module.css';

interface ToolInputSectionProps {
  tool: RegistryEntry;
}

/**
 * 预览态输入区：只读展示元数据中的示例输入，不提供提交、校验或填充交互。
 */
export function ToolInputSection({ tool }: ToolInputSectionProps) {
  const { locale } = useAppNavigation();
  const { t } = useTranslation('catalog');

  const preview = tool.metadata.preview;
  const multiline =
    tool.metadata.id === 'markdown-preview' ||
    tool.metadata.id === 'json-viewer';

  return (
    <section aria-labelledby="tool-input-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>01</span>
        <div>
          <h2 id="tool-input-heading">{t('catalog:tool.input.title')}</h2>
        </div>
      </div>
      <Card>
        <div className={styles.inputForm}>
          <TextField
            id="tool-sample-input"
            label={preview.inputLabel[locale]}
            value={preview.sampleInput[locale]}
            disabled
            readOnly
            supportingText={t('catalog:tool.previewInputHint')}
            multiline={multiline}
            rows={multiline ? 4 : 2}
          />
        </div>
      </Card>
    </section>
  );
}
