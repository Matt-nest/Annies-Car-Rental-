import { expect, test } from '@playwright/test';

const apiUrl = (process.env.STAGING_E2E_API_URL || process.env.VITE_API_URL || '').replace(/\/$/, '');
const adminToken = process.env.STAGING_E2E_ADMIN_TOKEN || '';
const enabled = process.env.STAGING_E2E === '1' && Boolean(apiUrl) && Boolean(adminToken);
const codePrefix = process.env.STAGING_E2E_CODE_PREFIX || 'ANNSTAGE';

const expectedStatuses = [
  { code: `${codePrefix}-PENDING`, status: 'pending_approval' },
  { code: `${codePrefix}-PAYDUE`, status: 'approved' },
  { code: `${codePrefix}-ACTIVE`, status: 'active' },
  { code: `${codePrefix}-RETURN`, status: 'returned' },
  { code: `${codePrefix}-DONE`, status: 'completed' },
];

const headers = () => ({ Authorization: `Bearer ${adminToken}` });

test.skip(
  !enabled,
  'Set STAGING_E2E=1, STAGING_E2E_API_URL, and STAGING_E2E_ADMIN_TOKEN to verify seeded staging dashboard data.'
);

test.describe('staging seed dashboard API', () => {
  test('bookings list exposes each seeded booking state', async ({ request }) => {
    const response = await request.get(`${apiUrl}/bookings`, { headers: headers() });

    expect(response.ok()).toBeTruthy();
    const bookings = await response.json();
    expect(Array.isArray(bookings)).toBeTruthy();

    for (const expected of expectedStatuses) {
      const booking = bookings.find((item: any) => item.booking_code === expected.code);
      expect(booking, `${expected.code} should be present in /bookings`).toBeTruthy();
      expect(booking.status).toBe(expected.status);
    }
  });

  test('seeded booking details expose customer, vehicle, payment, and deposit surfaces', async ({ request }) => {
    const listResponse = await request.get(`${apiUrl}/bookings`, { headers: headers() });
    expect(listResponse.ok()).toBeTruthy();
    const bookings = await listResponse.json();

    for (const expected of expectedStatuses) {
      const listed = bookings.find((item: any) => item.booking_code === expected.code);
      expect(listed, `${expected.code} should be present in /bookings`).toBeTruthy();

      const detailResponse = await request.get(`${apiUrl}/bookings/${listed.id}`, { headers: headers() });
      expect(detailResponse.ok()).toBeTruthy();
      const detail = await detailResponse.json();

      expect(detail.booking_code).toBe(expected.code);
      expect(detail.status).toBe(expected.status);
      expect(detail.customers).toBeTruthy();
      expect(detail.vehicles).toBeTruthy();

      const paymentResponse = await request.get(`${apiUrl}/bookings/${listed.id}/payments`, { headers: headers() });
      expect(paymentResponse.ok()).toBeTruthy();
      expect(Array.isArray(await paymentResponse.json())).toBeTruthy();

      const depositResponse = await request.get(`${apiUrl}/bookings/${listed.id}/deposit`, { headers: headers() });
      expect(depositResponse.ok()).toBeTruthy();
    }
  });
});
