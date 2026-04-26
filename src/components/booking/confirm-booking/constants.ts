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
   Insurance Tiers — mirrors backend INSURANCE_TIERS
   ──────────────────────────────────────────────────────── */
export interface InsuranceTier {
  key: string;
  name: string;
  dailyRate: number;
  description: string;
  highlights: string[];
}

export const INSURANCE_TIERS: InsuranceTier[] = [
  {
    key: 'basic',
    name: 'Basic Protection',
    dailyRate: 12,
    description: 'Covers collision damage up to $15,000. Does not cover theft or personal belongings.',
    highlights: ['Collision damage up to $15,000', 'Roadside assistance included'],
  },
  {
    key: 'standard',
    name: 'Standard Protection',
    dailyRate: 18,
    description: 'Covers collision damage and theft up to $25,000. Does not cover personal belongings.',
    highlights: ['Collision damage up to $25,000', 'Theft protection', 'Roadside assistance included'],
  },
  {
    key: 'premium',
    name: 'Premium Protection',
    dailyRate: 25,
    description: 'Full coverage: collision, theft, personal belongings up to $50,000. Zero deductible.',
    highlights: ['Collision damage up to $50,000', 'Theft protection', 'Personal belongings covered', 'Zero deductible'],
  },
];

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
  insuranceChoice: 'own' | 'annies' | null;
  anniesTier: string | null;

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
    anniesTier: null,
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
