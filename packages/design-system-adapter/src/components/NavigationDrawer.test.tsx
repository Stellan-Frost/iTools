// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NavigationDrawer } from './NavigationDrawer.js';

afterEach(cleanup);

describe('NavigationDrawer adapter', () => {
  it('uses the app rectangle token on the trailing corners', () => {
    render(
      <NavigationDrawer data-testid="drawer" style={{ width: '320px' }}>
        Drawer content
      </NavigationDrawer>,
    );

    const drawer = screen.getByTestId('drawer');

    expect(drawer.style.borderStartEndRadius).toBe(
      'var(--itools-shape-corner-rectangle)',
    );
    expect(drawer.style.borderEndEndRadius).toBe(
      'var(--itools-shape-corner-rectangle)',
    );
    expect(drawer.style.width).toBe('320px');
  });
});
