import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function source(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function routeHasOwnerAdminGuard(src, route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `router\\.post\\(\\s*['"]${escaped}['"]\\s*,\\s*requireAuth\\s*,\\s*requireRole\\(\\s*['"]owner['"]\\s*,\\s*['"]admin['"]\\s*\\)`,
    'm'
  ).test(src);
}

test('manual payment and deposit money-moving routes require owner/admin', () => {
  const payments = source('routes/payments.js');
  const deposits = source('routes/deposits.js');

  assert.equal(routeHasOwnerAdminGuard(payments, '/bookings/:bookingId/payments'), true);
  assert.equal(routeHasOwnerAdminGuard(deposits, '/bookings/:id/deposit/release'), true);
  assert.equal(routeHasOwnerAdminGuard(deposits, '/bookings/:id/deposit/settle'), true);
  assert.equal(routeHasOwnerAdminGuard(deposits, '/bookings/:id/deposit/record'), true);
});
