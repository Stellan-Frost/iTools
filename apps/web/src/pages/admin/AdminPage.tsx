import { useState } from 'react';
import { PageHeading } from '../../components/page-chrome/PageHeading.js';
import { PreviewNotice } from '../../components/page-chrome/PreviewNotice.js';
import { tools } from '../../data/sample-catalog.js';
import { AdminCatalogSection } from './AdminCatalogSection.js';
import { AdminFeedbackExamples } from './AdminFeedbackExamples.js';
import { AdminMetadataForm } from './AdminMetadataForm.js';
import { CreateToolDialog } from './CreateToolDialog.js';
import styles from './AdminPage.module.css';

export function AdminPage() {
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        tools
          .slice(0, 4)
          .map((tool) => [tool.id, tool.id !== 'regex-playground']),
      ),
  );

  function updateToolEnabled(toolId: string, isEnabled: boolean) {
    setEnabledTools((current) => ({ ...current, [toolId]: isEnabled }));
  }

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="目录维护 · 界面预览"
        title="管理后台样本"
        description="查看工具状态、元数据编辑和反馈样本。所有修改都只在当前页面内存中。"
        actions={<CreateToolDialog />}
      />

      <PreviewNotice>
        预览模式：没有管理员认证、数据库或目录写入 API。
      </PreviewNotice>

      <div className={styles.adminGrid}>
        <AdminCatalogSection
          enabledTools={enabledTools}
          onToggleTool={updateToolEnabled}
        />
        <AdminMetadataForm />
      </div>

      <AdminFeedbackExamples />
    </div>
  );
}
