import { loadStripe } from '@stripe/stripe-js';

// Re-export from shared config — single source of truth
export { API_URL } from '../../../config';

/* ────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────── */
export const BONZAH_URL = 'https://www.bonzah.com';
export const PHONE_NUMBER = '(772) 985-6667';

export const STEPS = [
  { number: 1, label: 'Agreement', sublabel: 'Sign rental contract' },
  { number: 2, label: 'Insurance', sublabel: 'Confirm coverage' },
  { number: 3, label: 'Payment', sublabel: 'One payment, all set' },
] as const;

export const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51THqNVBDLBS4aYcfqHPZnNGlwL6E8lGdzFOxYoSmd37DjxD3ofbWe6AsrEkL90LqnHfp8fEFDfAmrqfkDgcNYYqE009CXY3fGT'
);

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
export function getRefCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || params.get('code');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
