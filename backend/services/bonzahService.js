/**
 * Bonzah business-logic layer.
 *
 * All Bonzah API specifics live here: tier→coverage mapping, field translation
 * (snake_case DB → Bonzah's MM/DD/YYYY HH:mm:ss + 11-digit phone format), and
 * pre-flight validation (age 21+, SLI requires RCLI, etc.).
 *
 * Routes call these functions; they return clean JSON shapes for the rest of
 * the codebase. Never import bonzah.js (utils) directly from routes — funnel
 * through this service so audit logs always have booking_id.
 *
 * NOTE: Phase 1 ships only the function signatures + a working getMasterStates()
 * and the helpers needed by /admin/bonzah/health. The full quote/bind/cancel
 * implementations land in Phase 2 + Phase 3 as scoped in BONZAH_INTEGRATION
 * implementation plan. Stubs throw "not yet implemented" if called early.
 */

import { bonzahCall, bonzahCallBinary, BonzahError } from '../utils/bonzah.js';
import { supabase } from '../db/supabase.js';

// Re-export so route handlers don't need to depend on utils/ directly
export { BonzahError };

const COVERAGE_PDF_KEYS = {
  cdw:  'cdw_pdf_id',
  rcli: 'rcli_pdf_id',
  sli:  'sli_pdf_id',
  pai:  'pai_pdf_id',
};

/**
 * Fetch a policy PDF from Bonzah by coverage code.
 *
 * Bonzah's PDF endpoint requires the per-coverage `*_pdf_id` integer, which only
 * comes back from GET /Bonzah/policy. To stay schema-light we don't persist
 * those IDs; we re-fetch the policy on each PDF request (admin-triggered, rare).
 *
 * @param {string} policyId — Bonzah policy_id
 * @param {string} coverageCode — 'cdw' | 'rcli' | 'sli' | 'pai'
 * @param {string} [bookingId] — for audit log linkage
 * @returns {Promise<{ buffer: Buffer, contentType: string, filename: string }>}
 */
export async function getPolicyPdf(policyId, coverageCode, bookingId = null) {
  const key = COVERAGE_PDF_KEYS[coverageCode];
  if (!key) throw new Error(`Unknown coverage code: ${coverageCode}. Expected one of ${Object.keys(COVERAGE_PDF_KEYS).join(', ')}`);

  const polRes = await bonzahCall({
    method: 'GET',
    path: '/api/v1/Bonzah/policy',
    query: { policy_id: policyId },
    eventType: 'policy_get',
    bookingId,
  });

  const dataId = polRes?.data?.[key];
  if (!dataId) {
    throw new BonzahError(`No ${coverageCode.toUpperCase()} PDF on policy (coverage may not have been opted)`, { eventType: 'pdf' });
  }

  const policyNo = polRes?.data?.policy_no || policyId;
  const filename = `${policyNo}-${coverageCode.toUpperCase()}.pdf`;

  const { buffer, contentType } = await bonzahCallBinary({ policyId, dataId, bookingId });
  return { buffer, contentType: contentType || 'application/pdf', filename };
}

// ────────────────────────────────────────────────────────────
// Settings access
// ────────────────────────────────────────────────────────────

/**
 * Read a single key from the settings table. Returns the parsed JSONB value,
 * or `defaultValue` if the row is missing.
 */
export async function getSetting(key, defaultValue = null) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`settings read failed for ${key}: ${error.message}`);
  return data ? data.value : defaultValue;
}

/**
 * Resolve a tier_id to its Bonzah coverage flags by reading settings.bonzah_tiers.
 * Returns { cdw_cover, rcli_cover, sli_cover, pai_cover }.
 */
export async function tierToCoverages(tierId) {
  const tiers = await getSetting('bonzah_tiers', []);
  const tier = tiers.find(t => t.id === tierId);
  if (!tier) throw new Error(`Unknown bonzah tier: ${tierId}`);
  const set = new Set(tier.coverages || []);
  return {
    cdw_cover: set.has('cdw'),
    rcli_cover: set.has('rcli'),
    sli_cover: set.has('sli'),
    pai_cover: set.has('pai'),
  };
}

// ────────────────────────────────────────────────────────────
// Field translation helpers
// ────────────────────────────────────────────────────────────

/**
 * Bonzah requires phone as 11 digits: country code (no +) + 10-digit number.
 * Strips everything non-numeric. If the number is 10 digits, prefixes "1" (US).
 * Throws if result isn't exactly 11 digits.
 */
