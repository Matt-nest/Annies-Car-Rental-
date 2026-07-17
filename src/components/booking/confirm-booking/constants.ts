// Re-export from shared config - single source of truth
export { API_URL } from '../../../config';

import { brand } from '../../../config/brand';

/* ────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────── */
export const PHONE_NUMBER = brand.phone;

export const STAGES = [
  { number: 1, label: 'Agreement',  sublabel: 'Sign rental contract', subSteps: 7 },
  { number: 2, label: 'Insurance',  sublabel: 'Coverage selection',   subSteps: 1 },
  { number: 3, label: 'Review',     sublabel: 'Confirm details',      subSteps: 1 },
  { number: 4, label: 'Payment',    sublabel: 'Secure checkout',      subSteps: 1 },
] as const;

// Legacy alias for backward compatibility
export const STEPS = STAGES;

function envString(value: unknown) {
  return String(value || '').trim();
}

export const PAYMENT_PROVIDER = envString(import.meta.env.VITE_PAYMENT_PROVIDER || brand.paymentProvider || 'square').toLowerCase();
export const STRIPE_CONFIGURED = PAYMENT_PROVIDER === 'stripe';
/** Must match backend FEATURE_AUTO_OVERAGE_CHARGES — drives Stripe Elements setupFutureUsage. */
export const CARD_ON_FILE_ENABLED =
  envString(import.meta.env.VITE_FEATURE_AUTO_OVERAGE_CHARGES).toLowerCase() === 'true';
export const SQUARE_CONFIGURED = PAYMENT_PROVIDER === 'square' &&
  Boolean(envString(import.meta.env.VITE_SQUARE_APPLICATION_ID)) &&
  Boolean(envString(import.meta.env.VITE_SQUARE_LOCATION_ID));
export const SQUARE_APPLICATION_ID = envString(import.meta.env.VITE_SQUARE_APPLICATION_ID);
export const SQUARE_LOCATION_ID = envString(import.meta.env.VITE_SQUARE_LOCATION_ID);
export const SQUARE_ENVIRONMENT = envString(import.meta.env.VITE_SQUARE_ENVIRONMENT || 'production').toLowerCase();

/*
 * Stripe SDK is no longer eagerly initialized here.
 * Importing this file (constants.ts) used to trigger loadStripe() at module
 * top-level, which fetched the Stripe SDK on every page that transitively
 * imported anything from constants - even the home page.
 *
 * The Stripe loader now lives in `./stripeClient.ts` and is imported only by
 * `ConfirmBooking.tsx`, which itself is lazy-loaded via `React.lazy()` in
 * `src/App.tsx`. The SDK is fetched only when a user visits /confirm.
 *
 * See `./stripeClient.ts` for the lazy getter.
 */

/* ────────────────────────────────────────────────────────
   Bonzah insurance - runtime config + tier metadata
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
  markup_cents: number;    // Brand cut
  total_cents: number;     // Customer-facing price
  coverage_information: any[];
  expires_at: string;      // ISO - internal 24h re-quote window
}

// Bonzah coverage descriptions for UI bullets
export const BONZAH_COVERAGE_LABELS: Record<string, { label: string; summary: string }> = {
  cdw:  { label: 'Collision Damage Waiver',  summary: 'Vehicle damage & theft, up to $35,000' },
  rcli: { label: 'Liability',                 summary: 'State-minimum liability for injuries & property' },
  sli:  { label: 'Supplemental Liability',    summary: '$100K/$500K bodily injury · $10K property damage' },
  pai:  { label: 'Personal Accident & Effects', summary: '$50K renter · $5K passenger · $500 personal items' },
};

// Mandatory disclosure copy from Bonzah legal.md - must render above the purchase CTA
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
   Wizard Draft - persisted to sessionStorage
   ──────────────────────────────────────────────────────── */
export interface WizardDraft {
  // Schema version — bump on any wizard-structure change so stale saved drafts
  // are discarded instead of resuming at a now-wrong stage/subStep.
  _v?: number;
  // Navigation
  stage: number;
  subStep: number;

  // Stage 1 - Agreement
  address: { line1: string; city: string; state: string; zip: string };
  dob: string;
  license: { number: string; state: string; expiry: string };
  termsAccepted: boolean;
  acknowledgements: boolean[];
  signature: { mode: 'draw' | 'type'; data: string };

  // Stage 1 - Personal insurance (optional, from agreement)
  personalInsurance: {
    company: string;
    policyNumber: string;
    expiry: string;
    agentName: string;
    agentPhone: string;
    vehicleDescription: string;
  };

