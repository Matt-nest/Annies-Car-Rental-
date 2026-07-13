import { test } from 'node:test';
import assert from 'node:assert/strict';

const EXPECTED_DEFAULT_PROVIDER = 'square';

async function loadConfig(provider) {
  const original = process.env.PAYMENT_PROVIDER;
  if (provider === undefined) {
    delete process.env.PAYMENT_PROVIDER;
  } else {
    process.env.PAYMENT_PROVIDER = provider;
  }

  const url = new URL('../config/paymentProvider.js', import.meta.url);
  url.searchParams.set('provider', provider ?? 'unset');
  url.searchParams.set('nonce', `${Date.now()}-${Math.random()}`);
  const config = await import(url.href);

  if (original === undefined) {
    delete process.env.PAYMENT_PROVIDER;
  } else {
    process.env.PAYMENT_PROVIDER = original;
  }

  return config;
}

test('payment provider defaults to the brand provider', async () => {
  const config = await loadConfig(undefined);

  assert.equal(config.DEFAULT_PAYMENT_PROVIDER, EXPECTED_DEFAULT_PROVIDER);
  assert.equal(config.PAYMENT_PROVIDER, EXPECTED_DEFAULT_PROVIDER);
  assert.equal(config.isStripeProvider(), false);
  assert.equal(config.isSquareProvider(), true);
});

test('payment provider honors valid explicit providers', async () => {
  const stripe = await loadConfig('stripe');
  assert.equal(stripe.PAYMENT_PROVIDER, 'stripe');
  assert.equal(stripe.isStripeProvider(), true);

  const square = await loadConfig('square');
  assert.equal(square.PAYMENT_PROVIDER, 'square');
  assert.equal(square.isSquareProvider(), true);
});

test('invalid payment provider falls back to the brand default', async () => {
  const config = await loadConfig('bogus-provider');

  assert.equal(config.PAYMENT_PROVIDER, EXPECTED_DEFAULT_PROVIDER);
});

test('requireProvider throws a 404-style error for disabled provider routes', async () => {
  const config = await loadConfig(undefined);

  assert.throws(
    () => config.requireProvider('stripe'),
    (error) => error.status === 404 && error.message.includes(EXPECTED_DEFAULT_PROVIDER),
  );
});
