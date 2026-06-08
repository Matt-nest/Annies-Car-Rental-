import Stripe from 'stripe';

/**
 * Shared Stripe client singleton.
 * Avoids creating multiple instances across routes and services.
 */
let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Let the server boot before Stripe is configured (new-client onboarding).
      // The Stripe constructor requires a truthy key; with this placeholder it
      // constructs fine and only real API calls fail (with a clear Stripe auth
      // error) until STRIPE_SECRET_KEY is set. Payment paths are unusable until then.
      console.warn('[stripe] STRIPE_SECRET_KEY not set — payments disabled until configured');
    }
    _stripe = new Stripe(key || 'sk_test_unconfigured_placeholder', {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}