  // Stage 2 - Insurance choice
  insuranceChoice: 'own' | 'bonzah' | 'none' | null;
  bonzahTierId: string | null;
  bonzahQuote: BonzahQuote | null;     // last-displayed quote (for fallback if /quote re-call fails on Continue)

  // Stage 1 - License photo uploads (optional, stored as storage paths)
  licensePhotoPaths: string[];

  // Stage 1 - License scan audit trail (method, scan ID, name match, photo path)
  licenseScanMetadata: {
    scan_id: string;
    method: 'barcode_live' | 'barcode_still' | 'azure_ocr' | 'manual';
    scanned_at: string;
    name_match: 'match' | 'mismatch' | null;
    photo_path?: string;
    scanned_name?: string;
  } | null;

  // Completed flags
  completedStages: number[];
}

export interface InsuranceDisplay {
  choice: WizardDraft['insuranceChoice'];
  label: string;
  amount: number;
  tierId: string | null;
}

function tierLabel(tierId: string | null | undefined): string {
  return tierId
    ? tierId.charAt(0).toUpperCase() + tierId.slice(1)
    : 'Bonzah';
}

export function resolveInsuranceDisplay(bookingSummary: any, draft?: WizardDraft | null): InsuranceDisplay {
  const saved = bookingSummary?.customerReceiptSnapshot?.insurance;
  const draftChoice = draft?.insuranceChoice || null;
  const savedChoice = saved?.choice || null;
  const bookingChoice = bookingSummary?.insuranceSource || null;
  const rawChoice = draftChoice
    || savedChoice
    || bookingChoice
    || (bookingSummary?.insuranceStatus === 'none' ? 'none' : null);
  const choice: WizardDraft['insuranceChoice'] =
    rawChoice === 'bonzah' || rawChoice === 'own' || rawChoice === 'none'
      ? rawChoice
      : null;

  const tierId = draft?.bonzahTierId
    || saved?.tier_id
    || bookingSummary?.insuranceTier
    || null;

  if (choice === 'bonzah') {
    const draftAmount = draft?.insuranceChoice === 'bonzah' && draft.bonzahQuote
      ? Number(draft.bonzahQuote.total_cents || 0) / 100
      : 0;
    const amount = draftAmount > 0
      ? draftAmount
      : Number(bookingSummary?.insuranceCost ?? saved?.amount ?? 0);

    return {
      choice,
      tierId,
      amount,
      label: saved?.label || `Bonzah Insurance: ${tierLabel(tierId)} (${bookingSummary?.rentalDays || 1} day${(bookingSummary?.rentalDays || 1) === 1 ? '' : 's'})`,
    };
  }

  if (choice === 'own') {
    return {
      choice,
      tierId: null,
      amount: 0,
      label: saved?.label || 'Your own insurance (no charge)',
    };
  }

  if (choice === 'none') {
    return {
      choice,
      tierId: null,
      amount: 0,
      label: saved?.label || 'No insurance provided',
    };
  }

  return {
    choice: null,
    tierId: null,
    amount: Number(bookingSummary?.insuranceCost ?? saved?.amount ?? 0),
    label: saved?.label || 'No coverage selected',
  };
}

export function savedBonzahQuoteFromSummary(bookingSummary: any): BonzahQuote | null {
  if (bookingSummary?.insuranceSource !== 'bonzah') return null;
  const totalCents = Math.round(Number(bookingSummary.insuranceCost || 0) * 100);
  if (totalCents <= 0) return null;
  return {
    tier_id: bookingSummary.insuranceTier || 'bonzah',
    quote_id: bookingSummary.bonzahQuoteId || 'saved',
    premium_cents: totalCents,
    markup_cents: 0,
    total_cents: totalCents,
    coverage_information: [],
    expires_at: bookingSummary.bonzahQuoteExpiresAt || '',
  };
}

// Bump whenever the wizard's step structure changes
// (2 = added Scan step; 3 = Review/Pay sub-steps; 4 = Review promoted to its own Stage 3, Payment → Stage 4;
//  5 = license scan metadata + auto-saved scan photos).
export const DRAFT_VERSION = 5;

export function getDefaultDraft(): WizardDraft {
  return {
    _v: DRAFT_VERSION,
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
    licenseScanMetadata: null,
    completedStages: [],
  };
}

export function getStorageKey(bookingCode: string): string {
  return `wizard_${bookingCode}`;
}

export function loadDraft(bookingCode: string): WizardDraft {
  try {
    const saved = sessionStorage.getItem(getStorageKey(bookingCode));
    if (saved) {
      const parsed = JSON.parse(saved);
      // Discard drafts saved before a wizard-structure change so they don't
      // resume at a now-wrong stage/subStep (e.g. past the Address/License steps).
      if (parsed?._v !== DRAFT_VERSION) return getDefaultDraft();
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
