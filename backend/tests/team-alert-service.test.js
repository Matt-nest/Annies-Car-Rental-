/**
 * Team SMS alert service — message formatting and phone validation.
 * Run: node --test tests/team-alert-service.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTeamAlertMessage,
  normalizeTeamAlertPhones,
  TEAM_ALERT_EVENTS,
} from '../services/teamAlertService.js';

const sampleBooking = {
  booking_code: 'JD-ABC123',
  pickup_date: '2026-07-10',
  return_date: '2026-07-13',
  daily_rate: 89,
  total_cost: 412.5,
  unlimited_miles: true,
  unlimited_tolls: true,
  customers: {
    first_name: 'Alex',
    phone: '+17725551234',
  },
  vehicles: {
    year: 2024,
    make: 'Jeep',
    model: 'Wrangler',
  },
};

test('formatTeamAlertMessage new_booking includes key fields', () => {
  const msg = formatTeamAlertMessage(TEAM_ALERT_EVENTS.NEW_BOOKING, { booking: sampleBooking });
  assert.match(msg, /pending approval/i);
  assert.match(msg, /Alex/);
  assert.match(msg, /772.*555.*1234/);
  assert.match(msg, /Jeep/);
  assert.match(msg, /\$89\/day/);
  assert.match(msg, /unlimited mi/);
  assert.match(msg, /Total \$412/);
  assert.match(msg, /approve/i);
});

test('formatTeamAlertMessage payment_received is concise', () => {
  const msg = formatTeamAlertMessage(TEAM_ALERT_EVENTS.PAYMENT_RECEIVED, {
    booking: sampleBooking,
    amount: 412.5,
  });
  assert.match(msg, /Payment \$412/);
  assert.match(msg, /JD-ABC123/);
  assert.match(msg, /Alex/);
  assert.doesNotMatch(msg, /Add-ons/);
});

test('formatTeamAlertMessage agreement_pending mentions counter-sign', () => {
  const msg = formatTeamAlertMessage(TEAM_ALERT_EVENTS.AGREEMENT_PENDING, { booking: sampleBooking });
  assert.match(msg, /signed/i);
  assert.match(msg, /counter-sign/i);
});

test('normalizeTeamAlertPhones caps at 4 and dedupes', () => {
  const phones = [
    '+17725551111',
    '+17725552222',
    '+17725553333',
    '+17725554444',
    '+17725555555',
    '+17725551111',
  ];
  const out = normalizeTeamAlertPhones(phones);
  assert.equal(out.length, 4);
  assert.deepEqual(out, [
    '+17725551111',
    '+17725552222',
    '+17725553333',
    '+17725554444',
  ]);
});

test('normalizeTeamAlertPhones rejects invalid numbers', () => {
  assert.deepEqual(
    normalizeTeamAlertPhones(['+17725551234', 'invalid', '+442071234567']),
    ['+17725551234'],
  );
});

test('bookingService wires team alert on new website booking', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'services/bookingService.js'), 'utf8');
  assert.match(src, /sendTeamAlertAsync\(TEAM_ALERT_EVENTS\.NEW_BOOKING/);
  assert.match(src, /if \(!created_by_admin\)/);
});

test('settings route exposes team_alert_phones fields', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'routes/settings.js'), 'utf8');
  assert.match(src, /team_alerts_enabled/);
  assert.match(src, /team_alert_phones/);
});
