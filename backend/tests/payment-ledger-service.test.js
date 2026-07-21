import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupePaymentLedgerRows, withDedupedBookingPayments } from '../services/paymentLedgerService.js';

test('dedupePaymentLedgerRows collapses duplicate Stripe ledger rows by payment reference and type', () => {
  const rows = [
    {
      id: 'rental-newer',
      booking_id: 'booking-1',
      payment_type: 'rental',
      amount: 203.30,
      method: 'stripe',
      reference_id: 'pi_123',
      status: 'completed',
      created_at: '2026-07-15T17:06:10Z',
    },
    {
      id: 'deposit-newer',
      booking_id: 'booking-1',
      payment_type: 'deposit',
      amount: 150,
      method: 'stripe',
      reference_id: 'pi_123',
      status: 'completed',
      created_at: '2026-07-15T17:06:11Z',
    },
    {
      id: 'rental-original',
      booking_id: 'booking-1',
      payment_type: 'rental',
      amount: 203.30,
      method: 'stripe',
      reference_id: 'pi_123',
      status: 'completed',
      created_at: '2026-07-15T17:06:00Z',
    },
    {
      id: 'deposit-original',
      booking_id: 'booking-1',
      payment_type: 'deposit',
      amount: 150,
      method: 'stripe',
      reference_id: 'pi_123',
      status: 'completed',
      created_at: '2026-07-15T17:06:01Z',
    },
  ];

  const deduped = dedupePaymentLedgerRows(rows);

  assert.deepEqual(deduped.map((row) => row.id), ['rental-original', 'deposit-original']);
  assert.equal(deduped.reduce((sum, row) => sum + Number(row.amount || 0), 0), 353.30);
});

test('dedupePaymentLedgerRows preserves separate references and manual rows without references', () => {
  const rows = [
    { id: 'first', booking_id: 'booking-1', payment_type: 'rental', amount: 100, method: 'stripe', reference_id: 'pi_1', status: 'completed' },
    { id: 'second', booking_id: 'booking-1', payment_type: 'rental', amount: 100, method: 'stripe', reference_id: 'pi_2', status: 'completed' },
    { id: 'manual-a', booking_id: 'booking-1', payment_type: 'rental', amount: 50, method: 'cash', status: 'completed' },
    { id: 'manual-b', booking_id: 'booking-1', payment_type: 'rental', amount: 50, method: 'cash', status: 'completed' },
  ];

  assert.deepEqual(dedupePaymentLedgerRows(rows).map((row) => row.id), ['first', 'second', 'manual-a', 'manual-b']);
});

test('withDedupedBookingPayments returns booking with cleaned payment rows', () => {
  const booking = {
    id: 'booking-1',
    payments: [
      { id: 'a', booking_id: 'booking-1', payment_type: 'deposit', amount: 150, method: 'stripe', reference_id: 'pi_1', status: 'completed', created_at: '2026-07-15T17:06:00Z' },
      { id: 'b', booking_id: 'booking-1', payment_type: 'deposit', amount: 150, method: 'stripe', reference_id: 'pi_1', status: 'completed', created_at: '2026-07-15T17:06:01Z' },
    ],
  };

  const normalized = withDedupedBookingPayments(booking);
  assert.equal(normalized.payments.length, 1);
  assert.equal(normalized.payments[0].id, 'a');
  assert.notEqual(normalized, booking);
});
