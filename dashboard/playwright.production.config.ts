import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.DASHBOARD_SMOKE_BASE_URL || process.env.PRODUCTION_DASHBOARD_URL;
const vercelBypassSecret =
  process.env.DASHBOARD_SMOKE_VERCEL_BYPASS_SECRET ||
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: vercelBypassSecret
      ? {
          'x-vercel-protection-bypass': vercelBypassSecret,
          'x-vercel-set-bypass-cookie': 'samesitenone',
        }
      : undefined,
  },
  projects: [
    { name: 'production-smoke', use: { ...devices['Desktop Chrome'] } },
  ],
});
