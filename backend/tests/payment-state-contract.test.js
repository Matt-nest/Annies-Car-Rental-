/**
 * Payment/deposit state contract tests.
 *
 * These guard the cash/manual booking path and prevent expected deposits from
 * being treated as collected money.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveCollectedDepositCents } from '../services/invoiceService.js';
import { getPaymentMethodLabel, normalizeDashboardPaymentMethod } from '../utils/paymentMethods.js';
import { getMissingSchemaColumn, updateBookingWithSchemaFallback } from '../utils/schemaFallback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const REPO_ROOT = join(BACKEND_ROOT, '..');

function source(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

test('invoice deposit helper only counts actually held deposits', () => {
  assert.equal(resolveCollectedDepositCents(null), 0);
  assert.equal(resolveCollectedDepositCents({ status: 'pending', amount: 15000 }), 0);
  assert.equal(resolveCollectedDepositCents({ status: 'none', amount: 15000 }), 0);
  assert.equal(resolveCollectedDepositCents({ status: 'held', amount: 15000 }), 15000);
  assert.equal(resolveCollectedDepositCents({ status: 'partial_refund', amount: 15000, refund_amount: 5000 }), 10000);
});

test('invoice generation does not fall back to expected booking.deposit_amount', () => {
  const invoiceService = source('backend/services/invoiceService.js');
  assert.match(invoiceService, /resolveCollectedDepositCents\(deposit\)/);
  assert.doesNotMatch(
    invoiceService,
    /booking\.deposit_amount[\s\S]{0,160}Security Deposit Held/,
    'expected booking.deposit_amount must not create a refundable deposit line'
  );
});

test('dashboard rental-payment state is based on rental payment ledger rows only', () => {
  const bookingOps = source('dashboard/src/lib/bookingOps.js');
  const fn = bookingOps.match(/export function hasCompletedRentalPayment\s*\([\s\S]*?\n}/)?.[0] || '';
  assert.match(fn, /payment_type === 'rental'/);
  assert.doesNotMatch(fn, /deposit_status/);
});

test('agreement confirmation requires a completed rental payment', () => {
  const agreements = source('backend/routes/agreements.js');
  assert.match(agreements, /async function hasCompletedRentalPayment/);
  assert.match(agreements, /booking\.status === 'approved' && await hasCompletedRentalPayment\(booking\.id\)/);
});

test('missing booking_deposits row returns expected deposit display data only', () => {
  const depositsRoute = source('backend/routes/deposits.js');
  assert.match(depositsRoute, /expected_amount/);
  assert.match(depositsRoute, /status: 'none'/);
  assert.doesNotMatch(depositsRoute, /source: 'booking_legacy'/);
});

test('checkout completion is idempotent and guarded by checkout evidence', () => {
  const bookingService = source('backend/services/bookingService.js');
  const bookingsRoute = source('backend/routes/bookings.js');

  assert.match(bookingService, /export async function returnBooking/);
  assert.match(bookingService, /booking\.status === 'returned'[\s\S]*idempotent: true/);
  assert.match(bookingService, /export async function completeBookingCheckout/);
  assert.match(bookingService, /'customer_checkout', 'admin_inspection'/);
  assert.match(bookingService, /Checkout must be recorded before completing this rental/);
  assert.match(bookingsRoute, /returnBooking\(req\.params\.id/);
  assert.match(bookingsRoute, /completeBookingCheckout\(req\.params\.id/);
});

test('manual payment methods are limited to the operator-approved list', () => {
  assert.equal(normalizeDashboardPaymentMethod('Stripe/Card'), 'stripe');
  assert.equal(normalizeDashboardPaymentMethod('card'), 'stripe');
  assert.equal(normalizeDashboardPaymentMethod('zelle'), 'zelle');
  assert.equal(normalizeDashboardPaymentMethod('cash'), 'cash');
  assert.equal(normalizeDashboardPaymentMethod('cash_app'), 'cashapp');
  assert.equal(getPaymentMethodLabel('stripe'), 'Stripe/Card');
  assert.equal(getPaymentMethodLabel('cashapp'), 'Cashapp');
  assert.throws(() => normalizeDashboardPaymentMethod('venmo'), /Unsupported payment method/);
  assert.throws(() => normalizeDashboardPaymentMethod('paypal'), /Unsupported payment method/);
  assert.throws(() => normalizeDashboardPaymentMethod('other'), /Unsupported payment method/);

  const bookingModals = source('dashboard/src/components/shared/BookingModals.jsx');
  const bookingDetail = source('dashboard/src/pages/BookingDetailPage.jsx');
  assert.match(bookingModals, /PAYMENT_METHOD_OPTIONS/);
  assert.match(bookingDetail, /PAYMENT_METHOD_OPTIONS/);
  assert.doesNotMatch(bookingModals, /venmo|paypal|Card \(manual\)/i);
  assert.doesNotMatch(bookingDetail, /venmo|paypal|Card \(manual\)/i);
});

test('admin check-in does not report ready when lifecycle transition is invalid', () => {
  const checkinRoute = source('backend/routes/checkin.js');
  assert.match(checkinRoute, /CHECKIN_MARK_READY_STATUSES/);
  assert.match(checkinRoute, /Cannot mark ready while booking is/);
  assert.match(checkinRoute, /ensureCheckRecord/);
  assert.doesNotMatch(checkinRoute, /already past confirmed/);
  assert.match(checkinRoute, /CHECKOUT_RECORDABLE_STATUSES/);
  assert.match(checkinRoute, /Cannot record checkout while booking is/);
});

test('booking updates tolerate optional schema-cache misses only', async () => {
  const calls = [];
  const errors = [
    { code: 'PGRST204', message: "Could not find the 'late_return' column of 'bookings' in the schema cache" },
    { code: 'PGRST204', message: "Could not find the 'insurance_reviewed_at' column of 'bookings' in the schema cache" },
  ];
  const supabaseMock = {
    from(table) {
      assert.equal(table, 'bookings');
      return {
        update(payload) {
          calls.push({ ...payload });
          return {
            async eq(column, id) {
              assert.equal(column, 'id');
              assert.equal(id, 'booking-1');
              const error = errors.shift();
              return { error: error || null };
            },
          };
        },
      };
    },
  };

  assert.equal(getMissingSchemaColumn(errors[0]), 'late_return');

  const result = await updateBookingWithSchemaFallback(supabaseMock, 'booking-1', {
    status: 'returned',
    late_return: true,
    insurance_reviewed_at: '2026-07-15T00:00:00.000Z',
  });

  assert.deepEqual(result.skippedColumns, ['late_return', 'insurance_reviewed_at']);
  assert.deepEqual(calls, [
    {
      status: 'returned',
      late_return: true,
      insurance_reviewed_at: '2026-07-15T00:00:00.000Z',
    },
    {
      status: 'returned',
      insurance_reviewed_at: '2026-07-15T00:00:00.000Z',
    },
    {
      status: 'returned',
    },
  ]);

  const strictSupabaseMock = {
    from() {
      return {
        update() {
          return {
            async eq() {
              return {
                error: {
                  code: 'PGRST204',
                  message: "Could not find the 'status' column of 'bookings' in the schema cache",
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    updateBookingWithSchemaFallback(strictSupabaseMock, 'booking-1', { status: 'returned' }),
    (err) => err?.message?.includes("'status' column")
  );
});
