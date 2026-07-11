import { defineConfig, devices } from '@playwright/test';

const webServer = process.env.STAGING_E2E_API_URL
  ? undefined
  : {
      command: 'VITE_PAYMENT_PROVIDER=square VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-dummy VITE_SQUARE_LOCATION_ID=dummy VITE_SQUARE_ENVIRONMENT=sandbox npm run dev:site -- --port 3101',
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    };

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3101',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
