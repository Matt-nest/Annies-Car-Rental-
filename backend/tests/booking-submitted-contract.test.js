/**
 * Static contract test — Phase 1 audit F-3.
 *
 * `notifyService.sendBookingNotification` skips email when
 * `stage === 'booking_submitted'`, on the assumption that
 * `bookingService.createBooking` calls `emailService.sendBookingConfirmation`
 * separately (richer branded layout). If that call is removed/renamed,
 * customers receive NO email after submission and nothing logs an error.
 *
 * This test fails the build if either side of the contract is broken.
 *
 * Run: node --test tests/booking-submitted-contract.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const bookingService  = readFileSync(join(ROOT, 'services/bookingService.js'),  'utf8');
const notifyService   = readFileSync(join(ROOT, 'services/notifyService.js'),   'utf8');
const emailService    = readFileSync(join(ROOT, 'services/emailService.js'),    'utf8');

test('emailService.js exports sendBookingConfirmation', () => {
  assert.match(
    emailService,
    /export\s+(async\s+)?function\s+sendBookingConfirmation\s*\(/,
    'sendBookingConfirmation must be exported from emailService.js — F-3 contract'
  );
});

test('bookingService.js imports sendBookingConfirmation', () => {
  assert.match(
    bookingService,
    /import\s*\{[^}]*\bsendBookingConfirmation\b[^}]*\}\s*from\s+['"]\.\/emailService\.js['"]/,
    'bookingService.js must import sendBookingConfirmation — F-3 contract'
  );
});

test('bookingService.createBooking calls sendBookingConfirmation', () => {
  // Locate createBooking and assert it calls sendBookingConfirmation somewhere inside.
  const createBookingMatch = bookingService.match(/export\s+async\s+function\s+createBooking\s*\([\s\S]*?(?=\nexport\s|\n\/\*\*)/);
  assert.ok(createBookingMatch, 'createBooking function must be findable in bookingService.js');
  assert.match(
    createBookingMatch[0],
    /sendBookingConfirmation\s*\(/,
    'createBooking must invoke sendBookingConfirmation — removing this call silently breaks the booking-submitted email (F-3)'
  );
});

test('notifyService.sendBookingNotification still skips email for booking_submitted', () => {
  // The skipEmail check is what makes this contract necessary. If someone
  // removes the skip, both paths would email the customer (duplicate).
  // If they remove it AND remove the bookingService call, customer gets nothing.
  assert.match(
    notifyService,
    /skipEmail\s*=\s*stage\s*===\s*['"]booking_submitted['"]/,
    'notifyService must still skip email for booking_submitted stage — F-3 contract'
  );
});

test('F-3 contract comments are present in both files', () => {
  // Comments document the implicit dependency for future readers.
  assert.match(bookingService, /F-3/, 'bookingService.js should reference F-3 contract');
  assert.match(notifyService,  /F-3/, 'notifyService.js should reference F-3 contract');
});
