import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, 'tests/e2e/.auth/state.json');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',

  // Run global setup once before the entire suite to authenticate and save session
  globalSetup: './tests/e2e/global-setup.ts',

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // All tests share the saved session — no per-test login needed
    storageState: AUTH_STATE_PATH,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
