import { SquareClient, SquareEnvironment } from 'square';

/**
 * Shared Square client singleton — mirrors utils/stripe.js.
 *
 * Reads SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT ('sandbox' | 'production').
 * Boots with a placeholder token when unset so the server starts during
 * new-client onboarding; only real API calls fail (with a clear Square auth
 * error) until the token is configured. Payment paths are unusable until then.
 */
let _square = null;

export function getSquare() {
  if (!_square) {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    if (!token) {
      console.warn('[square] SQUARE_ACCESS_TOKEN not set — payments disabled until configured');
    }
    const environment =
      String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox;

    _square = new SquareClient({
      token: token || 'unconfigured_placeholder',
      environment,
    });
  }
  return _square;
}

/** The Square Location all payments/refunds are attributed to. */
export function getSquareLocationId() {
  return process.env.SQUARE_LOCATION_ID || '';
}
