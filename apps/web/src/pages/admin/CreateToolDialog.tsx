import { useState } from 'react';
import {
  Button,
  Dialog,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import { AppIcon } from '../../components/app-icon/AppIcon.js';
import styles from './AdminPage.module.css';

export function CreateToolDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [toolName, setToolName] = useState('');
  const [error, setError] = useState('');
  const { show } = useSnackbar();

  function validatePreview() {
    if (!toolName.trim()) {
      setError('请填写工具名称后查看对话框校验反馈。');
      return;
    }

    setError('');
    setIsOpen(false);
    setToolName('');
    void show({
      message: '新增表单样本校验通过 · 没有创建目录记录。',
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
        新增工具样本
      </Button>
      <Dialog
        open={isOpen}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onClose={() => {
          setIsOpen(false);
          setError('');
        }}
        title="新增工具样本"
        actions={
          <>
            <Button
              variant="text"
              onClick={() => {
                setIsOpen(false);
                setError('');
              }}
            >
              取消
            </Button>
            <Button variant="text" onClick={validatePreview}>
              查看校验反馈
            </Button>
          </>
        }
      >
        <div className={styles.dialogBody}>
          <p>填写一个名称以查看新增流程的校验反馈。该样本不会进入目录。</p>
          <TextField
            id="new-tool-name"
            label="工具名称"
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
