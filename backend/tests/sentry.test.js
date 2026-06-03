/**
 * Sentry module tests — verifies the no-op fallback behavior
 * when SENTRY_DSN is not configured.
 * Run: node --test tests/sentry.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Sentry no-op behavior (no SENTRY_DSN)', () => {
  test('captureException does not throw when called without Sentry', async () => {
    // Ensure SENTRY_DSN is not set
    delete process.env.SENTRY_DSN;

    const { captureException } = await import('../services/sentry.js');

    // Should not throw
    assert.doesNotThrow(() => {
      captureException(new Error('test error'), { context: 'unit test' });
    });
  });

  test('sentryRequestHandler returns a passthrough middleware', async () => {
    delete process.env.SENTRY_DSN;
    const { sentryRequestHandler } = await import('../services/sentry.js');

    const handler = sentryRequestHandler();
    assert.equal(typeof handler, 'function', 'Should return a function');

    // Simulate Express middleware call
    let nextCalled = false;
    handler({}, {}, () => { nextCalled = true; });
    assert.ok(nextCalled, 'next() should be called (passthrough)');
  });

  test('sentryErrorHandler returns a passthrough error middleware', async () => {
    delete process.env.SENTRY_DSN;
    const { sentryErrorHandler } = await import('../services/sentry.js');

    const handler = sentryErrorHandler();
    assert.equal(typeof handler, 'function', 'Should return a function');

    // Simulate Express error middleware call
    let nextCalled = false;
    const fakeErr = new Error('test');
    handler(fakeErr, {}, {}, (passedErr) => {
      nextCalled = true;
      assert.equal(passedErr, fakeErr, 'Should forward the error');
    });
    assert.ok(nextCalled, 'next(err) should be called');
  });
});
