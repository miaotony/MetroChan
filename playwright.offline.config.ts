import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/offline',
  outputDir: './test-results/offline',
  workers: 1,
  use: {
    browserName: 'chromium',
    offline: true,
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROME_BIN },
  },
});
