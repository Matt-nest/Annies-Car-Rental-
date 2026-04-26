/**
 * Unit tests for computeRentalPricing()
 * Run: node --test tests/pricingService.test.js
 *
 * 7 worked examples cover: daily, daily+delivery+addon, pure-weekly (1 week),
 * weekly_mixed, multi-week, high-rate vehicle, and mileage_allowance edge cases.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRentalPricing, calcRentalDays } from '../services/pricingService.js';

// Shared test vehicle — matches the VW Jetta in production ($85/day, 15% weekly discount)
const jetta = {
  daily_rate: 85,
  weekly_discount_percent: 15,
  weekly_unlimited_mileage_enabled: true,
};

// Nissan Altima ($98/day, 15% discount)
const altima = {
  daily_rate: 98,
  weekly_discount_percent: 15,
  weekly_unlimited_mileage_enabled: true,
};

const TAX_RATE = 0.07;

// ─── Helper ───────────────────────────────────────────────────────────────────

function pricing(vehicle, days, extras = {}) {
  // Build fake pickup/return dates from a fixed anchor (avoids date math complexity in tests)
  const pickup = '2026-05-01';
  const returnDate = addDays(pickup, days - 1); // inclusive: 1 day = same-day pickup
  return computeRentalPricing({ vehicle, pickupDate: pickup, returnDate, ...extras });
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function round2(n) { return parseFloat(n.toFixed(2)); }

// ─── Test 1: 1-day rental, daily rate only ────────────────────────────────────
test('1-day rental — daily rate, no add-ons', () => {
  const p = pricing(jetta, 1);

  assert.equal(p.rental_days, 1);
  assert.equal(p.rate_type, 'daily');
  assert.equal(p.subtotal, 85.00);
  assert.equal(p.mileage_addon_fee, 0);
  assert.equal(p.toll_addon_fee, 0);
  assert.equal(p.delivery_fee, 0);
  assert.equal(p.tax_amount, round2(85 * TAX_RATE));   // 5.95
  assert.equal(p.total_cost, round2(85 + 85 * TAX_RATE));  // 90.95
  assert.equal(p.mileage_allowance, '150');             // 1 day × 150
  assert.equal(p.weekly_discount_applied, null);
  assert.equal(p.savings_vs_daily, 0);

  // line_items: 1 day + tax
  assert.equal(p.line_items.length, 2);
  assert.equal(p.line_items[0].label, '1 day');
  assert.equal(p.line_items[0].amount, 85.00);
  assert.equal(p.line_items[1].label, 'Tax (7%)');
});

// ─── Test 2: 6-day rental with PSL delivery + toll add-on ─────────────────────
test('6-day rental — daily, PSL delivery ($39), toll add-on ($20)', () => {
  const p = pricing(jetta, 6, { deliveryFeeAmount: 39, tollAddonFee: 20 });

  assert.equal(p.rental_days, 6);
  assert.equal(p.rate_type, 'daily');
  assert.equal(p.subtotal, round2(85 * 6));             // 510.00
  assert.equal(p.delivery_fee, 39);
  assert.equal(p.toll_addon_fee, 20);
  assert.equal(p.mileage_addon_fee, 0);

  const taxable = 510 + 39;                             // 549
  assert.equal(p.tax_amount, round2(taxable * TAX_RATE)); // 38.43
  assert.equal(p.total_cost, round2(taxable + taxable * TAX_RATE + 20)); // 607.43
  assert.equal(p.mileage_allowance, '900');             // 6 × 150
});

// ─── Test 3: 7-day (exactly 1 week) — pure weekly ─────────────────────────────
test('7-day rental — pure weekly, unlimited mileage included', () => {
  const p = pricing(jetta, 7);
  // weekly_rate = round((85 * 7) * 0.85, 2) = round(505.75, 2) = 505.75

  assert.equal(p.rental_days, 7);
  assert.equal(p.rate_type, 'weekly');
  assert.equal(p.full_weeks, 1);
  assert.equal(p.remainder_days, 0);
  assert.equal(p.weekly_rate, 505.75);
  assert.equal(p.subtotal, 505.75);
  assert.equal(p.mileage_addon_fee, 0);                 // zeroed out by pricing fn
  assert.equal(p.weekly_discount_applied, 15);
  assert.equal(p.mileage_allowance, 'unlimited');
  assert.equal(p.tax_amount, round2(505.75 * TAX_RATE)); // 35.40
  assert.equal(p.total_cost, round2(505.75 + 505.75 * TAX_RATE)); // 541.15
  assert.equal(p.savings_vs_daily, round2(85 * 7 - 505.75)); // 89.25

  // line_items: 1 week + tax
  assert.equal(p.line_items.length, 2);
  assert.equal(p.line_items[0].label, '1 week');
  assert.equal(p.line_items[0].amount, 505.75);
});

// ─── Test 4: 10-day rental — weekly_mixed (1 week + 3 days) ──────────────────
test('10-day rental — weekly_mixed (1 week + 3 days)', () => {
  const p = pricing(jetta, 10);
  // 1 week @ 505.75 + 3 days @ 85 = 505.75 + 255.00 = 760.75

  assert.equal(p.rental_days, 10);
  assert.equal(p.rate_type, 'weekly_mixed');
  assert.equal(p.full_weeks, 1);
  assert.equal(p.remainder_days, 3);
  assert.equal(p.subtotal, 760.75);
  assert.equal(p.mileage_allowance, 'unlimited');
  assert.equal(p.tax_amount, round2(760.75 * TAX_RATE)); // 53.25
  assert.equal(p.total_cost, round2(760.75 + 760.75 * TAX_RATE)); // 814.00

  // line_items: 1 week + 3 days + tax
  assert.equal(p.line_items.length, 3);
  assert.equal(p.line_items[0].label, '1 week');
  assert.equal(p.line_items[0].amount, 505.75);
  assert.equal(p.line_items[1].label, '3 days');
  assert.equal(p.line_items[1].amount, 255.00);
});

// ─── Test 5: 14-day rental — 2 pure weeks ─────────────────────────────────────
test('14-day rental — 2 full weeks', () => {
  const p = pricing(jetta, 14);
  // 2 × 505.75 = 1011.50

  assert.equal(p.rental_days, 14);
  assert.equal(p.rate_type, 'weekly');
  assert.equal(p.full_weeks, 2);
  assert.equal(p.remainder_days, 0);
  assert.equal(p.subtotal, 1011.50);
  assert.equal(p.tax_amount, round2(1011.50 * TAX_RATE)); // 70.81
  assert.equal(p.total_cost, round2(1011.50 + 1011.50 * TAX_RATE)); // 1082.31
  assert.equal(p.mileage_allowance, 'unlimited');

  assert.equal(p.line_items[0].label, '2 weeks');
  assert.equal(p.line_items[0].amount, 1011.50);
});

// ─── Test 6: Nissan Altima ($98/day) 7-day — verify weekly_rate formula ───────
test('Nissan Altima 7-day — weekly_rate matches migration verification output', () => {
  const p = pricing(altima, 7);
  // weekly_rate = round((98 * 7) * 0.85, 2) = round(583.10, 2) = 583.10

  assert.equal(p.weekly_rate, 583.10);
  assert.equal(p.subtotal, 583.10);
  assert.equal(p.tax_amount, round2(583.10 * TAX_RATE)); // 40.82
  assert.equal(p.total_cost, round2(583.10 + 583.10 * TAX_RATE)); // 623.92
});

// ─── Test 7: Unlimited mileage add-on on daily booking + mileage_allowance ────
test('5-day daily + mileage add-on ($100) — allowance becomes unlimited, addon not zeroed', () => {
  const p = pricing(jetta, 5, { mileageAddonFee: 100 });

  assert.equal(p.rate_type, 'daily');
  assert.equal(p.mileage_addon_fee, 100);               // NOT zeroed (daily booking)
  assert.equal(p.mileage_allowance, 'unlimited');       // because mileageAddonFee > 0

  const taxable = 85 * 5;                               // 425 (delivery=0, discount=0)
  assert.equal(p.tax_amount, round2(taxable * TAX_RATE)); // 29.75
  assert.equal(p.total_cost, round2(taxable + taxable * TAX_RATE + 100)); // 554.75

  // line_items: 5 days + unlimited mileage + tax
  const labels = p.line_items.map(i => i.label);
  assert.ok(labels.includes('5 days'));
  assert.ok(labels.includes('Unlimited mileage'));
  assert.ok(labels.includes('Tax (7%)'));
});

// ─── Test 8: calcRentalDays — verify inclusive counting ───────────────────────
test('calcRentalDays — same-day = 1, next-day = 2, 7 days apart = 8', () => {
  assert.equal(calcRentalDays('2026-05-01', '2026-05-01'), 1);
  assert.equal(calcRentalDays('2026-05-01', '2026-05-02'), 2);
  assert.equal(calcRentalDays('2026-05-01', '2026-05-07'), 7);
  assert.equal(calcRentalDays('2026-05-01', '2026-05-08'), 8);
});
