import { expect, Page, test } from '@playwright/test';

const booking = {
  id: 'booking-e2e-1',
  booking_code: 'E2E-BOOKING-001',
  status: 'pending_approval',
  payment_status: 'unpaid',
  created_at: '2026-07-20T14:00:00.000Z',
  pickup_date: '2026-08-01',
  return_date: '2026-08-08',
  pickup_time: '09:00',
  return_time: '09:00',
  pickup_location: 'Myrtle Beach',
  delivery_type: 'pickup',
  start_date: '2026-08-01',
  end_date: '2026-08-08',
  total_amount: 560,
  daily_rate: 80,
  rental_days: 7,
  subtotal: 560,
  delivery_fee: 0,
  discount_amount: 0,
  mileage_addon_fee: 0,
  toll_addon_fee: 0,
  tax_amount: 0,
  total_cost: 560,
  deposit_amount: 500,
  deposit_status: 'pending',
  booking_addons: [],
  payments: [],
  rental_agreements: [],
  booking_status_log: [],
  customers: {
    id: 'customer-e2e-1',
    first_name: 'Taylor',
    last_name: 'Driver',
    email: 'taylor@example.com',
    phone: '555-0100',
    driver_license_number: 'D1234567',
    driver_license_state: 'SC',
    driver_license_expiry: '2028-01-01',
  },
  vehicles: {
    id: 'vehicle-e2e-1',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    vehicle_code: 'CAM-001',
    status: 'available',
  },
};

const vehicle = {
  id: 'vehicle-e2e-1',
  vehicle_code: 'CAM-001',
  year: 2024,
  make: 'Toyota',
  model: 'Camry',
  status: 'available',
  daily_rate: 80,
  weekly_rate: 450,
  location: 'Myrtle Beach',
  license_plate: 'E2E123',
};

async function mockDashboardApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');

    let body: unknown = {};
    if (path === '/users/me') {
      body = { id: 'e2e-admin', first_name: 'E2E', last_name: 'Admin', role: 'owner', email: 'e2e-admin@example.com' };
    } else if (path.endsWith('/approve')) {
      body = { payment_link: 'https://example.test/pay/E2E-BOOKING-001', deposit_amount: 500, is_high_risk: false };
    } else if (path.endsWith('/decline')) {
      body = { ok: true };
    } else if (path.startsWith('/agreements/') && path.endsWith('/detail')) {
      body = { signed: false };
    } else if (path.endsWith('/deposit')) {
      body = { status: 'none' };
    } else if (path.endsWith('/checkin-records')) {
      body = [];
    } else if (path.endsWith('/extensions')) {
      body = [];
    } else if (path.startsWith('/bookings')) {
      body = path === '/bookings' || path.startsWith('/bookings?') ? [booking] : booking;
    } else if (path.startsWith('/vehicles')) {
      body = path === '/vehicles' || path.startsWith('/vehicles?') ? [vehicle] : vehicle;
    } else if (path === '/stats/overview') {
      body = {
        active_rentals: 1,
        pending_approvals: 1,
        pending_agreements: 0,
        pending_inspections: 0,
        pending_reviews: 0,
        deposits_held: 1,
        deposits_held_total: '500.00',
        pickups_today: [],
        returns_today: [],
        revenue_this_month: 560,
        available_vehicles: 1,
      };
    } else if (path.startsWith('/stats/revenue')) {
      body = { total: 560, series: [{ date: '2026-08-01', revenue: 560 }] };
    } else if (path === '/stats/vehicles') {
      body = [{ vehicle_id: vehicle.id, label: 'Toyota Camry', revenue: 560 }];
    } else if (path === '/stats/upcoming' || path.startsWith('/stats/activity') || path.startsWith('/stats/webhook-failures')) {
      body = [];
    } else if (path === '/notifications/unread-count') {
      body = { count: 0 };
    } else if (path.startsWith('/notifications')) {
      body = [];
    } else if (path.startsWith('/search')) {
      body = { bookings: [], customers: [], vehicles: [], payments: [] };
    } else if (path.startsWith('/agreements/pending-counter-sign')) {
      body = [];
    } else if (path.startsWith('/damage-reports')) {
      body = [];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test('protected dashboard shell renders with local auth bypass', async ({ page }) => {
  await page.goto('/');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText('Good', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /bookings/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /fleet/i }).first()).toBeVisible();
});

