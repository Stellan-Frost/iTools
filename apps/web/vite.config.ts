import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  ssr: {
    // 这些包在 Node ESM 下不能安全外置（D15）：省略扩展名的内部导入会导致 SSR 失败。
    noExternal: [
      'm3-expressive-react',
      '@itools/design-system-adapter',
      '@material/material-color-utilities',
      '@itools/app-core',
    ],
  },
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
