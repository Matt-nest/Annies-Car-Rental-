import { expect, test } from '@playwright/test';

const apiUrl = (process.env.STAGING_E2E_API_URL || process.env.VITE_API_URL || '').replace(/\/$/, '');
const enabled = process.env.STAGING_E2E === '1' && Boolean(apiUrl);
const codePrefix = process.env.STAGING_E2E_CODE_PREFIX || 'ANNSTAGE';
const paymentProvider = process.env.STAGING_E2E_PAYMENT_PROVIDER || 'square';

const expectedStatuses = [
  { code: `${codePrefix}-PENDING`, status: 'pending_approval', awaitingPayment: false },
  { code: `${codePrefix}-PAYDUE`, status: 'approved', awaitingPayment: true },
  { code: `${codePrefix}-ACTIVE`, status: 'active', awaitingPayment: false },
  { code: `${codePrefix}-RETURN`, status: 'returned', awaitingPayment: false },
  { code: `${codePrefix}-DONE`, status: 'completed', awaitingPayment: false },
];

test.skip(!enabled, 'Set STAGING_E2E=1 and STAGING_E2E_API_URL to verify seeded staging data.');

test.describe('staging seed customer API', () => {
  for (const expected of expectedStatuses) {
    test(`${expected.code} exposes the seeded booking status`, async ({ request }) => {
      const response = await request.get(`${apiUrl}/bookings/status/${expected.code}`);

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.booking_code).toBe(expected.code);
      expect(body.status).toBe(expected.status);
      expect(body.awaiting_payment).toBe(expected.awaitingPayment);
      expect(body.vehicle).toBeTruthy();
      expect(body.next_step?.label).toBeTruthy();
    });
  }

  test(`${codePrefix}-PAYDUE exposes a payment summary without creating a charge`, async ({ request }) => {
    const response = await request.get(`${apiUrl}/${paymentProvider}/booking-summary/${codePrefix}-PAYDUE`);

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.alreadyPaid).toBeFalsy();
    expect(body.booking?.booking_code || body.booking?.bookingCode).toBe(`${codePrefix}-PAYDUE`);
    expect(body.booking?.totalCost ?? body.booking?.total_cost).toBeGreaterThan(0);
  });
});
