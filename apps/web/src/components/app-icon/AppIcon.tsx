import { MaterialIcon } from '@itools/design-system-adapter';

interface AppIconProps {
  name: string;
}

export function AppIcon({ name }: AppIconProps) {
  return <MaterialIcon name={name} aria-hidden="true" />;
}
