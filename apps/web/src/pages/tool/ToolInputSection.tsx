import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import type { ToolDefinition } from '../../data/sample-catalog.js';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import styles from './ToolPage.module.css';

interface ToolInputSectionProps {
  tool: ToolDefinition;
}

export function ToolInputSection({ tool }: ToolInputSectionProps) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [feedback, setFeedback] = useState('');
  const { show } = useSnackbar();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) {
      setInputError('请填写样本内容后查看表单反馈。');
      setFeedback('');
      return;
    }

    setInputError('');
    setFeedback('表单校验通过。这是交互反馈样本，没有创建任务或处理数据。');
    await show({
      message: '校验通过 · 当前为界面预览，没有执行工具。',
      duration: 'short',
    });
  }

  return (
    <section aria-labelledby="tool-input-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.step}>01</span>
        <div>
          <h2 id="tool-input-heading">输入</h2>
          <p>提供输入区域和可恢复的字段校验反馈。</p>
        </div>
      </div>
      <Card>
        <form className={styles.inputForm} onSubmit={handleSubmit} noValidate>
          <TextField
            id="tool-sample-input"
            label={tool.inputLabel}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (inputError) setInputError('');
            }}
            error={Boolean(inputError)}
            errorText={inputError || undefined}
            supportingText={`示例内容：${tool.sampleInput.split('\n')[0]}`}
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
              查看校验反馈样本
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setInput(tool.sampleInput);
                setInputError('');
                setFeedback('');
              }}
            >
              填入示例文本
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
