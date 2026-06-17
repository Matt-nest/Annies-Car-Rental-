/**
 * Payment provider flag.
 *
 * Annie's runs Square; other clones run Stripe. Both implementations live in the
 * codebase side-by-side so a clone selects its processor with one env var and the
 * other path stays dormant as a rollback. Defaults to 'stripe' so existing clones
 * are unaffected.
 */
export const PAYMENT_PROVIDER =
  String(process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase() === 'square'
    ? 'square'
    : 'stripe';

export const IS_SQUARE = PAYMENT_PROVIDER === 'square';
export const IS_STRIPE = PAYMENT_PROVIDER === 'stripe';
