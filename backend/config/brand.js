/**
 * Brand Configuration — Single source of truth for all brand-specific values.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ WHITE-LABEL GUIDE                                                   │
 * │ To reskin this platform for a different car rental business:        │
 * │  1. Update the values below                                        │
 * │  2. Replace /public/logo.svg with the new brand logo               │
 * │  3. Set the corresponding env vars (SITE_URL, DASHBOARD_URL, etc.) │
 * │  4. Rebuild frontend + dashboard                                   │
 * │  5. Update payment provider, Resend, and Twilio accounts           │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Values are read from environment variables where available, falling
 * back to Annie's Car Rental defaults. For a new deployment, set the
 * env vars and the fallback values below become irrelevant.
 */

const brand = {
  // ── Identity ──────────────────────────────────────────────────────────
  name:        process.env.BRAND_NAME        || "Annie's Car Rental",
  legalEntity: process.env.BRAND_LEGAL_NAME  || "Aaron's Garage LLC",
  dba:         process.env.BRAND_DBA         || "DBA Annie's & Co",
  domain:      process.env.BRAND_DOMAIN      || 'anniescarrental.com',
  siteUrl:     process.env.SITE_URL          || 'https://anniescarrental.com',
  dashboardUrl:process.env.DASHBOARD_URL     || 'https://admin.dashboard.anniescarrental.com',

  // ── Contact ───────────────────────────────────────────────────────────
  phone:       process.env.BRAND_PHONE       || '(772) 207-1655',
  email:       process.env.BRAND_EMAIL       || 'info@anniescarrental.com',
  ownerEmail:  process.env.OWNER_EMAIL       || 'annie@anniescarrental.com',
  emailFrom:   process.env.EMAIL_FROM        || "Annie's Car Rental <noreply@anniescarrental.com>",

  // ── Location ──────────────────────────────────────────────────────────
  location: {
    city:    process.env.BRAND_CITY    || 'Port St. Lucie',
    state:   process.env.BRAND_STATE   || 'FL',
    zip:     process.env.BRAND_ZIP     || '34952',
    address: process.env.BRAND_ADDRESS || '1234 SE Commerce Ave',
    timezone: process.env.CRON_TIMEZONE || 'America/New_York',
  },

  // ── Financials ────────────────────────────────────────────────────────
  taxRate:      parseFloat(process.env.TAX_RATE || '0.07'),
  depositCents: parseInt(process.env.DEFAULT_DEPOSIT_CENTS || '15000', 10),
  currency:     'usd',
  // Federal EIN printed on invoices. Empty fallback on purpose — a blank EIN
  // is correct until the brand provides its own; never inherit a template EIN.
  ein:          process.env.BRAND_EIN || '',

  // ── Visual Identity ───────────────────────────────────────────────────
  colors: {
    primary:   process.env.BRAND_COLOR_PRIMARY   || '#D4AF37',  // Gold
    secondary: process.env.BRAND_COLOR_SECONDARY || '#1c1917',  // Stone dark
    accent:    process.env.BRAND_COLOR_ACCENT    || '#92400e',  // Amber dark
    muted:     '#78716c',  // Stone muted
    link:      '#c8a97e',  // Warm gold link
    // Fillable-field background tint on the rental-agreement PDF. Warm salmon
    // for Annie's; clones override via BRAND_PDF_FIELD_FILL (e.g. a cool tint
    // that reads cleanly against a navy/orange palette).
    pdfFieldFill: process.env.BRAND_PDF_FIELD_FILL || '#FBE2D5',
  },

  logoUrl:     process.env.BRAND_LOGO_URL || 'https://anniescarrental.com/logo.svg',

  // ── External Links ────────────────────────────────────────────────────
  reviewLink:  process.env.BRAND_REVIEW_LINK || 'https://g.page/annies-car-rental/review',

  // ── Payment Descriptions ─────────────────────────────────────────────
  /** Legacy Stripe description prefix kept for JD Coastal compatibility. */
  stripeDescriptionPrefix: process.env.BRAND_STRIPE_PREFIX || "Annie's Car Rental",
};

export default brand;
