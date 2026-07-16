import { expect, Page, test } from '@playwright/test';

const DEFAULT_ROUTES = [
  '/',
  '/bookings',
  '/customers',
  '/fleet',
  '/calendar',
  '/check-ins',
  '/payments',
  '/revenue',
  '/portal',
  '/growth',
  '/marketing',
  '/insurance',
  '/telematics',
  '/settings',
];

const RUNTIME_ERROR_TEXT = /ReferenceError|TypeError|is not defined|Cannot read properties|Application error|Something went wrong/i;
const VERCEL_PROTECTION_TEXT = /Vercel Authentication|Authentication Required|Log in to Vercel|Protected Deployment/i;

function smokeRoutes() {
  return (process.env.DASHBOARD_SMOKE_ROUTES || DEFAULT_ROUTES.join(','))
    .split(',')
    .map(route => route.trim())
    .filter(Boolean);
}

async function assertNotBlockedByVercel(page: Page) {
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  if (VERCEL_PROTECTION_TEXT.test(bodyText)) {
    throw new Error(
      'Vercel Authentication is blocking the production smoke test. Set DASHBOARD_SMOKE_VERCEL_BYPASS_SECRET or VERCEL_AUTOMATION_BYPASS_SECRET.'
    );
  }
}

async function assertNoRuntimeCrash(page: Page) {
  await expect(page.locator('body')).not.toContainText(RUNTIME_ERROR_TEXT);
}

async function signIn(page: Page) {
  const email = process.env.DASHBOARD_SMOKE_EMAIL;
  const password = process.env.DASHBOARD_SMOKE_PASSWORD;

  if (!email || !password) {
    throw new Error('Set DASHBOARD_SMOKE_EMAIL and DASHBOARD_SMOKE_PASSWORD for production dashboard smoke tests.');
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await assertNotBlockedByVercel(page);

  if (!new URL(page.url()).pathname.startsWith('/login')) {
    return;
  }

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }).catch(async () => {
    const message = await page.locator('[role="alert"], body').first().innerText().catch(() => 'Login did not complete.');
    throw new Error(`Production smoke login failed: ${message}`);
  });
}

test.describe('authenticated production dashboard smoke', () => {
  test.skip(
    !process.env.DASHBOARD_SMOKE_BASE_URL && !process.env.PRODUCTION_DASHBOARD_URL,
    'Set DASHBOARD_SMOKE_BASE_URL or PRODUCTION_DASHBOARD_URL.'
  );

  test('signs in and verifies protected dashboard routes', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && RUNTIME_ERROR_TEXT.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });

    await signIn(page);

    for (const routePath of smokeRoutes()) {
      const errorCountBeforeRoute = runtimeErrors.length;
      const response = await page.goto(routePath, { waitUntil: 'domcontentloaded' });

      if (response && response.status() >= 500) {
        throw new Error(`${routePath} returned HTTP ${response.status()}`);
      }

      await assertNotBlockedByVercel(page);
      await expect(page, `${routePath} should remain authenticated`).not.toHaveURL(/\/login(?:$|[?#/])/);
      await expect(page.locator('h1').first(), `${routePath} should render a page heading`).toBeVisible();
      await assertNoRuntimeCrash(page);

      const newErrors = runtimeErrors.slice(errorCountBeforeRoute);
      expect(newErrors, `${routePath} should not emit runtime errors`).toEqual([]);
    }

    await page.goto('/fleet', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /sheet/i }).click();
    await expect(page.getByRole('columnheader', { name: /vehicle/i })).toBeVisible();
    await expect(page.getByText(/by type/i)).toBeVisible();
    await expect(page.getByText(/by model/i)).toBeVisible();

    await page.goto('/marketing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /assets/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: /^assets$/i })).toBeVisible();
    await page.getByRole('button', { name: /seo/i }).click();
    await expect(page.getByRole('heading', { name: /seo workspace/i })).toBeVisible();
  });
});
