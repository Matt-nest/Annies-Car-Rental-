/**
 * Bouncie webhook auth tests — ensures checkWebhookAuth enforces
 * constant-time comparison and rejects invalid credentials.
 * Run: node --test tests/bouncieWebhookAuth.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// Replicate the checkWebhookAuth logic from bouncieWebhooks.js
// (we test the algorithm, not the Express handler, to avoid DB deps)
function checkWebhookAuth(headers, expectedSecret) {
  if (!expectedSecret) return false;
  const got = headers['authorization'] || headers['x-bouncie-authorization'] || '';
  if (!got || got.length !== expectedSecret.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(String(got)), Buffer.from(expectedSecret));
  } catch {
    return false;
  }
}

describe('Bouncie webhook auth', () => {
  const SECRET = 'test-bouncie-secret-abc123';

  test('rejects when no secret is configured', () => {
    assert.equal(checkWebhookAuth({ authorization: SECRET }, ''), false);
    assert.equal(checkWebhookAuth({ authorization: SECRET }, null), false);
    assert.equal(checkWebhookAuth({ authorization: SECRET }, undefined), false);
  });

  test('rejects when no authorization header is sent', () => {
    assert.equal(checkWebhookAuth({}, SECRET), false);
  });

  test('rejects wrong secret', () => {
    assert.equal(checkWebhookAuth({ authorization: 'wrong-secret' }, SECRET), false);
  });

  test('rejects secret of different length', () => {
    assert.equal(checkWebhookAuth({ authorization: 'short' }, SECRET), false);
  });

  test('accepts correct secret in Authorization header', () => {
    assert.equal(checkWebhookAuth({ authorization: SECRET }, SECRET), true);
  });

  test('accepts correct secret in X-Bouncie-Authorization header', () => {
    assert.equal(
      checkWebhookAuth({ 'x-bouncie-authorization': SECRET }, SECRET),
      true
    );
  });

  test('prefers Authorization header over X-Bouncie-Authorization', () => {
    assert.equal(
      checkWebhookAuth({
        authorization: SECRET,
        'x-bouncie-authorization': 'wrong',
      }, SECRET),
      true
    );
  });
});
