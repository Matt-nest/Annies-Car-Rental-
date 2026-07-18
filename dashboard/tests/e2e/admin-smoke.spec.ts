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

const customer = {
  id: 'customer-e2e-1',
  first_name: 'Taylor',
  last_name: 'Driver',
  email: 'taylor@example.com',
  phone: '555-0100',
  driver_license_number: 'D1234567',
  driver_license_state: 'SC',
  driver_license_expiry: '2028-01-01',
  is_trusted: true,
  sms_opt_out: false,
  active_rentals: 1,
  upcoming_rentals: 0,
  completed_rentals: 2,
  payment_due_count: 0,
  needs_docs_count: 0,
  insurance_review_count: 0,
  total_revenue: 1420,
  total_bookings: 3,
  last_booking_at: '2026-07-20T14:00:00.000Z',
  current_booking: booking,
  latest_booking: booking,
  verification: {
    id_on_file: true,
    insurance_on_file: true,
    insurance_verified: true,
    agreement_on_file: true,
    sms_opt_out: false,
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

const packetPhoto = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='%2322c55e'/%3E%3C/svg%3E";

const packetBooking = {
  ...booking,
  id: 'booking-packet-complete',
  booking_code: 'E2E-PACKET-001',
  status: 'completed',
  payment_status: 'paid',
  deposit_status: 'partial_refund',
  booking_status_log: [],
};

const finalPacket = {
  generated_at: '2026-08-08T14:00:00.000Z',
  available: true,
  booking: { id: 'booking-packet-complete', booking_code: 'E2E-PACKET-001', status: 'completed' },
  customer: { first_name: 'Taylor', last_name: 'Driver', email: 'taylor@example.com', phone: '555-0100' },
  vehicle: { label: '2024 Toyota Camry' },
  agreement: { customer_signed_at: '2026-08-01T13:00:00.000Z', owner_signed_at: '2026-08-01T13:05:00.000Z' },
  pickup: {
    odometer: 42350,
    fuel_level: 'full',
    photos: [{ slot: 'front', url: packetPhoto, record_type: 'customer_checkin' }],
  },
  return: {
    odometer: 42410,
    fuel_level: 'three_quarter',
    photos: [{ slot: 'rear', url: packetPhoto, record_type: 'customer_checkout' }],
  },
  settlement: {
    deposit: { amount_cents: 50000, status: 'partial_refund', applied_amount_cents: 12500, refund_amount_cents: 37500 },
    mileage: { pickup_odometer: 42350, return_odometer: 42410, miles_driven: 60 },
    fuel: { pickup_fuel_level: 'full', return_fuel_level: 'three_quarter' },
    incidentals: [{ id: 'charge-1', type: 'cleaning', description: 'Interior cleaning', amount_cents: 2500 }],
    tolls: [{ id: 'toll-1', description: 'Turnpike toll', amount_cents: 4500 }],
    payments: {
      completed: [{ id: 'payment-1', method: 'card', status: 'completed', amount_cents: 56000, reference_id: 'sq_e2e' }],
      declines: [{ id: 'decline-1', method: 'card', status: 'failed', amount_cents: 12500, failure_code: 'generic_decline' }],
      refunds: [{ id: 'refund-1', method: 'card', status: 'completed', amount_cents: -37500, reference_id: 'rf_e2e' }],
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

const depositReviewRow = {
  id: 'deposit-review-e2e',
  booking_id: 'booking-packet-complete',
  amount: 50000,
  status: 'held',
  refund_amount: 12500,
  applied_amount: 5000,
  created_at: '2026-08-08T14:00:00.000Z',
  review_required: true,
  bookings: {
    id: 'booking-packet-complete',
    booking_code: 'E2E-PACKET-001',
    status: 'completed',
    pickup_date: '2026-08-01',
    return_date: '2026-08-08',
    customers: {
      first_name: 'Taylor',
      last_name: 'Driver',
      email: 'taylor@example.com',
    },
    vehicles: {
      year: 2024,
      make: 'Toyota',
      model: 'Camry',
      vehicle_code: 'CAM-001',
    },
  },
};

async function mockDashboardApi(page: Page) {
  await page.route('**/designs.html**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><h1>Print Asset Pack</h1><img alt="Booking QR code" src="/brand/marketing-qr.png"></body></html>',
    });
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');

    let body: unknown = {};
    if (path === '/users/me') {
      body = { id: 'e2e-admin', first_name: 'E2E', last_name: 'Admin', role: 'owner', email: 'e2e-admin@example.com' };
    } else if (path === '/portal/admin-preview') {
      body = { url: 'https://example.test/portal?code=E2E-BOOKING-001&preview_token=preview-token' };
    } else if (path === '/customers') {
      body = [customer];
    } else if (path === '/customers/customer-e2e-1') {
      body = customer;
    } else if (path === '/customers/customer-e2e-1/bookings') {
      body = [booking];
    } else if (path === '/messaging/conversations') {
      body = [{
        customer_id: 'customer-e2e-1',
        last_message: 'Customer asked about pickup window',
        last_direction: 'inbound',
        last_channel: 'sms',
        last_at: '2026-07-16T12:20:00.000Z',
        customer,
      }];
    } else if (path === '/messaging/conversations/customer-e2e-1/messages') {
      body = [];
    } else if (path === '/messaging/twilio/activity') {
      body = {
        configured: true,
        source: 'twilio',
        generatedAt: '2026-07-16T12:30:00.000Z',
        calls: [{
          id: 'CA-e2e-missed',
          source: 'twilio',
          direction: 'inbound',
          status: 'no-answer',
          from: '+15550100',
          to: '+17722071655',
          startedAt: '2026-07-16T12:15:00.000Z',
          durationSeconds: 0,
          customerName: 'Taylor Driver',
          customerPhone: '555-0100',
          summary: 'Missed voicemail request',
        }],
        messages: [{
          id: 'SM-e2e-text',
          source: 'twilio',
          direction: 'outbound',
          status: 'delivered',
          from: '+17722071655',
          to: '+15550100',
          body: 'Customer asked about pickup window',
          sentAt: '2026-07-16T12:20:00.000Z',
          customerName: 'Taylor Driver',
          customerPhone: '555-0100',
        }],
      };
    } else if (path === '/marketing/workspace') {
      body = {
        persistent: true,
        summary: {
          campaigns: 1,
          activeCampaigns: 1,
          links: 1,
          totalClicks: 14,
          referrals: 1,
          referralRevenue: 560,
          totalBookings: 1,
        },
        campaigns: [{
          id: 'campaign-e2e-1',
          name: 'Summer Weekly Rentals',
          audience: 'Local weekly renters',
          channel: 'print',
          offer: '$25 off first week',
          goal: 'More direct rental leads',
          status: 'active',
          budget: 150,
        }],
        links: [{
          id: 'link-e2e-1',
          name: 'Vehicle Window QR',
          assetKey: 'vehicle_window_qr',
          destinationUrl: 'https://anniescarrental.com/',
          utmUrl: 'https://anniescarrental.com/?utm_source=print&utm_medium=decal&utm_campaign=summer-weekly-rentals',
          clicks: 14,
        }],
        referrals: [{
          id: 'referral-e2e-1',
          name: 'Hotel Partner',
          code: 'ANNIE-HOTEL',
          offer: '$25 off first rental',
          bookings: 1,
          revenue: 560,
        }],
      };
    } else if (path === '/bookings/booking-packet-complete/final-packet/pdf') {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4\n%final-packet-test\n%%EOF'),
      });
      return;
    } else if (path === '/bookings/booking-packet-complete/final-packet') {
      body = finalPacket;
    } else if (path === '/bookings/booking-packet-complete/deposit') {
      body = { amount: 50000, status: 'partial_refund', refund_amount: 37500 };
    } else if (path === '/bookings/booking-packet-complete/invoice') {
      body = { id: 'invoice-packet', amount_due: -37500, deposit_applied: 12500, items: [{ description: 'Cleaning and tolls', amount: 12500 }] };
    } else if (path === '/bookings/booking-packet-complete/incidentals') {
      body = finalPacket.settlement.incidentals;
    } else if (path === '/bookings/booking-packet-complete/checkin-records') {
      body = [];
    } else if (path === '/bookings/booking-packet-complete/extensions') {
      body = [];
    } else if (path === '/bookings/booking-packet-complete') {
      body = packetBooking;
    } else if (path.startsWith('/deposits')) {
      const status = url.searchParams.get('status');
      const rows = status === 'review_required' || status === 'held' || status === 'all'
        ? [depositReviewRow]
        : [];
      const total = rows.reduce((sum, row) => (
        sum + Math.max(0, Number(row.amount || 0) - Number(row.refund_amount || 0) - Number(row.applied_amount || 0))
      ), 0);
      body = {
        data: rows,
        summary: {
          count: rows.length,
          total_held_cents: total,
          total_held_dollars: (total / 100).toFixed(2),
        },
      };
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
      body = path === '/bookings' || path.startsWith('/bookings?') ? [booking, packetBooking] : booking;
    } else if (path.startsWith('/vehicles')) {
      body = path === '/vehicles' || path.startsWith('/vehicles?') ? [vehicle] : vehicle;
    } else if (path === '/stats/overview') {
      body = {
        active_rentals: 1,
        pending_approvals: 1,
        pending_agreements: 0,
        pending_inspections: 0,
        pending_reviews: 0,
        pending_deposit_reviews: 1,
        pending_deposit_review_total: '325.00',
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

async function expectNoHorizontalOverflow(page: Page) {
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      viewport: window.innerWidth,
      docClient: doc.clientWidth,
      docScroll: doc.scrollWidth,
      bodyClient: body.clientWidth,
      bodyScroll: body.scrollWidth,
    };
  });

  const maxWidth = Math.max(metrics.viewport, metrics.docClient, metrics.bodyClient) + 2;
  expect(metrics.docScroll, `document overflow metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(maxWidth);
  expect(metrics.bodyScroll, `body overflow metrics: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(maxWidth);
}

test('protected dashboard shell renders with local auth bypass', async ({ page }) => {
  await page.goto('/');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText('Good', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /bookings/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /fleet/i }).first()).toBeVisible();
});

test('core dashboard routes stay within the viewport shell', async ({ page }) => {
  for (const route of ['/', '/bookings', '/bookings/booking-e2e-1', '/customers', '/check-ins', '/fleet', '/marketing']) {
    await page.goto(route);
    await expectNoHorizontalOverflow(page);
  }
});

test('knowledge hub lives in the profile menu instead of primary sidebar nav', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /knowledge/i })).toHaveCount(0);
  await page.getByRole('button', { name: /E2E Admin/i }).click();
  await page.getByRole('button', { name: /knowledge hub/i }).click();

  await expect(page).toHaveURL(/\/knowledge-hub/);
  await expect(page.getByRole('heading', { name: 'Knowledge Hub' })).toBeVisible();
});

