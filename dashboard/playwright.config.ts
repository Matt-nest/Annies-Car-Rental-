import { defineConfig, devices } from '@playwright/test';

const webServer = process.env.STAGING_E2E_API_URL
  ? undefined
  : {
      command: 'VITE_E2E_AUTH_BYPASS=true VITE_API_URL=http://127.0.0.1:3201/api/v1 VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=dummy VITE_PAYMENT_PROVIDER=square VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-dummy VITE_SQUARE_LOCATION_ID=dummy VITE_SQUARE_ENVIRONMENT=sandbox npm run dev -- --host 127.0.0.1 --port 3201',
      url: 'http://127.0.0.1:3201',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    };

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3201',
    trace: 'on-first-retry',
  },
  webServer,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
  ],
});
