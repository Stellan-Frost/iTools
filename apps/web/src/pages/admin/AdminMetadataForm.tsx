import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  TextField,
  useSnackbar,
} from '@itools/design-system-adapter';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { MetadataChip } from '../../components/page-chrome/MetadataChip.js';
import styles from './AdminPage.module.css';

export function AdminMetadataForm() {
  const [title, setTitle] = useState('图片信息检查');
  const [description, setDescription] = useState(
    '检查图片文件的基础信息，并预览适合的后续处理方式。',
  );
  const [formError, setFormError] = useState('');
  const [formFeedback, setFormFeedback] = useState('');
  const { show } = useSnackbar();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('工具名称和简介都需要填写。');
      setFormFeedback('');
      return;
    }

    setFormError('');
    setFormFeedback('表单校验通过。修改只存在当前页面内存中，没有写入目录。');
    void show({
      message: '表单校验通过 · 没有保存到后台。',
      duration: 'short',
    });
  }

  return (
    <section aria-labelledby="metadata-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p>METADATA FORM</p>
          <h2 id="metadata-heading">元数据编辑样本</h2>
        </div>
        <MetadataChip label="图片信息检查" />
      </div>
      <Card>
        <form
          className={styles.metadataForm}
          onSubmit={handleSubmit}
          noValidate
        >
          <TextField
            id="admin-tool-title"
            label="工具名称"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (formError) setFormError('');
            }}
            error={Boolean(formError && !title.trim())}
            errorText={
              formError && !title.trim() ? '请填写工具名称。' : undefined
            }
            required
          />
          <TextField
            id="admin-tool-description"
            label="工具简介"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (formError) setFormError('');
            }}
            error={Boolean(formError && !description.trim())}
            errorText={
              formError && !description.trim() ? '请填写工具简介。' : undefined
            }
            multiline
            rows={3}
            maxLength={180}
            required
          />
          <div className={styles.formSummary}>
            <span>所属分类</span>
            <MetadataChip label="图像与设计" />
            <span>标识符</span>
            <code>image-inspector</code>
          </div>
          {formError ? (
            <PreviewNotice tone="error">{formError}</PreviewNotice>
          ) : null}
          {formFeedback ? (
            <PreviewNotice tone="success">{formFeedback}</PreviewNotice>
          ) : null}
          <div className={styles.formActions}>
            <Button type="submit" variant="filled">
              验证表单样本
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setTitle('图片信息检查');
                setDescription(
                  '检查图片文件的基础信息，并预览适合的后续处理方式。',
                );
                setFormError('');
                setFormFeedback('');
              }}
            >
              重置样本
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
