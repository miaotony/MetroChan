import { defineConfig } from '@playwright/test';

const original = 'http://127.0.0.1:4317/';
const prefix = process.env.TEST_PREFIX ?? '/';
const candidate = `http://127.0.0.1:4318${prefix}`;
process.env.BASELINE_URL = original;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: {
    baseURL: candidate,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROME_BIN },
  },
  webServer: [
    { command: 'python3 tests/serve.py original', url: original },
    { command: 'python3 tests/serve.py candidate', url: candidate },
  ],
});
