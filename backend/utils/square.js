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
    // .trim() guards against a trailing newline in the pasted env var — a stray
    // '\n' on the token breaks auth, and on SQUARE_ENVIRONMENT would silently
    // drop us to Sandbox (no real charge). Observed live on SQUARE_LOCATION_ID.
    const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
    if (!token) {
      console.warn('[square] SQUARE_ACCESS_TOKEN not set — payments disabled until configured');
    }
    const environment =
      String(process.env.SQUARE_ENVIRONMENT || 'sandbox').trim().toLowerCase() === 'production'
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
  // .trim() — the live env var had a trailing '\n', which Square rejects as an
  // invalid location on createPayment and in the Web SDK's payments() init.
  return (process.env.SQUARE_LOCATION_ID || '').trim();
}
