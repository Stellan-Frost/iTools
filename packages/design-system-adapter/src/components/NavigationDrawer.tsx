import { forwardRef } from 'react';
import {
  NavigationDrawer as MaterialNavigationDrawer,
  type NavigationDrawerProps,
} from 'm3-expressive-react';

/** Applies the app rectangle token to the drawer's rounded trailing edge. */
export const NavigationDrawer = forwardRef<HTMLElement, NavigationDrawerProps>(
  function AppNavigationDrawer({ style, ...props }, ref) {
    return (
      <MaterialNavigationDrawer
        {...props}
        ref={ref}
        style={{
          ...style,
          borderStartEndRadius: 'var(--itools-shape-corner-rectangle)',
          borderEndEndRadius: 'var(--itools-shape-corner-rectangle)',
        }}
      />
    );
  },
);
