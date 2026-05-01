import { loadStripe } from '@stripe/stripe-js';

// Re-export from shared config — single source of truth
export { API_URL } from '../../../config';

/* ────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────── */
export const PHONE_NUMBER = '(772) 985-6667';

export const STAGES = [
  { number: 1, label: 'Agreement',  sublabel: 'Sign rental contract', subSteps: 6 },
  { number: 2, label: 'Insurance',  sublabel: 'Coverage selection',   subSteps: 1 },
  { number: 3, label: 'Payment',    sublabel: 'Review & pay',         subSteps: 1 },
] as const;

// Legacy alias for backward compatibility
export const STEPS = STAGES;

export const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51THqNVBDLBS4aYcfqHPZnNGlwL6E8lGdzFOxYoSmd37DjxD3ofbWe6AsrEkL90LqnHfp8fEFDfAmrqfkDgcNYYqE009CXY3fGT'
);

/* ────────────────────────────────────────────────────────
   Bonzah insurance — runtime config + tier metadata
   ──────────────────────────────────────────────────────── */

// Tier shape returned by GET /bookings/insurance/config (Supabase settings.bonzah_tiers)
export interface BonzahTier {
  id: string;            // e.g., "essential" | "standard" | "complete"
  label: string;         // display label
  coverages: string[];   // ['cdw'] | ['cdw','rcli','sli'] | ['cdw','rcli','sli','pai']
  default?: boolean;     // pre-selected on page load
  recommended?: boolean; // shows "Recommended" badge
}

// Public config snapshot returned to the wizard
export interface BonzahConfig {
  enabled: boolean;
  tiers: BonzahTier[];
  markup_percent: number;
  excluded_states: string[];      // hide Bonzah path entirely (regulatory)
  pai_excluded_states: string[];  // hide Complete tier (PAI not available)
}

// Live quote from POST /bookings/:code/insurance/quote
export interface BonzahQuote {
  tier_id: string;
  quote_id: string;
  premium_cents: number;   // Bonzah's base premium
  markup_cents: number;    // Annie's cut
  total_cents: number;     // Customer-facing price
  coverage_information: any[];
  expires_at: string;      // ISO — internal 24h re-quote window
}

// Bonzah coverage descriptions for UI bullets
export const BONZAH_COVERAGE_LABELS: Record<string, { label: string; summary: string }> = {
  cdw:  { label: 'Collision Damage Waiver',  summary: 'Vehicle damage & theft, up to $35,000' },
  rcli: { label: 'Liability',                 summary: 'State-minimum liability for injuries & property' },
  sli:  { label: 'Supplemental Liability',    summary: '$100K/$500K bodily injury · $10K property damage' },
  pai:  { label: 'Personal Accident & Effects', summary: '$50K renter · $5K passenger · $500 personal items' },
};

// Mandatory disclosure copy from Bonzah legal.md — must render above the purchase CTA
export const BONZAH_DISCLOSURE_TEXT =
  'By selecting any of these insurances, the renter agrees to these Terms and Conditions, ' +
  'Privacy, and Covered Vehicles. Insurance is only for drivers 21 years and older with a valid ' +
  'driver’s license. Unlicensed drivers are not entitled to coverage under any circumstances. ' +
  'The renter will be responsible for any unlisted additional drivers. Insurance may not apply if ' +
  'the renter or additional driver violates the rental agreement or violates traffic regulations.';

export const BONZAH_DISCLOSURE_LINKS = {
  terms: 'https://bonzah.com/terms',
  privacy: 'https://bonzah.com/privacy',
  vehicles: 'https://bonzah.com/included-and-restricted-vehicle-types',
};

/* ────────────────────────────────────────────────────────
   Wizard Draft — persisted to sessionStorage
   ──────────────────────────────────────────────────────── */
export interface WizardDraft {
  // Navigation
  stage: number;
  subStep: number;

  // Stage 1 — Agreement
  address: { line1: string; city: string; state: string; zip: string };
  dob: string;
  license: { number: string; state: string; expiry: string };
  termsAccepted: boolean;
  acknowledgements: boolean[];
  signature: { mode: 'draw' | 'type'; data: string };

  // Stage 1 — Personal insurance (optional, from agreement)
  personalInsurance: {
    company: string;
    policyNumber: string;
    expiry: string;
    agentName: string;
    agentPhone: string;
    vehicleDescription: string;
  };

  // Stage 2 — Insurance choice
  insuranceChoice: 'own' | 'bonzah' | null;
  bonzahTierId: string | null;
  bonzahQuote: BonzahQuote | null;     // last-displayed quote (for fallback if /quote re-call fails on Continue)

  // Stage 1 — License photo uploads (optional, stored as storage paths)
  licensePhotoPaths: string[];

  // Completed flags
  completedStages: number[];
}

export function getDefaultDraft(): WizardDraft {
  return {
    stage: 1,
    subStep: 1,
    address: { line1: '', city: '', state: '', zip: '' },
    dob: '',
    license: { number: '', state: '', expiry: '' },
    termsAccepted: false,
    acknowledgements: [],
    signature: { mode: 'draw', data: '' },
    personalInsurance: {
      company: '', policyNumber: '', expiry: '',
      agentName: '', agentPhone: '', vehicleDescription: '',
    },
    insuranceChoice: null,
    bonzahTierId: null,
    bonzahQuote: null,
    licensePhotoPaths: [],
    completedStages: [],
  };
}

export function getStorageKey(bookingCode: string): string {
  return `annie_wizard_${bookingCode}`;
}

export function loadDraft(bookingCode: string): WizardDraft {
  try {
    const saved = sessionStorage.getItem(getStorageKey(bookingCode));
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...getDefaultDraft(), ...parsed };
    }
  } catch {}
  return getDefaultDraft();
}

export function saveDraft(bookingCode: string, draft: WizardDraft): void {
  try {
    sessionStorage.setItem(getStorageKey(bookingCode), JSON.stringify(draft));
  } catch {}
}

export function clearDraft(bookingCode: string): void {
  try {
    sessionStorage.removeItem(getStorageKey(bookingCode));
  } catch {}
}

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

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
