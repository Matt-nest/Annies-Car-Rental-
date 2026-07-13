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

test('critical customer notification stages have CTA definitions', () => {
  const criticalStages = [
    'booking_approved',
    'payment_reminder',
    'payment_confirmed',
    'ready_for_pickup',
    'pickup_reminder',
    'return_reminder',
    'booking_declined',
    'insurance_approved',
    'insurance_rejected',
  ];

  for (const stage of criticalStages) {
    assert.match(
      notifyService,
      new RegExp(`${stage}:\\s*\\{[\\s\\S]*?(fieldKey|fallbackPath):`),
      `${stage} must have a CTA fieldKey or fallbackPath`
    );
  }
});

test('critical fallback templates define usable customer channels and SMS bodies', () => {
  const criticalStages = [
    'booking_approved',
    'payment_reminder',
    'payment_confirmed',
    'ready_for_pickup',
    'pickup_reminder',
    'return_reminder',
    'booking_declined',
    'insurance_approved',
    'insurance_rejected',
  ];

  for (const stage of criticalStages) {
    const stageMatch = fallbacks.match(new RegExp(`${stage}:\\s*\\{[\\s\\S]*?\\n  \\},`));
    assert.ok(stageMatch, `${stage} fallback template must exist`);
    assert.match(stageMatch[0], /channel:\s*['"]both['"]/, `${stage} must send email + SMS`);
    assert.match(stageMatch[0], /subject:\s*['"`][\s\S]+?['"`]/, `${stage} must define an email subject`);
    assert.match(stageMatch[0], /body:\s*`[\s\S]+?`/, `${stage} must define an email body`);
    assert.match(stageMatch[0], /sms_body:\s*`[\s\S]+?`/, `${stage} must define an SMS body`);
  }
});

test('notification dispatch failures are isolated per channel and still settle the batch', () => {
  assert.match(
    notifyService,
    /console\.error\(`\[Notify\] Email send error for "\$\{stage\}":`,\s*e\.message\)/,
    'email send errors must be logged and isolated'
  );
  assert.match(
    notifyService,
    /console\.error\(`\[Notify\] SMS send error for "\$\{stage\}":`,\s*e\.message\)/,
    'SMS send errors must be logged and isolated'
  );
  assert.match(
    notifyService,
    /console\.error\(`\[Notify\] Push send error for "\$\{stage\}":`,\s*e\.message\)/,
    'customer push errors must be logged and isolated'
  );
  assert.match(
    notifyService,
    /console\.error\(`\[Notify\] Admin push send error for "\$\{stage\}":`,\s*e\.message\)/,
    'admin push errors must be logged and isolated'
  );
  assert.match(
    notifyService,
    /await Promise\.allSettled\(dispatchTasks\);/,
    'notification dispatch must wait for all channel attempts without throwing the whole batch'
  );
  assert.match(
    notifyService,
    /await storeSystemMessage\(stage,\s*bookingPayload\);/,
    'local system message storage must still run after provider dispatch attempts'
  );
});
