/**
 * Merge-field coverage test — Phase 1 audit F-6.
 *
 * Greps every `{{key}}` reference from fallbackTemplates.js and asserts each
 * one is set by buildMergeFields(). Without this guard, a new template can
 * reference `{{shiny_new_field}}` and ship with the literal text rendering
 * in customer emails — interpolateTemplate falls through to the regex
 * `match` literal when a field is undefined.
 *
 * This test does NOT cover DB-resident templates (email_templates table) —
 * those live outside the repo. Recommend adding a runtime warn-log when
 * getRenderedTemplate sees an unknown {{key}} (Phase 2 hardening).
 *
 * Run: node --test tests/merge-field-coverage.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildMergeFields } from '../services/notifyService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const fallbackTemplates = readFileSync(join(ROOT, 'services/fallbackTemplates.js'), 'utf8');

// Build a representative payload that exercises every code path in buildBookingPayload.
// Anything buildMergeFields might lift from .vehicle / .customer / .handoff / scalar
// fields lives here.
const fullPayload = {
  customer_id: 'c-1',
  booking_code: 'BK-20260507-TEST',
  status: 'approved',
  customer: { first_name: 'Test', last_name: 'User', email: 't@t.t', phone: '+17725551234' },
  vehicle:  { year: 2024, make: 'Nissan', model: 'Altima', vin: '1N4...', color: 'Gray', license_plate: 'ABC123', thumbnail_url: '' },
  pickup_date: '2026-05-10', return_date: '2026-05-15', pickup_time: '10:00', return_time: '10:00',
  pickup_location: 'PSL', total_cost: 500, tax_amount: 35, rental_days: 5,
  unlimited_miles: false, unlimited_tolls: false, mileage_addon_fee: null, toll_addon_fee: null,
  insurance_provider: 'bonzah',
  bonzah_policy_no: 'POL-X', bonzah_quote_id: 'Q-X', bonzah_tier_id: 'standard',
  bonzah_tier_label: 'Standard', bonzah_premium: '12.34', bonzah_total_charged: '15.67',
  bonzah_coverage_summary: 'CDW, RCLI, SLI', dashboard_link: 'https://dash/bookings/x',
  decline_reason: null, special_requests: null,
  deposit_amount: 150, deposit_status: 'held', refund_amount: null,
  incidental_total: null, invoice_total: null, invoice_link: null,
  amount_owed: 42.5,
  mileage_allowance: null, checkin_odometer: null, checkout_odometer: null, total_miles: null,
  damage_description: null, damage_fee: null, damage_type: null,
  daily_rate: 100, subtotal: 500, discount_amount: 0, delivery_fee: 0,
  line_items: null, payments: null,
  amount: null, payment_method: 'Card', payment_date: null,
  handoff: null,
  review_link: null,
};

test('buildMergeFields covers every {{key}} referenced in fallbackTemplates.js', () => {
  // Extract all {{key}} references — but exclude {{#if key}} block syntax,
  // which is handled separately by interpolateTemplate (it looks at the same
  // merge map for truthiness, so {{#if key}} also requires the key to exist).
  const referenced = new Set();
  const re = /\{\{(?:#if\s+)?(\w+)\}\}/g;
  let m;
  while ((m = re.exec(fallbackTemplates)) !== null) {
    referenced.add(m[1]);
  }

  // Skip control keywords + common false positives
  referenced.delete('if');

  const fields = buildMergeFields(fullPayload);
  const missing = [...referenced].filter(k => !(k in fields));
  assert.deepEqual(
    missing,
    [],
    `These {{keys}} are referenced in fallbackTemplates.js but not set by buildMergeFields:\n  ${missing.join('\n  ')}\n` +
    `Add them to buildMergeFields() or remove from the templates. F-6 contract.`
  );
});

test('Bonzah and amount_owed fields specifically are present', () => {
  const fields = buildMergeFields(fullPayload);
  const required = [
    'bonzah_policy_no', 'bonzah_quote_id', 'bonzah_tier_label',
    'bonzah_premium', 'bonzah_total_charged', 'bonzah_coverage_summary',
    'dashboard_link', 'amount_owed',
  ];
  for (const key of required) {
    assert.ok(key in fields, `${key} must be in buildMergeFields output (F-6)`);
  }
  assert.equal(fields.bonzah_policy_no, 'POL-X');
  assert.equal(fields.amount_owed, '42.50'); // formatted to 2dp
});

test('amount_owed handles null gracefully', () => {
  const payloadWithoutAmount = { ...fullPayload, amount_owed: null };
  const fields = buildMergeFields(payloadWithoutAmount);
  assert.equal(fields.amount_owed, '');
});
