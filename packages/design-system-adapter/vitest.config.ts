import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // MCU 0.4.0 ships ESM files with extensionless internal imports; let
        // Vite resolve them instead of asking native Node to load them.
        inline: ['@material/material-color-utilities'],
      },
    },
  },
});
