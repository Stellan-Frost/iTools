import { useTranslation } from 'react-i18next';
import styles from './PreviewBadge.module.css';

/**
 * 预览条目的统一标识。壳层与页面共用同一实现，避免两套徽标样式。
 * 徽标对辅助技术隐藏，状态语义由相邻的预览说明文本承载，
 * 这样不会改变按钮与对话框原有的可访问名称。
 */
export function PreviewBadge() {
  const { t } = useTranslation('common');

  return (
    <span className={styles.badge} data-preview-badge="true" aria-hidden="true">
      {t('availability.preview')}
    </span>
  );
}