export function formatPhone(raw) {
  if (!raw) throw new Error('phone is required');
  const digits = String(raw).replace(/\D/g, '');
  const eleven = digits.length === 10 ? `1${digits}` : digits;
  if (eleven.length !== 11) {
    throw new Error(`phone must normalize to 11 digits, got "${raw}" → "${eleven}"`);
  }
  return eleven;
}

/**
 * Bonzah expects MM/DD/YYYY (date-only) or MM/DD/YYYY HH:mm:ss (datetime).
 * Input: ISO string OR Date OR { date: 'YYYY-MM-DD', time: 'HH:mm:ss' }.
 */
export function formatDateOnly(isoOrDate) {
  if (!isoOrDate) throw new Error('date is required');
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${isoOrDate}`);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDateTime(date, time) {
  // date: 'YYYY-MM-DD' (Postgres DATE), time: 'HH:mm:ss' (Postgres TIME)
  if (!date || !time) throw new Error('date and time both required');
  const [yyyy, mm, dd] = date.split('-');
  // Bonzah accepts HH:mm:ss; if HH:mm passed, append :00
  const t = time.length === 5 ? `${time}:00` : time;
  return `${mm}/${dd}/${yyyy} ${t}`;
}

/**
 * Read the current wall-clock time in Annie's local TZ as MM/DD/YYYY HH:mm:ss.
 * Used to clamp trip_start_date when the booking's pickup is already past — Bonzah
 * validates the full datetime, not just the date.
 */
function nowInLocalTz() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value;
  let hour = get('hour');
  if (hour === '24') hour = '00'; // Some Node ICU builds emit 24 for midnight
  return `${get('month')}/${get('day')}/${get('year')} ${hour}:${get('minute')}:${get('second')}`;
}

/**
 * Returns true if the booking's pickup datetime (in Annie's local TZ) is already
 * earlier than wall-clock now. Compares ISO-style strings — both are constructed
 * in the same TZ so lexical compare is correct.
 */
function pickupIsPast(pickupDate, pickupTime) {
  if (!pickupDate || !pickupTime) return false;
  const t = pickupTime.length === 5 ? `${pickupTime}:00` : pickupTime;
  const pickupIso = `${pickupDate}T${t}`;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (k) => parts.find(p => p.type === k)?.value;
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const nowIso = `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
  return pickupIso < nowIso;
}

/**
 * Compute age in whole years from a date_of_birth (YYYY-MM-DD or Date).
 */
export function computeAge(dob, asOf = new Date()) {
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return NaN;
  let age = asOf.getUTCFullYear() - d.getUTCFullYear();
  const m = asOf.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && asOf.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

/**
 * Pre-flight validation against Bonzah's hard rules. Throws on first violation.
 * Run BEFORE calling getQuote/bindPolicy.
 */
export function validateBookingForBonzah(booking, customer, coverages) {
  if (!customer?.date_of_birth) throw new Error('customer.date_of_birth required for Bonzah');
  const age = computeAge(customer.date_of_birth);
  if (!(age >= 21)) throw new Error(`Driver age ${age} < 21 — Bonzah ineligible`);

  if (coverages.sli_cover && !coverages.rcli_cover) {
    throw new Error('Bonzah rule: SLI requires RCLI');
  }
  if (coverages.cdw_cover && !booking) {
    throw new Error('booking required when CDW selected (for inspection_done)');
  }
  // Phone format is enforced by formatPhone() at translation time.
}

// ────────────────────────────────────────────────────────────
// Bonzah API operations
// ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/Bonzah/master — fetch master data (states, countries, etc.).
 * Used by /admin/bonzah/health for connectivity check.
 */
export async function getMaster({ master_name, values, filter, filter_value } = { master_name: 'state', values: 'state' }) {
  return bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/master',
    body: { master_name, values, filter, filter_value },
    eventType: 'health',
  });
}

// ────────────────────────────────────────────────────────────
// Booking → Bonzah field mapping
// ────────────────────────────────────────────────────────────

/**
 * Florida (Annie's home base) defaults — used when booking lacks a pickup state
 * or pickup_country (which our schema doesn't track today, only return_location strings).
 * Annie's is Florida-only operationally; this is safe.
 */
const DEFAULT_PICKUP_COUNTRY = 'United States';
const DEFAULT_PICKUP_STATE = 'Florida';
const DEFAULT_TIMEZONE = 'America/New_York'; // Florida is Eastern

