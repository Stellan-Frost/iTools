// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from './Dialog.js';
import { AppThemeProvider } from '../theme/AppThemeProvider.js';

afterEach(cleanup);

describe('Dialog adapter', () => {
  it('uses the 48px app token on its surface and passes content through unchanged', () => {
    render(
      <AppThemeProvider mode="light">
        <Dialog open title="Details" style={{ width: '400px' }}>
          <span data-testid="dialog-content">Content</span>
        </Dialog>
      </AppThemeProvider>,
    );

    const surface = screen.getByRole('dialog');
    const content = screen.getByTestId('dialog-content');

    expect(surface.style.borderRadius).toBe(
      'var(--itools-shape-corner-dialog)',
    );
    expect(surface.style.width).toBe('400px');
    expect(content.parentElement?.style.length).toBe(0);
  });
});
