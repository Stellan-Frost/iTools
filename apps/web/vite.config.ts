import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: [
          '@itools/design-system-adapter',
          'm3-expressive-react',
          '@material/material-color-utilities',
        ],
      },
    },
  },
});
