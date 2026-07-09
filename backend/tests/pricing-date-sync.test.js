/**
 * Unit tests for booking pricing / date sync
 * Run: node --test tests/pricing-date-sync.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcRentalDays, hasPricingDateDrift, pricingDriftSummary, isBookingPricingLocked } from '../services/pricingService.js';

test('calcRentalDays — Jul 8 to Jul 9 is 2 inclusive days', () => {
  assert.equal(calcRentalDays('2026-07-08', '2026-07-09'), 2);
});

test('calcRentalDays — Jul 8 to Jul 10 is 3 inclusive days', () => {
  assert.equal(calcRentalDays('2026-07-08', '2026-07-10'), 3);
});

test('hasPricingDateDrift detects stored vs date mismatch', () => {
  const booking = {
    pickup_date: '2026-07-08',
    return_date: '2026-07-09',
    rental_days: 3,
  };
  assert.equal(hasPricingDateDrift(booking), true);
  assert.deepEqual(pricingDriftSummary(booking), {
    hasDrift: true,
    expectedDays: 2,
    storedDays: 3,
    pickupDate: '2026-07-08',
    returnDate: '2026-07-09',
  });
});

test('hasPricingDateDrift is false when pricing matches dates', () => {
  const booking = {
    pickup_date: '2026-07-08',
    return_date: '2026-07-10',
    rental_days: 3,
  };
  assert.equal(hasPricingDateDrift(booking), false);
});

test('isBookingPricingLocked after rental is active', () => {
  assert.equal(isBookingPricingLocked({ status: 'active' }, false), true);
  assert.equal(isBookingPricingLocked({ status: 'approved' }, false), false);
  assert.equal(isBookingPricingLocked({ status: 'approved' }, true), true);
});
