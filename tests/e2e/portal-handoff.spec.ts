import { expect, Page, test } from '@playwright/test';

function portalToken(bookingCode: string, email = 'driver@example.com') {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    bookingCode,
    email,
    adminPreview: true,
  };
  return `test.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
}

function booking(status: 'ready_for_pickup' | 'active') {
  return {
    id: `booking-${status}`,
    booking_code: `PORTAL-${status}`,
    booking_number: `PORTAL-${status}`,
    status,
    pickup_date: '2026-08-01',
    return_date: '2026-08-08',
    pickup_time: '09:00',
    return_time: '09:00',
    total_cost: 56000,
    deposit_amount: 50000,
    amount_paid: 56000,
    balance_due: 0,
    unlimited_miles: false,
    unlimited_tolls: false,
    addons: [],
    payments: [],
    checkinRecords: [],
    customers: {
      first_name: 'Taylor',
      last_name: 'Driver',
      email: 'driver@example.com',
      phone: '555-0100',
    },
    vehicles: {
      year: 2024,
      make: 'Toyota',
      model: 'Camry',
      vehicle_code: 'CAMRY-1',
      vin: '4T1C11AK0RU123456',
      thumbnail_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%232563eb'/%3E%3C/svg%3E",
      photo_urls: [],
    },
  };
}

async function mockPortalApis(page: Page, status: 'ready_for_pickup' | 'active') {
  let uploadCount = 0;
  await page.route('**/portal/booking', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(booking(status)) });
  });
  await page.route('**/portal/lockbox', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lockbox_code: '1234' }) });
  });
  await page.route('**/uploads/checkin-photos', async (route) => {
    uploadCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        photos: [{
          url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='%2322c55e'/%3E%3C/svg%3E`,
          path: `test/photo-${uploadCount}.webp`,
          bucket: 'checkin-photos',
        }],
      }),
    });
  });
  await page.route('**/portal/checkin', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lockbox_code: '1234' }) });
  });
  await page.route('**/portal/checkout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/portal/balance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalCost: 560, paid: 560, amountDue: 0, amountDueCents: 0 }),
    });
  });
  await page.route('**/push/vapid-key', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false }) });
  });
}

async function uploadRequiredPhotos(page: Page) {
  const file = {
    name: 'handoff.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  };
  const inputs = page.locator('input[type="file"]');
  for (let i = 0; i < 4; i += 1) {
    await inputs.nth(i).setInputFiles(file);
  }
  await expect(page.getByText('4/4 required')).toBeVisible();
}

test('ready booking opens guided customer check-in flow', async ({ page }) => {
  const code = 'PORTAL-ready_for_pickup';
  await mockPortalApis(page, 'ready_for_pickup');
  await page.goto(`/portal?code=${code}&preview_token=${encodeURIComponent(portalToken(code))}`);

  await page.getByRole('button', { name: /start check-in/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Start your rental' })).toBeVisible();
  await page.getByRole('button', { name: /start photos/i }).click();
  await uploadRequiredPhotos(page);
  await page.getByRole('button', { name: /add details/i }).click();
  await page.locator('input[type="number"]').fill('42350');
  await page.getByRole('button', { name: /review pickup/i }).click();
  await expect(page.getByText(/ready to unlock/i)).toBeVisible();
  await page.getByRole('checkbox').check();

  const checkInRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/portal/checkin')
  );
  await page.getByRole('button', { name: /reveal key code/i }).click();
  await checkInRequest;
});

test('active booking opens guided customer return flow', async ({ page }) => {
  const code = 'PORTAL-active';
  await mockPortalApis(page, 'active');
  await page.goto(`/portal?code=${code}&preview_token=${encodeURIComponent(portalToken(code))}`);

  await page.getByRole('button', { name: /return vehicle/i }).first().click();
  await expect(page.locator('h3', { hasText: 'Return your vehicle' })).toBeVisible();
  await page.getByRole('button', { name: /start photos/i }).click();
  await uploadRequiredPhotos(page);
  await page.getByRole('button', { name: /return details/i }).click();
  await page.locator('input[type="number"]').fill('42410');
  await page.getByRole('button', { name: /review return/i }).click();
  await expect(page.getByText(/final return check/i)).toBeVisible();
  await page.getByRole('checkbox').check();

  const checkOutRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/portal/checkout')
  );
  await page.getByRole('button', { name: /complete return/i }).click();
  await checkOutRequest;
});

test('portal does not eager-load payment config when no balance is due', async ({ page }) => {
  const code = 'PORTAL-active';
  const paymentConfigRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/stripe/public-config')) paymentConfigRequests.push(request.url());
  });

  await mockPortalApis(page, 'active');
  await page.goto(`/portal?code=${code}&preview_token=${encodeURIComponent(portalToken(code))}`);
  await expect(page.getByText('Toyota Camry')).toBeVisible();
  await expect(page.getByRole('img', { name: /2024 Toyota Camry/i })).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await page.waitForTimeout(500);

  expect(paymentConfigRequests).toEqual([]);
});
