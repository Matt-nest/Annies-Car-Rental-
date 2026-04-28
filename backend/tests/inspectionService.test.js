/**
 * Unit tests for calculateMileageOverageFromInputs()
 * Run: node --test tests/inspectionService.test.js
 *
 * Covers: happy path, exact allowance, under allowance, unlimited skip,
 * missing data, and the worked example from the spec.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMileageOverageFromInputs, FEE_SCHEDULE } from '../services/inspectionService.js';

test('spec example: 2-day rental, 100 mi over → $34.00', () => {
  // 2 days × 200 = 400 free; check-in 100 → cap 500; returned 600 → 100 over.
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: 100,
    checkOutOdometer: 600,
    rentalDays: 2,
    hasUnlimitedMiles: false,
  });
  assert.equal(r.totalMiles, 500);
  assert.equal(r.freeMiles, 400);
  assert.equal(r.overageMiles, 100);
  assert.equal(r.overageFee, 3400, 'fee in cents');
  assert.equal(r.overageFeeDollars, 34);
});

test('exactly at allowance produces no overage', () => {
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: 1000,
    checkOutOdometer: 1400,
    rentalDays: 2,
    hasUnlimitedMiles: false,
  });
  assert.equal(r.totalMiles, 400);
  assert.equal(r.freeMiles, 400);
  assert.equal(r.overageMiles, 0);
  assert.equal(r.overageFee, 0);
});

test('under allowance produces no overage', () => {
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: 1000,
    checkOutOdometer: 1100,
    rentalDays: 3,
    hasUnlimitedMiles: false,
  });
  assert.equal(r.overageMiles, 0);
  assert.equal(r.overageFee, 0);
});

test('unlimited miles skips overage entirely', () => {
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: 1000,
    checkOutOdometer: 5000,
    rentalDays: 2,
    hasUnlimitedMiles: true,
  });
  assert.equal(r.totalMiles, 4000);
  assert.equal(r.freeMiles, Infinity);
  assert.equal(r.overageMiles, 0);
  assert.equal(r.overageFee, 0);
  assert.equal(r.unlimitedMiles, true);
});

test('missing odometer returns noData=true', () => {
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: undefined,
    checkOutOdometer: 500,
    rentalDays: 1,
    hasUnlimitedMiles: false,
  });
  assert.equal(r.noData, true);
  assert.equal(r.overageFee, 0);
});

test('rate is $0.34/mile (34 cents)', () => {
  assert.equal(FEE_SCHEDULE.overage_per_mile, 34);
  assert.equal(FEE_SCHEDULE.mileage_per_day, 200);
});

test('1-day rental, 250 miles → 50 miles over, $17.00', () => {
  const r = calculateMileageOverageFromInputs({
    checkInOdometer: 0,
    checkOutOdometer: 250,
    rentalDays: 1,
    hasUnlimitedMiles: false,
  });
  assert.equal(r.totalMiles, 250);
  assert.equal(r.freeMiles, 200);
  assert.equal(r.overageMiles, 50);
  assert.equal(r.overageFeeDollars, 17);
});
