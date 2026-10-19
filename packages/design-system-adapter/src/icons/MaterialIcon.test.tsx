// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MaterialIcon } from './MaterialIcon.js';

afterEach(cleanup);

describe('MaterialIcon', () => {
  it('marks decorative symbols hidden and gives labelled symbols an image role', () => {
    const { container } = render(
      <>
        <MaterialIcon name="search" />
        <MaterialIcon name="upload_file" aria-label="Upload file" size={20} />
      </>,
    );

    expect(
      container.querySelector('.material-symbols-rounded[aria-hidden="true"]'),
    ).toHaveTextContent('search');
    expect(screen.getByRole('img', { name: 'Upload file' })).toHaveTextContent(
      'upload_file',
    );
    expect(screen.getByRole('img', { name: 'Upload file' })).toHaveStyle({
      fontSize: '20px',
    });
  });
});
