import {
  IconButton as MaterialIconButton,
  type IconButtonProps,
} from 'm3-expressive-react';

/** Keeps the app's icon button circular in every library interaction state. */
export function IconButton({ style, ...props }: IconButtonProps) {
  return (
    <MaterialIconButton
      {...props}
      style={{ ...style, borderRadius: 'var(--md-sys-shape-corner-full)' }}
    />
  );
}

export type { IconButtonProps };
