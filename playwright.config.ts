import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5201';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node dist/index.js',
    cwd: 'apps/server',
    url: `${baseURL}/api/v1/health/live`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '5201',
      SITE_ORIGIN: baseURL,
      WEB_ROOT: '../web',
      DATABASE_URL: '',
      ADMIN_SETUP_TOKEN: '',
    },
  },
});
