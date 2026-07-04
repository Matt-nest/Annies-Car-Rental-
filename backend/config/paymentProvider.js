export const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || 'square').toLowerCase();

export function isStripeProvider() {
  return PAYMENT_PROVIDER === 'stripe';
}

export function isSquareProvider() {
  return PAYMENT_PROVIDER === 'square';
}

export function requireProvider(provider) {
  if (PAYMENT_PROVIDER !== provider) {
    const err = new Error(`Payment provider is '${PAYMENT_PROVIDER}', not '${provider}'`);
    err.status = 404;
    throw err;
  }
}
