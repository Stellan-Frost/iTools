import { IconButton, SearchBar } from '@itools/design-system-adapter';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['common', 'navigation']);
  const searchLabel = t('common:search.openLabel');

  return (
    <SearchBar
      className={styles.searchEntry}
      placeholder={searchLabel}
      onClick={onOpenSearch}
      onSearch={onOpenSearch}
      inputProps={{ 'aria-label': searchLabel, readOnly: true }}
      startIcon={
        onOpenNavigation ? (
          <IconButton
            className={styles.navigationButton}
            icon={<AppIcon name="menu" />}
            aria-label={t('navigation:openNavigation')}
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
