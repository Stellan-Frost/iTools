import styles from './MetadataChip.module.css';

interface MetadataChipProps {
  label: string;
}

export function MetadataChip({ label }: MetadataChipProps) {
  return <span className={styles.chip}>{label}</span>;
}