/**
 * Build the body for POST /api/v1/Bonzah/quote.
 *
 * @param booking   — bookings row (already joined with vehicles in caller)
 * @param customer  — customers row
 * @param coverages — { cdw_cover, rcli_cover, sli_cover, pai_cover }
 * @param opts.finalize — 0 (draft) | 1 (lock for payment)
 * @param opts.quote_id — existing draft quote_id to update (else "")
 */
export function buildQuoteBody(booking, customer, coverages, { finalize = 0, quote_id = '' } = {}) {
  if (!booking) throw new Error('booking required');
  if (!customer) throw new Error('customer required');

  // Resolve pickup state — booking.pickup_location is a free-text string today, so
  // we fall back to Florida for Annie's. If the booking has a `pickup_state` column
  // in the future (or it's parsed from pickup_location), prefer that.
  const pickupState = booking.pickup_state || DEFAULT_PICKUP_STATE;
  const pickupCountry = booking.pickup_country || DEFAULT_PICKUP_COUNTRY;

  // Customer residence — fall back to pickup state if missing (rare).
  const residenceState = customer.state
    ? expandStateAbbrev(customer.state)
    : pickupState;
  const residenceCountry = DEFAULT_PICKUP_COUNTRY;

  // Vehicle metadata for Bonzah's premium calc (optional but improves quote accuracy)
  const vehicle = booking.vehicles || {};

  // Bonzah rejects past trip_start_date (validates datetime, not just date) with
  // "Invalid Policy Start date — Kindly select today's <date> or any date in the future."
  // Insurance can't be backdated. If the booking's full pickup datetime is already past
  // (common: day-of bookings where the wizard runs after pickup_time, or stale test data),
  // send "now" in Annie's local TZ. trip_end_date is left as-is.
  const trip_start_date = pickupIsPast(booking.pickup_date, booking.pickup_time)
    ? nowInLocalTz()
    : formatDateTime(booking.pickup_date, booking.pickup_time);

  return {
    quote_id,
    finalize,
    source: 'API',

    // Trip details
    trip_start_date,
    trip_end_date: formatDateTime(booking.return_date, booking.return_time),
    pickup_country: pickupCountry,
    pickup_state: pickupState,
    drop_off_time: 'Same',
    policy_booking_time_zone: DEFAULT_TIMEZONE,

    // Coverage selection (booleans)
    ...coverages,

    // CDW requires inspection_done; we always do "Rental Agency" inspection
    ...(coverages.cdw_cover ? { inspection_done: 'Rental Agency' } : {}),

    // Renter
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    dob: formatDateOnly(customer.date_of_birth),
    pri_email_address: customer.email || '',
    alt_email_address: '',
    address_line_1: customer.address_line1 || '',
    address_line_2: customer.address_line2 || '',
    zip_code: customer.zip || '',
    phone_no: formatPhone(customer.phone),
    license_no: customer.driver_license_number || '',
    drivers_license_state: customer.driver_license_state || '',

    // Residence (defaults to pickup state)
    residence_country: residenceCountry,
    residence_state: residenceState,

    // Vehicle (optional — improves rating)
    year: vehicle.year || undefined,
    make: vehicle.make || undefined,
    model: vehicle.model || undefined,

    rental_use: 'Pleasure/Personal',
  };
}

/**
 * Bonzah expects full state names ("California"), not 2-letter codes ("CA").
 * Customers store 2-letter; expand here. Returns input unchanged if not 2-letter.
 */
function expandStateAbbrev(s) {
  if (!s || s.length !== 2) return s;
  const map = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
    CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
    HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
    LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
    MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
    NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
    OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
    SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
    WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  };
  return map[s.toUpperCase()] || s;
}

// ────────────────────────────────────────────────────────────
// Bonzah API operations — Phase 2
// ────────────────────────────────────────────────────────────

/**
 * Get a Bonzah quote (draft, finalize:0). Run validation, call /quote.
 *
 * @param booking   — full booking row including .vehicles join
 * @param customer  — full customer row
 * @param tierId    — selected tier id from settings.bonzah_tiers
 * @param opts.existingQuoteId — if updating an existing draft
 * @returns { quote_id, premium_cents, total_cents (Bonzah's), coverage_information, raw }
 */
