/**
 * Stripe client — isolated module so the SDK only loads when this file is imported.
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

let _stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!_stripePromise) {
    _stripePromise = loadStripe(
      import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
        'pk_test_51THqNVBDLBS4aYcfqHPZnNGlwL6E8lGdzFOxYoSmd37DjxD3ofbWe6AsrEkL90LqnHfp8fEFDfAmrqfkDgcNYYqE009CXY3fGT'
    );
  }
  return _stripePromise;
}
