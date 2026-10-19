import { forwardRef } from 'react';
import {
  Dialog as MaterialDialog,
  type DialogProps,
} from 'm3-expressive-react';

/** Keeps the Dialog surface at 48px using its app shape token. */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  function AppDialog({ style, ...props }, ref) {
    return (
      <MaterialDialog
        {...props}
        ref={ref}
        style={{ ...style, borderRadius: 'var(--itools-shape-corner-dialog)' }}
      />
    );
  },
);

export type { DialogProps };
