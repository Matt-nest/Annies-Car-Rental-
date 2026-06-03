/**
 * Brand configuration tests — verifies the brand.js config
 * exports all required keys that the white-label system relies on.
 * Run: node --test tests/brand.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// brand.js is the single source of truth for white-label values
import brand from '../config/brand.js';

const REQUIRED_STRING_KEYS = [
  'name',
  'domain',
  'siteUrl',
  'dashboardUrl',
  'phone',
  'email',
  'stripeDescriptionPrefix',
];

test('brand config exports all required string keys', () => {
  for (const key of REQUIRED_STRING_KEYS) {
    assert.ok(
      brand[key] !== undefined && brand[key] !== null,
      `brand.${key} must be defined`
    );
    assert.ok(
      typeof brand[key] === 'string' && brand[key].length > 0,
      `brand.${key} must be a non-empty string, got: "${brand[key]}"`
    );
  }
});

test('brand.location has city, state, zip, address', () => {
  assert.ok(brand.location, 'brand.location must exist');
  for (const key of ['city', 'state', 'zip', 'address']) {
    assert.ok(
      typeof brand.location[key] === 'string' && brand.location[key].length > 0,
      `brand.location.${key} must be a non-empty string`
    );
  }
});

test('brand.siteUrl starts with https://', () => {
  assert.ok(brand.siteUrl.startsWith('https://'), `siteUrl must start with https://, got: ${brand.siteUrl}`);
});

test('brand.domain does not contain protocol', () => {
  assert.ok(!brand.domain.includes('://'), `domain should be bare hostname, got: ${brand.domain}`);
});

test('brand.email contains @', () => {
  assert.ok(brand.email.includes('@'), `email must be a valid address, got: ${brand.email}`);
});

test('brand.taxRate is a number between 0 and 1', () => {
  assert.ok(typeof brand.taxRate === 'number', 'taxRate must be a number');
  assert.ok(brand.taxRate >= 0 && brand.taxRate <= 1, `taxRate should be 0-1, got: ${brand.taxRate}`);
});

test('brand.stripeDescriptionPrefix is reasonable length (< 50 chars)', () => {
  assert.ok(
    brand.stripeDescriptionPrefix.length <= 50,
    `Stripe description prefix too long (${brand.stripeDescriptionPrefix.length} chars) — may get truncated on statements`
  );
});

test('brand.colors has primary, secondary, accent', () => {
  assert.ok(brand.colors, 'brand.colors must exist');
  for (const key of ['primary', 'secondary', 'accent']) {
    assert.ok(
      typeof brand.colors[key] === 'string' && brand.colors[key].startsWith('#'),
      `brand.colors.${key} must be a hex color, got: "${brand.colors[key]}"`
    );
  }
});
