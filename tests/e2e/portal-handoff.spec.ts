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

type PortalStatus = 'ready_for_pickup' | 'active' | 'returned' | 'completed';

const photoDataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='%2322c55e'/%3E%3C/svg%3E";

function finalPacket() {
  return {
    generated_at: '2026-08-08T14:00:00.000Z',
    available: true,
    booking: { id: 'booking-returned', booking_code: 'PORTAL-returned', status: 'returned' },
    customer: { first_name: 'Taylor', last_name: 'Driver', email: 'driver@example.com', phone: '555-0100' },
    vehicle: { label: '2024 Toyota Camry' },
    agreement: { customer_signed_at: '2026-08-01T13:00:00.000Z', owner_signed_at: '2026-08-01T13:05:00.000Z' },
    pickup: {
      odometer: 42350,
      fuel_level: 'full',
      photos: [{ slot: 'front', url: photoDataUrl, record_type: 'customer_checkin' }],
    },
    return: {
      odometer: 42410,
      fuel_level: 'three_quarter',
      photos: [{ slot: 'rear', url: photoDataUrl, record_type: 'customer_checkout' }],
    },
    settlement: {
      deposit: { amount_cents: 50000, status: 'partial_refund', applied_amount_cents: 12500, refund_amount_cents: 37500 },
      mileage: { pickup_odometer: 42350, return_odometer: 42410, miles_driven: 60 },
      fuel: { pickup_fuel_level: 'full', return_fuel_level: 'three_quarter' },
      cleaning: [{ id: 'cleaning-1', type: 'cleaning', description: 'Interior cleaning', amount_cents: 2500 }],
      incidentals: [{ id: 'cleaning-1', type: 'cleaning', description: 'Interior cleaning', amount_cents: 2500 }],
      payments: {
        completed: [{ id: 'payment-1', method: 'card', status: 'completed', amount_cents: 56000 }],
        declines: [{ id: 'decline-1', method: 'card', status: 'failed', amount_cents: 12500, failure_code: 'generic_decline' }],
        refunds: [{ id: 'refund-1', method: 'card', status: 'completed', amount_cents: -37500 }],
      },
      totals: {
        incidental_total_cents: 12500,
        toll_total_cents: 4500,
        completed_payment_total_cents: 56000,
        failed_payment_count: 1,
        refund_total_cents: 37500,
        balance_due_cents: 0,
        refund_due_cents: 37500,
      },
    },
  };
}

function booking(status: PortalStatus) {
  const packet = status === 'returned' || status === 'completed' ? finalPacket() : null;
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
    deposit: packet ? { amount: 50000, status: 'partial_refund', refund_amount: 37500 } : null,
    invoice: packet ? { items: [{ description: 'Cleaning and tolls', amount: 12500 }], amount_due: -37500 } : null,
    finalPacket: packet,
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

async function mockPortalApis(page: Page, status: PortalStatus) {
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
  await page.route('**/portal/final-packet/pdf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n%final-packet-test\n%%EOF'),
    });
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

test('returned booking shows final packet settlement and downloads packet PDF', async ({ page }) => {
  const code = 'PORTAL-returned';
  await mockPortalApis(page, 'returned');
  await page.goto(`/portal?code=${code}&preview_token=${encodeURIComponent(portalToken(code))}`);

  await page.getByRole('button', { name: /money/i }).click();
  await expect(page.getByText('Final Rental Packet')).toBeVisible();
  await expect(page.getByText('Pickup evidence, return evidence, and final settlement.')).toBeVisible();
  await expect(page.getByText('Pickup', { exact: true })).toBeVisible();
  await expect(page.getByText('Return', { exact: true })).toBeVisible();
  await expect(page.getByText('60 mi')).toBeVisible();
  await expect(page.getByText('$45.00')).toBeVisible();
  await expect(page.getByText('Declines')).toBeVisible();

  const packetRequest = page.waitForRequest((request) =>
    request.method() === 'GET' && request.url().includes('/portal/final-packet/pdf')
  );
  await page.getByRole('button', { name: /^PDF$/i }).click();
  await packetRequest;
});
