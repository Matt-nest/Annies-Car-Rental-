/**
 * Static contract tests — notification flow hardening (2026-07).
 *
 * Guards against regressions in payment reminders, duplicate review sends,
 * and late-return spam. Run: node --test tests/notification-flow-contract.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const cronJs = readFileSync(join(ROOT, 'routes/cron.js'), 'utf8');
const bookingService = readFileSync(join(ROOT, 'services/bookingService.js'), 'utf8');
const notifyService = readFileSync(join(ROOT, 'services/notifyService.js'), 'utf8');
const fallbacks = readFileSync(join(ROOT, 'services/fallbackTemplates.js'), 'utf8');

test('cron daily job sends payment_reminder for approved-unpaid bookings', () => {
  assert.match(cronJs, /sendBookingNotification\('payment_reminder'/);
  assert.doesNotMatch(cronJs, /Payment reminder for.*no template configured/);
});

test('cron late_return_warning targets first overdue day only', () => {
  assert.match(cronJs, /\.eq\('return_date',\s*daysAgo\(1\)\)/);
  assert.doesNotMatch(cronJs, /\.lt\('return_date',\s*today\(\)\)[\s\S]*late_return_warning/);
});

test('bookingService does not fire rental_completed on status completed', () => {
  const transitionMatch = bookingService.match(
    /const stageMap = \{[\s\S]*?\};/
  );
  assert.ok(transitionMatch, 'stageMap must exist in bookingService.js');
  assert.doesNotMatch(
    transitionMatch[0],
    /completed:\s*['"]rental_completed['"]/,
    'rental_completed must only fire via cron — not on immediate completed transition'
  );
});

test('notifyService defines payment_reminder CTA', () => {
  assert.match(notifyService, /payment_reminder:\s*\{/);
});

test('fallbackTemplates includes payment_reminder and insurance stages', () => {
  assert.match(fallbacks, /payment_reminder:\s*\{/);
  assert.match(fallbacks, /insurance_approved:\s*\{/);
  assert.match(fallbacks, /insurance_rejected:\s*\{/);
});