test('bookings route renders booking operations page', async ({ page }, testInfo) => {
  await page.goto('/bookings');

  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
  await expect(page.getByText('Manage rentals and reservations')).toBeVisible();
  const bookingCode = page.locator('.mono-code', { hasText: 'E2E-BOOKING-001' });
  await expect(testInfo.project.name.includes('mobile') ? bookingCode.last() : bookingCode.first()).toBeVisible();
});

test('fleet route renders vehicle inventory page', async ({ page }) => {
  await page.goto('/fleet');

  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await expect(page.getByText('Manage your vehicle inventory')).toBeVisible();
  await expect(page.getByText('Toyota Camry').first()).toBeVisible();
});

test('booking detail route exposes operator approval controls', async ({ page }) => {
  await page.goto('/bookings/booking-e2e-1');

  await expect(page.getByRole('heading', { name: 'E2E-BOOKING-001' })).toBeVisible();
  await expect(page.getByText('Taylor Driver')).toBeVisible();
  await expect(page.getByText('Toyota Camry').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /decline/i }).first()).toBeVisible();
  await expect(page.getByText('Customer Documents')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rental Agreement' })).toBeVisible();
});

test('booking detail approve action calls mocked approval endpoint', async ({ page }) => {
  await page.goto('/bookings/booking-e2e-1');

  await page.getByRole('button', { name: /approve/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Review & approve booking' })).toBeVisible();

  const approveRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/bookings/booking-e2e-1/approve')
  );
  await page.getByRole('button', { name: 'Approve & notify customer' }).click();
  await approveRequest;
});

test('booking detail approve failure keeps modal open and shows the backend error', async ({ page }) => {
  await page.route('**/api/v1/bookings/booking-e2e-1/approve', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Vehicle is no longer available for these dates.' }),
    });
  });

  await page.goto('/bookings/booking-e2e-1');

  await page.getByRole('button', { name: /approve/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Review & approve booking' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve & notify customer' }).click();

  await expect(page.getByRole('alert')).toContainText('Vehicle is no longer available for these dates.');
  await expect(page.getByRole('heading', { name: 'Review & approve booking' })).toBeVisible();
});

test('booking detail decline action calls mocked decline endpoint', async ({ page }) => {
  await page.goto('/bookings/booking-e2e-1');

  await page.getByRole('button', { name: /decline/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Decline Booking' })).toBeVisible();
  const reasonInput = page.getByPlaceholder('Vehicle unavailable…');
  await reasonInput.fill('Vehicle unavailable for requested dates.');

  const declineRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/bookings/booking-e2e-1/decline')
  );
  await reasonInput
    .locator('xpath=ancestor::div[contains(@class,"space-y-4")]')
    .getByRole('button', { name: 'Decline', exact: true })
    .click();
  await declineRequest;
});

test('booking detail decline failure keeps modal open and shows the backend error', async ({ page }) => {
  await page.route('**/api/v1/bookings/booking-e2e-1/decline', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Decline notification could not be queued.' }),
    });
  });

  await page.goto('/bookings/booking-e2e-1');

  await page.getByRole('button', { name: /decline/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Decline Booking' })).toBeVisible();
  const reasonInput = page.getByPlaceholder('Vehicle unavailable…');
  await reasonInput.fill('Vehicle unavailable for requested dates.');
  await reasonInput
    .locator('xpath=ancestor::div[contains(@class,"space-y-4")]')
    .getByRole('button', { name: 'Decline', exact: true })
    .click();

  await expect(page.getByText('Decline notification could not be queued.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Decline Booking' })).toBeVisible();
});
