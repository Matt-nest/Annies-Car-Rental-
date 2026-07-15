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
