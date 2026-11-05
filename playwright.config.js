import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/casefolk/',
    viewport: { width: 1100, height: 900 },
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173/casefolk/',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
