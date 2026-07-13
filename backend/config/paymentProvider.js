export const DEFAULT_PAYMENT_PROVIDER = 'square';

const rawProvider = (process.env.PAYMENT_PROVIDER || DEFAULT_PAYMENT_PROVIDER).toLowerCase();

export const PAYMENT_PROVIDER = ['stripe', 'square'].includes(rawProvider)
  ? rawProvider
  : DEFAULT_PAYMENT_PROVIDER;

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
