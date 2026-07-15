export const PAYMENT_PROVIDER = (import.meta.env.VITE_PAYMENT_PROVIDER || 'square').toLowerCase();

export function isStripeProvider() {
  return PAYMENT_PROVIDER !== 'square';
}

export function isSquareProvider() {
  return PAYMENT_PROVIDER === 'square';
}
