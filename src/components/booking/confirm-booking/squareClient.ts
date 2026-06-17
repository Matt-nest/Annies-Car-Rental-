/**
 * Square Web Payments SDK loader — the Square counterpart to stripeClient.ts.
 *
 * Square has no PaymentIntent/clientSecret model: this loads the Web Payments
 * SDK on demand, initializes a `payments` instance from the backend's
 * GET /square/config, and exposes helpers to mount a card field, tokenize it,
 * and (best-effort) run buyer verification for SCA/3DS.
 *
 * Loaded only from the Square checkout component, which is itself lazy (the
 * ConfirmBooking chunk), so the SDK is fetched only when a buyer reaches /confirm.
 */
import { API_URL } from './constants';

declare global {
  interface Window {
    Square?: any;
  }
}

interface SquareConfig {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

let _configPromise: Promise<SquareConfig> | null = null;
let _sdkPromise: Promise<void> | null = null;
let _payments: any = null;

async function fetchConfig(): Promise<SquareConfig> {
  if (!_configPromise) {
    _configPromise = fetch(`${API_URL}/square/config`)
      .then(r => r.json())
      .then(cfg => {
        if (!cfg?.applicationId || !cfg?.locationId) {
          throw new Error('Square is not configured on the server.');
        }
        return cfg as SquareConfig;
      });
  }
  return _configPromise;
}

function loadSdk(environment: 'sandbox' | 'production'): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (!_sdkPromise) {
    _sdkPromise = new Promise<void>((resolve, reject) => {
      const src =
        environment === 'production'
          ? 'https://web.squarecdn.com/v1/square.js'
          : 'https://sandbox.web.squarecdn.com/v1/square.js';
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load the Square payment SDK.'));
      document.head.appendChild(script);
    });
  }
  return _sdkPromise;
}

/** Get (and memoize) the Square `payments` instance. */
export async function getSquarePayments(): Promise<any> {
  if (_payments) return _payments;
  const cfg = await fetchConfig();
  await loadSdk(cfg.environment);
  _payments = window.Square.payments(cfg.applicationId, cfg.locationId);
  return _payments;
}

/**
 * Mount a Square card field into the given container element. Returns the card.
 * Accepts a Web Payments SDK `style` object so the iframe field can be themed to
 * match the brand (the iframe is cross-origin, so colors must be concrete, not
 * CSS variables).
 */
export async function mountCard(
  payments: any,
  containerEl: HTMLElement,
  options?: { style?: Record<string, unknown> }
): Promise<any> {
  const card = await payments.card(options ? { style: options.style } : undefined);
  await card.attach(containerEl);
  return card;
}

/**
 * Tokenize the card and, when possible, run buyer verification (SCA/3DS).
 * Returns the single-use payment token plus an optional verification token.
 * Throws a human-readable error on tokenization failure.
 */
export async function tokenizeAndVerify(
  payments: any,
  card: any,
  { amountCents, billingContact }: { amountCents: number; billingContact?: Record<string, unknown> }
): Promise<{ token: string; verificationToken?: string }> {
  const result = await card.tokenize();
  if (result.status !== 'OK' || !result.token) {
    const msg = result.errors?.[0]?.message || 'Please check the card details and try again.';
    throw new Error(msg);
  }

  let verificationToken: string | undefined;
  try {
    const verify = await payments.verifyBuyer(result.token, {
      amount: (amountCents / 100).toFixed(2),
      currencyCode: 'USD',
      intent: 'CHARGE',
      billingContact: billingContact || {},
    });
    verificationToken = verify?.token;
  } catch {
    // Verification is best-effort; the charge can still proceed without it.
  }

  return { token: result.token, verificationToken };
}
