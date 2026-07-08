/**
 * Stripe client - isolated module so the SDK only loads when this file is imported.
 *
 * Previously: `loadStripe(...)` was called at module top-level in `constants.ts`.
 * Because constants.ts is imported by every wizard step component (just for types
 * and helpers like `formatCurrency`, `WizardDraft`, `STAGES`), importing those
 * helpers anywhere in the import graph eagerly fetched Stripe's SDK.
 *
 * Now: this file is only imported by `ConfirmBooking.tsx`, which itself is loaded
 * lazily via `React.lazy()` in `App.tsx`. Stripe is only fetched when a user
 * actually navigates to `/confirm`.
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { API_URL } from '../../../config';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

let _stripePromise: Promise<Stripe | null> | null = null;

async function resolvePublishableKey(): Promise<string> {
  if (STRIPE_PUBLISHABLE_KEY) {
    return STRIPE_PUBLISHABLE_KEY;
  }
  try {
    const res = await fetch(`${API_URL}/stripe/public-config`);
    if (res.ok) {
      const data = await res.json();
      if (data.publishableKey) return data.publishableKey;
    }
  } catch { /* fall through */ }
  return STRIPE_PUBLISHABLE_KEY;
}

export function getStripe(): Promise<Stripe | null> {
  if (!_stripePromise) {
    _stripePromise = resolvePublishableKey().then((key) => loadStripe(key));
  }
  return _stripePromise;
}
