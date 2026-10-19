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
      '#00675d',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-primary-dim')).toBe(
      '#005a51',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-on-primary')).toBe(
      '#c0fff4',
    );
    expect(
      provider.style.getPropertyValue('--itools-shape-corner-rectangle'),
    ).toBe('3rem');
    expect(
      provider.style.getPropertyValue('--md-sys-shape-corner-medium'),
    ).toBe('var(--itools-shape-corner-rectangle)');
    expect(provider.style.getPropertyValue('--md-sys-shape-corner-full')).toBe(
      '',
    );

    rerender(
      <AppThemeProvider mode="dark">
        <span data-testid="child">Theme content</span>
      </AppThemeProvider>,
    );

    expect(provider.dataset.mdColorScheme).toBe('dark');
    expect(provider.style.getPropertyValue('--md-sys-color-primary')).toBe(
      '#b4fff2',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-primary-dim')).toBe(
      '#00fde7',
    );
    expect(provider.style.getPropertyValue('--md-sys-color-on-primary')).toBe(
      '#00665c',
    );
  });
});
