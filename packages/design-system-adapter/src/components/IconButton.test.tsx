// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconButton } from './IconButton.js';

afterEach(cleanup);

describe('IconButton', () => {
  it('keeps its public surface circular while preserving other consumer styles', () => {
    const buttonRef = createRef<HTMLButtonElement>();

    render(
      <IconButton
        aria-label="Open menu"
        icon={<span>menu</span>}
        ref={buttonRef}
        style={{ borderRadius: '0', color: 'red' }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Open menu' });

    expect(button.style.borderRadius).toBe('var(--md-sys-shape-corner-full)');
    expect(button.style.color).toBe('red');
    expect(buttonRef.current).toBe(button);
  });
});
