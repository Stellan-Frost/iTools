// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppThemeProvider } from './AppThemeProvider.js';

afterEach(cleanup);

describe('AppThemeProvider', () => {
  it('provides deterministic light and dark Material 3 roles to its subtree', () => {
    const { rerender } = render(
      <AppThemeProvider mode="light">
        <span data-testid="child">Theme content</span>
      </AppThemeProvider>,
    );
    const child = screen.getByTestId('child');
    const provider = child.parentElement!;

    expect(provider.dataset.mdColorScheme).toBe('light');
    expect(provider.style.getPropertyValue('--md-sys-color-primary')).toBe(
      '#ad1c60',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-primary-dim')).toBe(
      '#9c0854',
    );

    rerender(
      <AppThemeProvider mode="dark">
        <span data-testid="child">Theme content</span>
      </AppThemeProvider>,
    );

    expect(provider.dataset.mdColorScheme).toBe('dark');
    expect(provider.style.getPropertyValue('--md-sys-color-primary')).toBe(
      '#ff88b2',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-primary-dim')).toBe(
      '#ff69a3',
    );
  });
});
