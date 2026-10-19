import { IconButton, SearchBar } from '@itools/design-system-adapter';
import { AppIcon } from '../app-icon/AppIcon.js';
import styles from './ToolSearchEntry.module.css';

interface ToolSearchEntryProps {
  onOpenSearch: () => void;
  onOpenNavigation?: () => void;
  navigationExpanded?: boolean;
}

/** Shared MD3 search control for the app bar and the home page. */
export function ToolSearchEntry({
  onOpenSearch,
  onOpenNavigation,
  navigationExpanded,
}: ToolSearchEntryProps) {
  return (
    <SearchBar
      className={styles.searchEntry}
      placeholder="搜索工具"
      onClick={onOpenSearch}
      onSearch={onOpenSearch}
      inputProps={{ 'aria-label': '搜索工具', readOnly: true }}
      startIcon={
        onOpenNavigation ? (
          <IconButton
            className={styles.navigationButton}
            style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }}
            icon={<AppIcon name="menu" />}
            aria-label="打开导航抽屉和工具分类"
            aria-expanded={navigationExpanded}
            aria-controls="mobile-navigation-drawer"
            onClick={(event) => {
              event.stopPropagation();
              onOpenNavigation();
            }}
          />
        ) : (
          <AppIcon name="search" />
        )
      }
    />
  );
}
