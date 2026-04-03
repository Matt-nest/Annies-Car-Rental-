import Stripe from 'stripe';

/**
 * Shared Stripe client singleton.
 * Avoids creating multiple instances across routes and services.
 */
let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
