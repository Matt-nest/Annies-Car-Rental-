/**
 * Static contract tests — dashboard reporting/action queues.
 *
 * Guards against stale home alerts and terminal bookings staying in work queues.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const REPO_ROOT = join(BACKEND_ROOT, '..');

function source(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

test('counter-sign queues only include operational bookings', () => {
  const agreementsRoute = source('backend/routes/agreements.js');
  const statsRoute = source('backend/routes/stats.js');

  assert.match(agreementsRoute, /ACTIONABLE_COUNTER_SIGN_STATUSES = \['approved', 'confirmed'\]/);
  assert.match(agreementsRoute, /\.in\('bookings\.status', ACTIONABLE_COUNTER_SIGN_STATUSES\)/);
  assert.match(statsRoute, /ACTIONABLE_COUNTER_SIGN_STATUSES = \['approved', 'confirmed'\]/);
  assert.match(statsRoute, /\.in\('bookings\.status', ACTIONABLE_COUNTER_SIGN_STATUSES\)/);
});

test('counter-sign mutation rejects non-actionable bookings and does not create a pending notification', () => {
  const agreementsRoute = source('backend/routes/agreements.js');
  const counterSignRoute = agreementsRoute.match(/router\.post\('\/:bookingId\/counter-sign'[\s\S]*?res\.json\(\{ success: true \}\);\n}\)\);/)?.[0] || '';

  assert.ok(counterSignRoute, 'counter-sign route must exist');
  assert.match(counterSignRoute, /!ACTIONABLE_COUNTER_SIGN_STATUSES\.includes\(booking\.status\)/);
  assert.match(counterSignRoute, /no longer needs a counter-signature/);
  assert.match(counterSignRoute, /\.is\('owner_signed_at', null\)/);
  assert.match(counterSignRoute, /'status_change'[\s\S]*Agreement fully executed/);
  assert.doesNotMatch(
    counterSignRoute,
    /createNotification\(\s*['"]agreement_pending['"][\s\S]*Agreement fully executed/,
    'fully executed agreements must not create a new pending-agreement notification'
  );
});

test('terminal booking transitions clear stale action notifications', () => {
  const bookingService = source('backend/services/bookingService.js');

  assert.match(bookingService, /TERMINAL_NOTIFICATION_STATUSES/);
  assert.match(bookingService, /'cancelled'/);
  assert.match(bookingService, /'declined'/);
  assert.match(bookingService, /STALE_ACTION_NOTIFICATION_TYPES = \['new_booking', 'agreement_pending'\]/);
  assert.match(bookingService, /\.contains\('metadata', \{ booking_id: bookingId \}\)/);
  assert.match(bookingService, /\.update\(\{ is_read: true \}\)/);
});

test('automation failures page shows unresolved current failures and can dismiss them', () => {
  const statsRoute = source('backend/routes/stats.js');
  const apiClient = source('dashboard/src/api/client.js');
  const failuresPage = source('dashboard/src/pages/WebhookFailuresPage.jsx');

  assert.match(statsRoute, /\.eq\('resolved', false\)/);
  assert.match(statsRoute, /event_type: row\.event \|\| row\.webhook_type/);
  assert.match(statsRoute, /error_message: row\.error_text/);
  assert.match(statsRoute, /router\.patch\('\/webhook-failures\/:id\/resolve'/);
  assert.match(apiClient, /resolveWebhookFailure/);
  assert.match(failuresPage, /resolveFailure/);
  assert.match(failuresPage, /Dismiss/);
});
