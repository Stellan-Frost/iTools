import { forwardRef } from 'react';
import {
  IconButton as MaterialIconButton,
  type IconButtonProps,
} from 'm3-expressive-react';

/** Keeps the app's icon button circular in every library interaction state. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ style, ...props }, ref) {
    return (
      <MaterialIconButton
        {...props}
        ref={ref}
        style={{ ...style, borderRadius: 'var(--md-sys-shape-corner-full)' }}
      />
    );
  },
);

export type { IconButtonProps };