export async function getQuote(booking, customer, tierId, { existingQuoteId = '' } = {}) {
  const coverages = await tierToCoverages(tierId);
  validateBookingForBonzah(booking, customer, coverages);

  const body = buildQuoteBody(booking, customer, coverages, {
    finalize: 0,
    quote_id: existingQuoteId,
  });

  const res = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/quote',
    body,
    eventType: 'quote',
    bookingId: booking.id,
  });

  const data = res?.data || {};
  const totalPremium = Number(data.total_premium ?? data.total_amount ?? 0);
  if (!Number.isFinite(totalPremium) || totalPremium <= 0) {
    throw new BonzahError(`Bonzah returned invalid premium: ${data.total_premium}`, { eventType: 'quote' });
  }

  return {
    quote_id: data.quote_id,
    payment_id: data.payment_id || null,        // not present on draft — only after finalize
    premium_cents: Math.round(totalPremium * 100),
    total_amount: Number(data.total_amount || totalPremium),
    coverage_information: data.coverage_information || [],
    raw: data,
  };
}

/**
 * Bind a Bonzah policy. Two API calls:
 *   1. POST /quote with finalize:1 (locks the quote, returns payment_id)
 *   2. POST /payment with { payment_id, amount } (charges Bonzah's broker credit, issues policy_no)
 *
 * Caller (Stripe webhook) has already collected money from the customer — this
 * is the back-office settlement against Bonzah. If step 1 succeeds and step 2
 * fails, the quote is locked but unpaid; runbook handles re-payment by hand.
 *
 * @returns { policy_id, policy_no, premium_cents, raw_finalize, raw_payment }
 */
export async function bindPolicy(booking, customer, tierId, bookingId) {
  const coverages = await tierToCoverages(tierId);
  validateBookingForBonzah(booking, customer, coverages);

  // Step 1: finalize the quote
  const finalizeBody = buildQuoteBody(booking, customer, coverages, {
    finalize: 1,
    quote_id: booking.bonzah_quote_id || '',
  });

  const finalizeRes = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/quote',
    body: finalizeBody,
    eventType: 'bind',
    bookingId,
  });

  const fdata = finalizeRes?.data || {};
  const policyId = fdata.policy_id;
  const paymentId = fdata.payment_id;
  const amount = Number(fdata.total_amount);
  const premium = Number(fdata.total_premium ?? amount);

  if (!policyId || !paymentId || !(amount > 0)) {
    throw new BonzahError(
      `Bonzah finalize incomplete: policy_id=${policyId} payment_id=${paymentId} amount=${amount}`,
      { eventType: 'bind' }
    );
  }

  // Step 2: process payment (charges Bonzah's broker credit)
  const paymentRes = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/payment',
    body: { payment_id: paymentId, amount: amount.toString() },
    eventType: 'bind',
    bookingId,
  });

  const pdata = paymentRes?.data || {};
  const policyNo = pdata.policy_no || fdata.policy_no || null;

  if (!policyNo) {
    throw new BonzahError('Bonzah payment succeeded but no policy_no returned', { eventType: 'bind' });
  }

  return {
    policy_id: policyId,
    policy_no: policyNo,
    premium_cents: Math.round(premium * 100),
    total_amount: amount,
    raw_finalize: fdata,
    raw_payment: pdata,
  };
}

/**
 * Phase 3/4 — GET /api/v1/Bonzah/policy?policy_id=...
 * Returns full policy: status, premium, coverage limits, deductibles, dates, PDF IDs.
 */
export async function getPolicyStatus(policyId, bookingId = null) {
  if (!policyId) throw new Error('policyId required');
  return bonzahCall({
    method: 'GET',
    path: '/api/v1/Bonzah/policy',
    query: { policy_id: policyId },
    eventType: 'policy_get',
    bookingId,
  });
}

/**
 * Cancel a Bonzah policy.
 *
 * POST /api/v1/Bonzah/newendorse_cncl with finalize:1 submits a cancellation
 * endorsement to the Bonzah underwriter for approval. Once approved, the refund
 * (if any) is credited to Annie's broker balance — NOT returned to the customer.
 * From the customer's perspective: they keep no money on cancel.
 *
 * Cancellations do NOT take effect immediately at the API layer — they enter
 * the pending-endorsement queue. The polling job picks up status changes.
 *
 * @returns { endorsement_id, eproposal_id, premium_value, raw }
 *   premium_value may be negative (refund-to-credit amount).
 */
export async function cancelPolicy(policyId, remarks, bookingId) {
  if (!policyId) throw new Error('policyId required');
  const res = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/newendorse_cncl',
    body: {
      endorsement_id: '',
      eproposal_id: '',
      policy_id: policyId,
      endorsement_remarks: remarks || '',
      endo_source: 'API',
      endo_booking_time_zone: DEFAULT_TIMEZONE,
      finalize: 1,
    },
    eventType: 'cancel',
    bookingId,
  });

  const data = res?.data || {};
  return {
    endorsement_id: data.endorsement_id || null,
    eproposal_id: data.eproposal_id || null,
    nstp_id: data.nstp_id || null,
    premium_value: Number(data.premium_value ?? 0),
    raw: data,
  };
}