test('messaging shows Twilio call log and text messages', async ({ page }) => {
  await page.goto('/messaging');

  await page.getByRole('button', { name: /twilio log/i }).click();
  await expect(page.getByRole('heading', { name: 'Call Log & Text Messages' })).toBeVisible();
  await expect(page.getByText('Missed voicemail request')).toBeVisible();
  await expect(page.getByText('Taylor Driver').first()).toBeVisible();

  await page.getByRole('button', { name: /^Text Messages$/ }).click();
  await expect(page.getByText('Customer asked about pickup window')).toBeVisible();
});

test('bookings route renders booking operations page', async ({ page }, testInfo) => {
  await page.goto('/bookings');

  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
  await expect(page.getByText('Manage rentals and reservations')).toBeVisible();
  const bookingCode = page.locator('.mono-code', { hasText: 'E2E-BOOKING-001' });
  await expect(testInfo.project.name.includes('mobile') ? bookingCode.last() : bookingCode.first()).toBeVisible();

  const previewRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/portal/admin-preview')
  );
  await (testInfo.project.name.includes('mobile')
    ? page.getByRole('button', { name: /view customer portal/i }).first()
    : page.getByTitle('Open customer portal preview').first()
  ).click();
  await previewRequest;
});

test('check-ins board handles mixed date formats without runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/v1/bookings?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          ...booking,
          id: 'booking-confirmed-ready',
          booking_code: 'E2E-PICKUP-READY',
          status: 'confirmed',
          pickup_date: '2026-07-14',
          pickup_time: '09:30:00',
          return_date: '2026-07-18',
          return_time: '10:00',
          payments: [{ payment_type: 'rental', status: 'completed' }],
          rental_agreements: [{ signed_at: '2026-07-10T12:00:00.000Z', owner_signed_at: '2026-07-10T12:05:00.000Z' }],
        },
        {
          ...booking,
          id: 'booking-active-due',
          booking_code: 'E2E-DUE-BACK',
          status: 'active',
          pickup_date: '2026-07-10T09:00:00.000Z',
          pickup_time: '09:00',
          return_date: '2026-07-14',
          return_time: '17:00:00',
        },
        {
          ...booking,
          id: 'booking-returned-settle',
          booking_code: 'E2E-RETURNED',
          status: 'returned',
          pickup_date: 1783693200000,
          pickup_time: '09:00',
          return_date: '2026-07-13T17:00:00.000Z',
          return_time: '17:00',
        },
      ]),
    });
  });

  await page.goto('/check-ins');

  await expect(page.getByRole('heading', { name: 'Check-In / Check-Out Board' })).toBeVisible();
  await expect(page.getByText('E2E-DUE-BACK')).toBeVisible();
  await expect(page.getByText('E2E-RETURNED')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('active checkout records return before completing without sending invoice', async ({ page }) => {
  const calls: string[] = [];
  let overrideApplied = false;
  let completedApplied = false;
  const activeBooking = {
    ...booking,
    id: 'booking-active-complete',
    booking_code: 'E2E-ACTIVE-COMPLETE',
    status: 'active',
    payment_status: 'paid',
    deposit_status: 'paid',
    pickup_date: '2026-07-10',
    return_date: '2026-07-14',
    checkin_odometer: 1000,
    checkout_override_at: null as string | null,
    booking_status_log: [],
  };

  await page.unroute('**/api/v1/**');
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    const withOverride = {
      ...activeBooking,
      status: completedApplied ? 'completed' : activeBooking.status,
      checkout_override_at: overrideApplied ? '2026-07-14T15:00:00.000Z' : null,
    };

    let body: unknown = {};
    if (path === '/users/me') {
      body = { id: 'e2e-admin', first_name: 'E2E', last_name: 'Admin', role: 'owner', email: 'e2e-admin@example.com' };
    } else if (path === '/bookings/booking-active-complete/checkout-override' && method === 'POST') {
      calls.push('override');
      overrideApplied = true;
      body = { ok: true, booking: { ...activeBooking, checkout_override_at: '2026-07-14T15:00:00.000Z' } };
    } else if (path === '/bookings/booking-active-complete/checkout' && method === 'POST') {
      calls.push('checkout');
      body = { ok: true };
    } else if (path === '/bookings/booking-active-complete/inspection' && method === 'POST') {
      calls.push('inspection');
      body = { ok: true, incidentals: [] };
    } else if (path === '/bookings/booking-active-complete/return' && method === 'POST') {
      calls.push('return');
      body = { ok: true, new_status: 'returned' };
    } else if (path === '/bookings/booking-active-complete/invoice' && method === 'POST') {
      calls.push('invoice');
      body = { id: 'invoice-e2e', status: 'draft', amount_due: 0, deposit_applied: 0, items: [] };
    } else if (path === '/bookings/booking-active-complete/complete' && method === 'POST') {
      calls.push('complete');
      completedApplied = true;
      body = { ok: true, status: 'completed' };
    } else if (path === '/bookings/booking-active-complete/deposit') {
      body = { amount: 50000, status: 'held' };
    } else if (path === '/bookings/booking-active-complete/invoice') {
      body = null;
    } else if (path === '/bookings/booking-active-complete/incidentals') {
      body = [];
    } else if (path === '/bookings/booking-active-complete/checkin-records') {
      body = [];
    } else if (path === '/bookings/booking-active-complete/extensions') {
      body = [];
    } else if (path === '/bookings/booking-active-complete') {
      body = withOverride;
    } else if (path.startsWith('/bookings')) {
      body = [withOverride];
    } else if (path.startsWith('/vehicles')) {
      body = path === '/vehicles' || path === '/vehicles/available' || path.startsWith('/vehicles?') ? [vehicle] : vehicle;
    } else if (path === '/notifications/unread-count') {
      body = { count: 0 };
    } else if (path.startsWith('/notifications') || path.startsWith('/search') || path.startsWith('/damage-reports') || path.startsWith('/agreements/pending-counter-sign')) {
      body = path.startsWith('/search') ? { bookings: [], customers: [], vehicles: [], payments: [] } : [];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/bookings/booking-active-complete');
  await page.getByRole('button', { name: /go to check-out/i }).click();
  await expect(page.getByText(/hasn't ended their trip yet/i)).toBeVisible();

  await page.getByRole('button', { name: /override/i }).click();
  await page.getByRole('button', { name: /confirm override/i }).click();
  await expect(page.getByRole('button', { name: /next: review charges/i })).toBeVisible();

  await page.getByRole('spinbutton').fill('1100');
  await page.getByRole('button', { name: /next: review charges/i }).click();
  await page.getByRole('button', { name: /next: finalize/i }).click();
  await page.getByRole('button', { name: /complete without sending invoice/i }).click();

  await expect(page.getByRole('heading', { name: 'Rental Complete' })).toBeVisible();
  expect(calls).toEqual(['override', 'checkout', 'inspection', 'invoice', 'return', 'complete']);
});

test('checkout finalize recovers when return was already recorded by a prior attempt', async ({ page }) => {
  const calls: string[] = [];
  let overrideApplied = false;
  let returnConflictSeen = false;
  let completedApplied = false;
  const activeBooking = {
    ...booking,
    id: 'booking-stale-return-complete',
    booking_code: 'E2E-STALE-RETURN',
    status: 'active',
    payment_status: 'paid',
    deposit_status: 'paid',
    pickup_date: '2026-07-10',
    return_date: '2026-07-14',
    checkin_odometer: 1000,
    checkout_override_at: null as string | null,
    booking_status_log: [],
  };

  await page.unroute('**/api/v1/**');
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    const currentStatus = completedApplied ? 'completed' : returnConflictSeen ? 'returned' : activeBooking.status;
    const currentBooking = {
      ...activeBooking,
      status: currentStatus,
      checkout_override_at: overrideApplied ? '2026-07-14T15:00:00.000Z' : null,
    };

    if (path === '/bookings/booking-stale-return-complete/return' && method === 'POST') {
      calls.push('return-conflict');
      returnConflictSeen = true;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: "Cannot transition from 'returned' to 'returned'" }),
      });
      return;
    }

    let body: unknown = {};
    if (path === '/users/me') {
      body = { id: 'e2e-admin', first_name: 'E2E', last_name: 'Admin', role: 'owner', email: 'e2e-admin@example.com' };
    } else if (path === '/bookings/booking-stale-return-complete/checkout-override' && method === 'POST') {
      calls.push('override');
      overrideApplied = true;
      body = { ok: true, booking: { ...activeBooking, checkout_override_at: '2026-07-14T15:00:00.000Z' } };
    } else if (path === '/bookings/booking-stale-return-complete/checkout' && method === 'POST') {
      calls.push('checkout');
      body = { ok: true };
    } else if (path === '/bookings/booking-stale-return-complete/inspection' && method === 'POST') {
      calls.push('inspection');
      body = { ok: true, incidentals: [] };
    } else if (path === '/bookings/booking-stale-return-complete/invoice' && method === 'POST') {
      calls.push('invoice');
      body = { id: 'invoice-stale-return', status: 'draft', amount_due: 0, deposit_applied: 0, items: [] };
    } else if (path === '/bookings/booking-stale-return-complete/complete' && method === 'POST') {
      calls.push('complete');
      completedApplied = true;
      body = { ok: true, status: 'completed' };
    } else if (path === '/bookings/booking-stale-return-complete/deposit') {
      body = { amount: 50000, status: 'held' };
    } else if (path === '/bookings/booking-stale-return-complete/invoice') {
      body = null;
    } else if (path === '/bookings/booking-stale-return-complete/incidentals') {
      body = [];
    } else if (path === '/bookings/booking-stale-return-complete/checkin-records') {
      body = [];
    } else if (path === '/bookings/booking-stale-return-complete/extensions') {
      body = [];
    } else if (path === '/bookings/booking-stale-return-complete') {
      body = currentBooking;
    } else if (path.startsWith('/bookings')) {
      body = [currentBooking];
    } else if (path.startsWith('/vehicles')) {
      body = path === '/vehicles' || path === '/vehicles/available' || path.startsWith('/vehicles?') ? [vehicle] : vehicle;
    } else if (path === '/notifications/unread-count') {
      body = { count: 0 };
    } else if (path.startsWith('/notifications') || path.startsWith('/search') || path.startsWith('/damage-reports') || path.startsWith('/agreements/pending-counter-sign')) {
      body = path.startsWith('/search') ? { bookings: [], customers: [], vehicles: [], payments: [] } : [];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/bookings/booking-stale-return-complete');
  await page.getByRole('button', { name: /go to check-out/i }).click();
  await expect(page.getByText(/hasn't ended their trip yet/i)).toBeVisible();

  await page.getByRole('button', { name: /override/i }).click();
  await page.getByRole('button', { name: /confirm override/i }).click();
  await expect(page.getByRole('button', { name: /next: review charges/i })).toBeVisible();

  await page.getByRole('spinbutton').fill('1100');
  await page.getByRole('button', { name: /next: review charges/i }).click();
  await page.getByRole('button', { name: /next: finalize/i }).click();
  await page.getByRole('button', { name: /complete without sending invoice/i }).click();

  await expect(page.getByRole('heading', { name: 'Rental Complete' })).toBeVisible();
  expect(calls).toEqual(['override', 'checkout', 'inspection', 'invoice', 'return-conflict', 'complete']);
});

test('fleet route renders vehicle inventory page', async ({ page }) => {
  await page.goto('/fleet');

  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await expect(page.getByText('Manage your vehicle inventory')).toBeVisible();
  await expect(page.getByText('Toyota Camry').first()).toBeVisible();
  await expect(page.getByText(/by type/i)).toBeVisible();
  await expect(page.getByText(/by model/i)).toBeVisible();

  await page.getByRole('button', { name: /sheet/i }).click();
  await expect(page.getByRole('columnheader', { name: /vehicle/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
  await expect(page.getByText('CAM-001')).toBeVisible();
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
  await expect(page.getByRole('button', { name: /view customer portal/i })).toBeVisible();
});

test('booking detail portal preview calls the admin preview endpoint', async ({ page }) => {
  await page.goto('/bookings/booking-e2e-1');

  const previewRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/portal/admin-preview')
  );
  await page.getByRole('button', { name: /view customer portal/i }).click();
  await previewRequest;
});

test('booking detail final packet tab renders evidence and downloads PDF', async ({ page }) => {
  await page.goto('/bookings/booking-packet-complete');

  await page.getByRole('button', { name: /final packet/i }).click();
  await expect(page.getByRole('heading', { name: 'Final Rental Packet' })).toBeVisible();
  await expect(page.getByText('Pickup Photos')).toBeVisible();
  await expect(page.getByText('Return Photos')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payments, Declines, Refunds' })).toBeVisible();
  await expect(page.getByText('Interior cleaning')).toBeVisible();
  await expect(page.getByText('generic_decline')).toBeVisible();

  const packetRequest = page.waitForRequest((request) =>
    request.method() === 'GET' && request.url().includes('/api/v1/bookings/booking-packet-complete/final-packet/pdf')
  );
  await page.getByRole('button', { name: /download pdf/i }).click();
  await packetRequest;
});

test('payments deposits tab defaults to the deposit review queue', async ({ page }) => {
  await page.goto('/payments?tab=deposits');

  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Required' })).toBeVisible();
  await expect(page.getByText('Refundable Exposure')).toBeVisible();
  await expect(page.getByText('$325.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('E2E-PACKET-001')).toBeVisible();
  await expect(page.getByText('Taylor Driver')).toBeVisible();
  await expect(page.getByText('Review required').first()).toBeVisible();
  await expect(page.getByText(/Inspect, apply charges, or refund/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /apply/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /release/i })).toBeEnabled();
});

test('customers route shows operational profile data and portal preview action', async ({ page }, testInfo) => {
  await page.goto('/customers');

  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await expect(testInfo.project.name.includes('mobile')
    ? page.getByText('Taylor Driver').last()
    : page.getByText('Taylor Driver').first()
  ).toBeVisible();
  await expect(page.getByText('Lifetime Value')).toBeVisible();

  const previewRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/portal/admin-preview')
  );
  await (testInfo.project.name.includes('mobile')
    ? page.getByTitle('Open customer portal preview').last()
    : page.getByTitle('Open customer portal preview').first()
  ).click();
  await previewRequest;
});

test('marketing workspace renders assets, tabs, and SEO tools', async ({ page }) => {
  await page.goto('/marketing');

  await expect(page.getByRole('heading', { name: 'Marketing Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: /assets/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /^Assets$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Design & Print Studio Preview' })).toBeVisible();
  await expect(page.locator('iframe[title="Design and print asset preview"]')).toBeVisible();

  await page.locator('summary').filter({ hasText: 'Asset index and file links' }).click();
  await expect(page.getByRole('heading', { name: 'Brand File Library' })).toBeVisible();
  await expect(page.locator('h3', { hasText: 'Vehicle Window QR' })).toBeVisible();

  await page.getByRole('button', { name: /campaigns/i }).click();
  await expect(page.getByRole('heading', { name: 'Campaign Planner' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campaign examples' })).toBeVisible();

  await page.getByRole('button', { name: /qr links/i }).click();
  await expect(page.getByRole('heading', { name: 'QR & UTM Link Builder' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campaign Links' })).toBeVisible();

  await page.getByRole('button', { name: /referrals/i }).click();
  await expect(page.getByRole('heading', { name: 'Referral Engine' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Referral Codes' })).toBeVisible();
  await expect(page.getByText('ANNIE-HOTEL')).toBeVisible();

  await page.getByRole('button', { name: /seo/i }).click();
  await expect(page.getByRole('heading', { name: 'SEO Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SEO Action List' })).toBeVisible();
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