/**
 * Extend a Bonzah policy's end date (or shrink it).
 *
 * POST /api/v1/Bonzah/newendorse_dc — date-change endorsement.
 *   - Extending end date → premium_value > 0 → caller must call payEndorsement()
 *     with the returned epayment_id to actually charge & finalize.
 *   - Shrinking end date → premium_value < 0 → goes to underwriter for approval;
 *     refund-to-credit is admin-handled.
 *   - Bonzah forbids advancing the start date — only postponement is allowed.
 *
 * @param policyId        — Bonzah policy_id
 * @param newPolicyEndDateStr — Postgres DATE 'YYYY-MM-DD'
 * @param newPolicyEndTimeStr — Postgres TIME 'HH:mm:ss'
 * @param policyStartDateStr  — original start date (DATE) — required by Bonzah
 * @param policyStartTimeStr  — original start time (TIME)
 */
export async function extendPolicy(policyId, {
  newPolicyEndDate,
  newPolicyEndTime,
  policyStartDate,
  policyStartTime,
}, bookingId) {
  if (!policyId) throw new Error('policyId required');
  const res = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/newendorse_dc',
    body: {
      endorsement_id: '',
      eproposal_id: '',
      policy_id: policyId,
      policy_start_date: formatDateTime(policyStartDate, policyStartTime),
      policy_end_date: formatDateTime(newPolicyEndDate, newPolicyEndTime),
      endorsement_remarks: '',
      endo_source: 'API',
      endo_booking_time_zone: DEFAULT_TIMEZONE,
      finalize: 1,
    },
    eventType: 'extend',
    bookingId,
  });

  const data = res?.data || {};
  return {
    endorsement_id: data.endorsement_id || null,
    eproposal_id: data.eproposal_id || null,
    epayment_id: data.epayment_id || null,
    nstp_id: data.nstp_id || null,
    premium_value: Number(data.premium_value ?? 0),
    computed_premium_value: Number(data.computed_premium_value ?? 0),
    raw: data,
  };
}

/**
 * Pay for an endorsement (e.g., the additional premium owed after an extension).
 * POST /api/v1/Bonzah/epayment with { epayment_id, amount }.
 */
export async function payEndorsement(epaymentId, amount, bookingId) {
  if (!epaymentId) throw new Error('epaymentId required');
  if (!(Number(amount) > 0)) throw new Error('amount must be positive');

  const res = await bonzahCall({
    method: 'POST',
    path: '/api/v1/Bonzah/epayment',
    body: {
      epayment_id: epaymentId,
      amount: String(amount),
    },
    eventType: 'epayment',
    bookingId,
  });
  return res?.data || {};
}

/**
 * Fetch completed endorsements for a policy. Used by the polling job to detect
 * cancellation approvals + date-change settlements without a webhook.
 * GET /api/v1/Bonzah/endorsement_completed?policy_id=...
 */
export async function getCompletedEndorsements(policyId, bookingId = null) {
  if (!policyId) throw new Error('policyId required');
  return bonzahCall({
    method: 'GET',
    path: '/api/v1/Bonzah/endorsement_completed',
    query: { policy_id: policyId },
    eventType: 'poll',
    bookingId,
  });
}

// ────────────────────────────────────────────────────────────
// Health check
// ────────────────────────────────────────────────────────────

/**
 * Used by GET /admin/bonzah/health. Confirms credentials + connectivity by
 * authenticating + fetching the master states list.
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    const res = await getMaster({ master_name: 'state', values: 'state', filter: 'country', filter_value: 'United States' });
    const stateCount = Array.isArray(res?.data) ? res.data.length : 0;
    return {
      ok: true,
      duration_ms: Date.now() - start,
      bonzah_status: res?.status,
      states_returned: stateCount,
      base_url: process.env.BONZAH_API_BASE_URL || 'https://bonzah.sb.insillion.com',
    };
  } catch (err) {
    return {
      ok: false,
      duration_ms: Date.now() - start,
      error: err?.message || String(err),
      http_status: err?.httpStatus,
      bonzah_status: err?.bonzahStatus,
      bonzah_txt: err?.bonzahTxt,
      base_url: process.env.BONZAH_API_BASE_URL || 'https://bonzah.sb.insillion.com',
    };
  }
}
