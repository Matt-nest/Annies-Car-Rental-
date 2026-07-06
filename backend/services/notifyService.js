/**
 * Unified Notification Service — replaces GoHighLevel webhooks.
 * Sends email via Resend and SMS via Twilio using templates from the
 * `email_templates` table. All sends are fire-and-forget.
 *
 * Required env vars:
 *   RESEND_API_KEY — for email
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER — for SMS
 */

import { supabase } from '../db/supabase.js';
import { storeLocalMessage } from './messagingService.js';
import { sendViaResend } from '../utils/mailTransport.js';
import { renderBrandedShell, escapeHtml } from '../utils/emailShell.js';
import FALLBACK_TEMPLATES from './fallbackTemplates.js';
import { sendToCustomer as sendPushToCustomer, sendToAllAdmins as sendPushToAllAdmins } from './pushService.js';
import brand from '../config/brand.js';

/**
 * Stages where the admin team should also receive a push notification
 * alongside the customer's email/SMS/push. Curated to high-priority,
 * action-required events — NOT every customer-facing confirmation. These
 * are the moments where the admin needs to know NOW.
 *
 * Keep this list short — a flood of admin pushes is worse than no pushes
 * at all.
 */
const ADMIN_PUSH_STAGES = new Set([
  'booking_submitted',           // new booking awaiting approval
  'damage_notification',         // incident filed
  'late_return_warning',         // customer is 1h late
  'late_return_escalation',      // customer is 4h+ late — escalate
  'inspection_charges_scheduled', // potential dispute incoming
]);

/** Concise human-readable summaries used as the admin push body. Keep
 *  under 80 chars so the iOS push card doesn't truncate. */
const ADMIN_PUSH_SUMMARIES = {
  booking_submitted:            'New booking pending approval',
  damage_notification:          'Damage report filed',
  late_return_warning:          'Customer is 1 hour late returning',
  late_return_escalation:       'Late return — 4+ hours overdue',
  inspection_charges_scheduled: 'Inspection charges scheduled',
};

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// ── Stage-to-CTA Button Map ─────────────────────────────────────────────────
// Each notification stage maps to a CTA button that appears in the email.
// `fieldKey` refers to a merge field from buildMergeFields() containing the URL.
// `fallbackPath` is used when the merge field is empty.

const STAGE_CTA = {
  booking_submitted:   { label: 'Check Booking Status',         fieldKey: 'status_link' },
  booking_approved:    { label: 'Complete Agreement \u0026 Pay →', fieldKey: 'confirm_link',  style: 'gold' },
  booking_declined:    { label: 'Browse Other Vehicles',         fallbackPath: '/vehicles' },
  booking_cancelled:   { label: 'Browse Other Vehicles',         fallbackPath: '/vehicles' },
  payment_confirmed:   { label: 'Go to My Customer Portal →', fieldKey: 'portal_link',  style: 'gold' },
  ready_for_pickup:    { label: 'View Pickup Details',           fieldKey: 'portal_link',   style: 'gold' },
  pickup_reminder:     { label: 'View Pickup Details',           fieldKey: 'portal_link',   style: 'gold' },
  day_of_pickup:       { label: 'View Pickup Details',           fieldKey: 'portal_link',   style: 'gold' },
  return_reminder:     { label: 'View Return Details',           fieldKey: 'portal_link' },
  late_return_warning:      { label: 'View Booking',              fieldKey: 'portal_link' },
  late_return_escalation:   { label: 'View Booking',              fieldKey: 'portal_link' },
  mid_rental_checkin:       { label: 'View My Rental',            fieldKey: 'portal_link' },
  extension_offer:          { label: 'Extend My Rental',          fieldKey: 'portal_link', style: 'gold' },
  repeat_customer:          { label: 'Book Again →',              fallbackPath: '/#fleet', style: 'gold' },
  return_confirmed:         { label: 'View Booking Status',       fieldKey: 'status_link' },
  rental_completed:    { label: 'Leave a Review ⭐',              fieldKey: 'review_link',   style: 'gold' },
  deposit_refunded:    { label: 'View Booking Status',           fieldKey: 'status_link' },
  deposit_settled:     { label: 'View Booking Status',           fieldKey: 'status_link' },
  invoice_sent:        { label: 'View Invoice',                  fieldKey: 'invoice_link',  style: 'gold' },
  inspection_charges_scheduled: { label: 'Review or Dispute in Portal', fieldKey: 'portal_link', style: 'gold' },
  // F-4: damage_notification fires after admin files moderate+ damage report (email-only).
  damage_notification: { label: 'View Booking',                  fieldKey: 'portal_link' },
  // F-4: day_of_return is the morning-of return SMS (parallels day_of_pickup).
  day_of_return:       { label: 'View Return Details',           fieldKey: 'portal_link' },
  insurance_policy_issued: { label: 'View My Booking',          fieldKey: 'portal_link', style: 'gold' },
  // insurance_bind_failed is admin-only — no customer CTA
  // Insurance review flow (Bonzah disabled — admin reviews own-insurance submissions)
  insurance_approved:      { label: 'View My Booking',           fieldKey: 'portal_link', style: 'gold' },
  insurance_rejected:      { label: 'Contact Us',                fallbackPath: '/#contact' },
};

/**
 * Build a styled CTA button HTML block for a given notification stage.
 * Returns empty string if no CTA is configured for the stage.
 */
function buildCtaHtml(stage, mergeFields) {
  const cta = STAGE_CTA[stage];
  if (!cta) return '';

  const siteUrl = brand.siteUrl;
  let href = '';
  if (cta.fieldKey && mergeFields[cta.fieldKey]) {
    href = mergeFields[cta.fieldKey];
  } else if (cta.fallbackPath) {
    href = `${siteUrl}${cta.fallbackPath}`;
  } else {
    return ''; // No URL available
  }

  const isGold = cta.style === 'gold';
  const bg = isGold
    ? 'background:linear-gradient(135deg,#D4AF37 0%,#B8941E 100%);color:#fff;box-shadow:0 4px 12px rgba(212,175,55,0.3);'
    : 'background:#1c1917;color:#fff;';

  return `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${href}" style="display:inline-block;${bg}font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
        ${escapeHtml(cta.label)}
      </a>
    </div>`;
}

// ── Core Send Functions ─────────────────────────────────────────────────────

/**
 * Send an email via Resend REST API.
 * Returns { id } on success or { error } on failure.
 */
export async function sendEmail({ to, subject, html }) {
  return sendViaResend({ to, subject, html });
}

/**
 * Quiet-hours check — reads the singleton business_settings row and returns
 * true if the current time (in the configured timezone) falls within the
 * configured nightly silence window. Used by sendSMS for automated sends only;
 * manual admin-initiated sends bypass via `source: 'manual'`.
 *
 * Migration 018 introduced business_settings. If the table or row is missing
 * (fresh dev DB), we return false (= not in quiet hours) so SMS flows
 * unchanged. Single read per SMS — Twilio call dwarfs the DB roundtrip.
 */
async function isInQuietHours() {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
      .eq('id', 1)
      .single();
    if (error || !data || !data.quiet_hours_enabled) return false;

    // Current time in configured TZ → minutes since midnight
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: data.quiet_hours_timezone || 'America/New_York',
      hour12: false, hour: '2-digit', minute: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const nowMin = hh * 60 + mm;

    // Parse 'HH:MM[:SS]' from Postgres TIME column → minutes
    const toMin = (t) => {
      const [h, m] = String(t).split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const startMin = toMin(data.quiet_hours_start);
    const endMin   = toMin(data.quiet_hours_end);

    if (startMin === endMin) return false;                       // 24h "off"
    if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;                // wraps midnight
  } catch (err) {
    // Fail-open: never block a legitimate send because the settings lookup failed.
    console.warn('[Notify] quiet-hours lookup failed:', err.message);
    return false;
  }
}

/**
 * Send an SMS via Twilio REST API (no SDK needed).
 * Returns { sid } on success or { skipped, ... } / { error } on failure.
 *
 * F-21: short-circuits if any customer with this phone has sms_opt_out=true.
 * Single point of enforcement so new callers are automatically protected.
 *
 * `source` controls quiet-hours behavior:
 *   'auto'   (default) — automated sends from cron / sendBookingNotification.
 *                        Skipped silently during quiet hours.
 *   'manual'           — admin-initiated (replies, test sends). Bypasses
 *                        quiet hours since the admin made the choice.
 */
export async function sendSMS({ to, body, source = 'auto' }) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[Notify] Twilio not configured — skipping SMS to ${to}`);
    return { skipped: true };
  }
  if (!to) {
    console.warn('[Notify] No phone number provided — skipping SMS');
    return { skipped: true };
  }

  // Quiet hours — only blocks automated sends. Migration 018.
  if (source === 'auto' && await isInQuietHours()) {
    console.log(`[Notify] Skipping SMS to ${to} — quiet hours active`);
    return { skipped: 'quiet_hours' };
  }

  // Normalize phone number — ensure it starts with +1 for US
  let normalized = to.replace(/\D/g, '');
  if (normalized.length === 10) normalized = '1' + normalized;
  if (!normalized.startsWith('+')) normalized = '+' + normalized;

  // F-21 opt-out enforcement — query customers by normalized phone (digits only,
  // last 10 to forgive +1 vs 1 vs raw differences). Skip send if any matching
  // row is opted out.
  try {
    const digits = normalized.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    const { data: optedOut } = await supabase
      .from('customers')
      .select('id, phone')
      .eq('sms_opt_out', true)
      .not('phone', 'is', null);
    const isOptedOut = (optedOut || []).some(c => {
      const cDigits = (c.phone || '').replace(/\D/g, '');
      return cDigits.slice(-10) === last10;
    });
    if (isOptedOut) {
      console.log(`[Notify] Skipping SMS to ${normalized} — customer has sms_opt_out=true`);
      return { skipped: 'opted_out' };
    }
  } catch (err) {
    // Don't block legitimate sends if the opt-out lookup fails (table missing,
    // RLS, network blip). Log and continue.
    console.warn('[Notify] sms_opt_out lookup failed:', err.message);
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_FROM,
        To: normalized,
        Body: body,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Notify] Twilio error for ${to}:`, err);
      return { error: err };
    }

    const data = await res.json();
    console.log(`[Notify] SMS sent → ${normalized} (sid: ${data.sid})`);
    return data;
  } catch (err) {
    console.error(`[Notify] SMS failed to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ── Template Engine ─────────────────────────────────────────────────────────

/**
 * Build a flat merge-field map from a booking payload.
 * Converts nested booking data into flat {{key}} → value pairs.
 */
export function buildMergeFields(bookingPayload) {
  const bp = bookingPayload;
  const v = bp.vehicle || {};
  const c = bp.customer || {};
  const h = bp.handoff || {};
  const siteUrl = brand.siteUrl;
  // Brand/business identity — sourced from env (brand.js) so templates never
  // hardcode a business name, address, phone, or email. Set once per clone in
  // the backend .env; every template that uses {{business_*}} re-brands itself.
  const loc = brand.location || {};
  const businessCityState = [loc.city, loc.state].filter(Boolean).join(', ');
  const businessStreet = loc.address && loc.address !== loc.city ? loc.address : '';
  const businessAddress = [
    businessStreet,
    `${businessCityState}${loc.zip ? ' ' + loc.zip : ''}`.trim(),
  ].filter(Boolean).join(', ');

  // Vehicle photo: prefer VIN-based hero image, fallback to thumbnail_url
  const vehiclePhotoUrl = v.vin
    ? `${siteUrl}/fleet/${v.vin}/hero.png`
    : (v.thumbnail_url || '');

  return {
    first_name:     c.first_name || 'Guest',
    last_name:      c.last_name || '',
    email:          c.email || '',
    phone:          c.phone || '',
    // Business identity (env-driven — see brand.js). Use these in templates
    // instead of writing the business name/phone/address as literal text.
    business_name:        brand.name,
    business_phone:       brand.phone,
    business_email:       brand.email,
    business_address:     businessAddress,
    business_city_state:  businessCityState,
    business_domain:      brand.domain,
    booking_code:   bp.booking_code || '',
    vehicle:        [v.year, v.make, v.model].filter(Boolean).join(' ') || 'your vehicle',
    pickup_date:    formatDate(bp.pickup_date),
    pickup_time:    formatTime(bp.pickup_time),
    return_date:    formatDate(bp.return_date),
    return_time:    formatTime(bp.return_time),
    total_cost:     bp.total_cost ? Number(bp.total_cost).toFixed(2) : '0.00',
    rental_days:    bp.rental_days || '',
    lockbox_code:   bp.lockbox_code || '2580',
    decline_reason: bp.decline_reason || 'The vehicle is not available for your selected dates.',
    // Confirm link — drives customer to sign agreement + pay
    confirm_link:   `${siteUrl}/confirm?code=${bp.booking_code || ''}`,
    status_link:    `${siteUrl}/booking-status?code=${bp.booking_code || ''}`,
    // Portal link — drives customer directly to the rental portal for check-in/out
    portal_link:    `${siteUrl}/portal?code=${bp.booking_code || ''}&email=${encodeURIComponent(c.email || '')}`,
    // Payment fields
    amount:         bp.amount || bp.total_cost || '',
    payment_method: bp.payment_method || 'Card',
    payment_date:   formatDate(bp.payment_date || new Date().toISOString()),
    refund_amount:  bp.refund_amount || '',
    // Damage fields
    damage_description: bp.damage_description || '',
    damage_fee:     bp.damage_fee || '',
    damage_type:    bp.damage_type || 'repairs',
    // Deposit fields
    deposit_amount:  bp.deposit_amount ?? '',
    deposit_status:  bp.deposit_status || '',
    incidental_total: bp.incidental_total != null ? String(bp.incidental_total) : '',
    // Mileage fields
    mileage_policy: (() => {
      const ma = bp.mileage_allowance;
      if (ma === 'unlimited') return 'Unlimited mileage included with your weekly rental';
      const days = Number(bp.rental_days) || 1;
      const total = ma ? parseInt(ma, 10) : days * 150;
      const perDay = Math.round(total / days);
      return `${perDay} miles/day (${total} total)`;
    })(),
    checkin_odometer:  bp.checkin_odometer || '',
    checkout_odometer: bp.checkout_odometer || '',
    total_miles:       bp.total_miles || '',
    // Invoice
    invoice_total:     bp.invoice_total || '',
    invoice_link:      bp.invoice_link || '',
    // Add-ons
    unlimited_miles_fee: bp.mileage_addon_fee ? Number(bp.mileage_addon_fee).toFixed(2) : '',
    unlimited_tolls_fee: bp.toll_addon_fee ? Number(bp.toll_addon_fee).toFixed(2) : '',
    addons_text: [
      bp.unlimited_miles ? `Unlimited Miles: $${Number(bp.mileage_addon_fee || 100).toFixed(2)}` : '',
      bp.unlimited_tolls ? `Unlimited Tolls: $${Number(bp.toll_addon_fee || 20).toFixed(2)}` : '',
    ].filter(Boolean).join(', ') || 'None',
    // Review
    review_link:    bp.review_link || brand.reviewLink,
    // F-6: Bonzah insurance lifecycle merge fields. All populated by
    // buildBookingPayload but were never lifted into the merge map — so any
    // template referencing them (insurance_policy_issued, insurance_bind_failed)
    // would render literal `{{bonzah_policy_no}}` text. Same for amount_owed
    // (set by depositService for inspection_charges_scheduled).
    bonzah_policy_no:        bp.bonzah_policy_no || '',
    bonzah_quote_id:         bp.bonzah_quote_id || '',
    bonzah_tier_label:       bp.bonzah_tier_label || '',
    bonzah_premium:          bp.bonzah_premium || '',
    bonzah_total_charged:    bp.bonzah_total_charged || '',
    bonzah_coverage_summary: bp.bonzah_coverage_summary || '',
    dashboard_link:          bp.dashboard_link || '',
    amount_owed:             bp.amount_owed != null ? Number(bp.amount_owed).toFixed(2) : '',
    // Tax amount
    tax_amount:     bp.tax_amount ? Number(bp.tax_amount).toFixed(2) : '',
    // total_charged: prefer the explicit value (includes deposit) set by payment handler,
    // fall back to total_cost (rental-only) for other notification stages
    total_charged:  bp.total_charged || (bp.total_cost ? Number(bp.total_cost).toFixed(2) : ''),
    // ── NEW: Vehicle transparency fields ──────────────────────────
    vehicle_photo_url:      vehiclePhotoUrl,
    vehicle_year_make_model: [v.year, v.make, v.model].filter(Boolean).join(' ') || 'your vehicle',
    vehicle_color:          v.color || '',
    vehicle_plate:          v.license_plate || '',
    vehicle_vin:            v.vin || '',
    // ── NEW: Handoff fields (populated only for ready_for_pickup / pickup_reminder) ──
    handoff_fuel_level:     h.fuel_level || '',
    handoff_odometer:       h.odometer != null ? String(h.odometer) : '',
    // handoff_photos stored as JSON array string — rendered to HTML in getRenderedTemplate
    handoff_photos:         JSON.stringify(h.photos || []),
  };
}

// Fields that contain pre-rendered HTML or URLs — skip HTML escaping
const HTML_SAFE_FIELDS = new Set([
  'handoff_photos', 'vehicle_photo_url', 'vehicle_info_block',
  'confirm_link', 'status_link', 'portal_link', 'review_link', 'invoice_link',
]);

/**
 * Interpolate a template string with merge fields.
 * Supports:
 *   {{key}}                → simple replacement
 *   {{#if key}}...{{/if}}  → conditional block (shown only if key has a truthy value)
 *                            Nested {{#if}} blocks are supported.
 */
export function interpolateTemplate(template, fields, isHtml = false) {
  if (!template) return '';

  // 1. Process conditional blocks from innermost to outermost.
  //    Match {{#if key}}...{{/if}} where content has NO nested {{#if}}.
  //    Loop until a pass produces no change (fixed-point) — F-19 hardening.
  //    Old code used `.test()` with `/g` which advances `lastIndex` between
  //    calls and can falsely return false when matches remain. New approach
  //    compares before/after to detect convergence; supports arbitrarily
  //    deep nesting up to a generous safety cap.
  let result = template;
  const ifPattern = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
  let prev;
  let iters = 0;
  do {
    prev = result;
    result = result.replace(ifPattern, (_match, key, content) => {
      const val = fields[key];
      const isTruthy = val !== undefined && val !== null && val !== '' && val !== '[]' && val !== '""';
      return isTruthy ? content : '';
    });
    if (++iters > 50) break; // never expected — guards pathological input
  } while (result !== prev);

  // 2. Simple field replacement: {{key}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    let val = fields[key] !== undefined && fields[key] !== '' ? String(fields[key]) : match;

    // HTML-escape values in email bodies, except URLs and pre-rendered HTML fields
    if (isHtml && val !== match && !HTML_SAFE_FIELDS.has(key)) {
      val = val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    return val;
  });

  return result;
}

/**
 * Get a rendered template by stage, interpolated with booking data.
 * Returns { subject, body, sms_body, channel } or null if not found/inactive.
 */
export async function getRenderedTemplate(stage, bookingPayload) {
  let template = null;
  let isFallback = false;

  // 1. Try DB template first
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('stage', stage)
    .eq('is_active', true)
    .single();

  if (!error && data) {
    template = data;
  } else if (FALLBACK_TEMPLATES[stage]) {
    // 2. Use hardcoded fallback for critical stages
    console.warn(`[Notify] No DB template for "${stage}" — using hardcoded fallback`);
    template = {
      name: `Fallback: ${stage}`,
      stage,
      ...FALLBACK_TEMPLATES[stage],
      trigger_type: 'automated',
    };
    isFallback = true;
  } else {
    console.log(`[Notify] No active template for stage: ${stage}`);
    return null;
  }

  const fields = buildMergeFields(bookingPayload);

  // Render handoff_photos from JSON array → HTML gallery (rendering layer, not data layer)
  try {
    const photoUrls = JSON.parse(fields.handoff_photos || '[]');
    fields.handoff_photos = renderPhotoGallery(photoUrls);
  } catch {
    fields.handoff_photos = '';
  }

  return {
    name:       template.name,
    stage:      template.stage,
    channel:    template.channel || 'email',
    subject:    interpolateTemplate(template.subject, fields, false),
    body:       interpolateTemplate(template.body, fields, true),
    sms_body:   interpolateTemplate(template.sms_body, fields, false),
    trigger_type: template.trigger_type,
    isFallback,
  };
}

// ── Main Notification Entry Point ───────────────────────────────────────────

/**
 * Build a standardized payload from a fully-joined booking object.
 * @param {object} booking — from getBookingDetail() with vehicles(*), customers(*)
 * @param {object} [options]
 * @param {object} [options.handoffRecord] — latest admin_prep checkin_record (optional)
 */
export function buildBookingPayload(booking, { handoffRecord } = {}) {
  const v = booking.vehicles || {};
  return {
    customer_id: booking.customer_id,
    booking_id: booking.id,
    booking_code: booking.booking_code,
    status: booking.status,
    customer: {
      first_name: booking.customers?.first_name,
      last_name:  booking.customers?.last_name,
      email:      booking.customers?.email,
      phone:      booking.customers?.phone,
    },
    vehicle: {
      year:  v.year,
      make:  v.make,
      model: v.model,
      vehicle_code: v.vehicle_code,
      // Vehicle transparency fields
      color:         v.color || null,
      license_plate: v.license_plate || null,
      vin:           v.vin || null,
      thumbnail_url: v.thumbnail_url || null,
      photo_urls:    v.photo_urls || [],
    },
    // Handoff data — only populated when an admin_prep record is passed in
    handoff: handoffRecord ? {
      fuel_level:   handoffRecord.fuel_level || null,
      odometer:     handoffRecord.odometer || null,
      photos:       handoffRecord.photo_urls || [],
      recorded_at:  handoffRecord.created_at || null,
    } : null,
    pickup_date:     booking.pickup_date,
    return_date:     booking.return_date,
    pickup_time:     booking.pickup_time,
    return_time:     booking.return_time,
    pickup_location: booking.pickup_location,
    total_cost:      booking.total_cost,
    tax_amount:      booking.tax_amount ?? null,
    rental_days:     booking.rental_days,
    // Add-on fields for itemized receipt
    unlimited_miles:   booking.unlimited_miles || false,
    unlimited_tolls:   booking.unlimited_tolls || false,
    mileage_addon_fee: booking.mileage_addon_fee || null,
    toll_addon_fee:    booking.toll_addon_fee || null,
    insurance_provider: booking.insurance_provider,
    // Bonzah-specific merge fields — used by insurance_policy_issued / insurance_bind_failed
    bonzah_policy_no:        booking.bonzah_policy_no || null,
    bonzah_quote_id:         booking.bonzah_quote_id || null,
    bonzah_tier_id:          booking.bonzah_tier_id || null,
    bonzah_tier_label:       booking.bonzah_tier_id
      ? booking.bonzah_tier_id.charAt(0).toUpperCase() + booking.bonzah_tier_id.slice(1)
      : null,
    dashboard_link:          process.env.DASHBOARD_URL && booking.id
      ? `${process.env.DASHBOARD_URL}/bookings/${booking.id}`
      : null,
    bonzah_premium:          booking.bonzah_premium_cents != null
      ? (booking.bonzah_premium_cents / 100).toFixed(2)
      : null,
    bonzah_total_charged:    booking.bonzah_total_charged_cents != null
      ? (booking.bonzah_total_charged_cents / 100).toFixed(2)
      : null,
    bonzah_coverage_summary: Array.isArray(booking.bonzah_coverage_json)
      ? booking.bonzah_coverage_json
          .map(c => c.optional_addon_type || c.optional_addon_code || c.cover_type)
          .filter(Boolean)
          .join(', ')
      : null,
    special_requests:   booking.special_requests,
    decline_reason:     booking.decline_reason,
    // Financial fields (used by deposit/invoice/inspection templates)
    deposit_amount:    booking.deposit_amount ?? null,
    deposit_status:    booking.deposit_status || null,
    refund_amount:     booking.refund_amount ?? null,
    incidental_total:  booking.incidental_total ?? null,
    invoice_total:     booking.invoice_total ?? null,
    invoice_link:      booking.invoice_link || null,
    // Mileage fields
    mileage_allowance: booking.mileage_allowance || null,
    checkin_odometer:  booking.checkin_odometer || null,
    checkout_odometer: booking.checkout_odometer || null,
    total_miles:       booking.total_miles || null,
    // Damage fields
    damage_description: booking.damage_description || null,
    damage_fee:         booking.damage_fee || null,
    damage_type:        booking.damage_type || null,
    // Pricing breakdown — used by itemized email receipt
    daily_rate:        booking.daily_rate ?? null,
    subtotal:          booking.subtotal ?? null,
    discount_amount:   booking.discount_amount ?? null,
    delivery_fee:      booking.delivery_fee ?? null,
    line_items:        booking.line_items || null,
    payments:          booking.payments || null,
  };
}

/** Human-readable summaries for each event (used for local message storage) */
const EVENT_SUMMARIES = {
  booking_submitted:      'New booking request submitted',
  booking_approved:       'Booking approved — awaiting agreement & payment',
  booking_declined:       'Booking request declined',
  booking_cancelled:      'Booking cancelled',
  payment_confirmed:      'Payment received — booking confirmed',
  ready_for_pickup:       'Vehicle ready for pickup',
  pickup_reminder:        'Pickup reminder sent',
  day_of_pickup:          'Day-of-pickup reminder sent',
  return_reminder:        'Return reminder sent',
  return_confirmed:       'Vehicle returned — thank you sent',
  late_return_warning:    'Late return warning sent',
  late_return_escalation: 'Late return escalation (4 days overdue)',
  mid_rental_checkin:     'Mid-rental check-in sent',
  extension_offer:        'Rental extension offer sent',
  repeat_customer:        'Repeat customer loyalty message sent',
  invoice_sent:           'Invoice sent to customer',
  damage_notification:    'Damage report shared with customer',
  day_of_return:          'Day-of-return reminder sent',
  deposit_refunded:       'Security deposit refunded',
  deposit_settled:        'Security deposit settled against incidentals',
  rental_completed:       'Rental completed — review request sent',
  inspection_charges_scheduled: 'Inspection charges scheduled (48h dispute window)',
  insurance_policy_issued:      'Bonzah insurance policy issued',
  insurance_bind_failed:        'Bonzah bind failed — admin reconciliation required',
};

/**
 * Send a booking notification using the template system.
 * Looks up the template for `stage`, renders it, and sends via Resend/Twilio.
 * Fire-and-forget — errors are logged but don't throw.
 *
 * @param {string} stage — template stage (e.g. 'booking_approved')
 * @param {object} bookingPayload — from buildBookingPayload()
 */
export async function sendBookingNotification(stage, bookingPayload) {
  try {
    // F-7 idempotency — skip if (booking_code, stage, today) already logged.
    // Cron retries, manual replays, and Vercel re-invocations would otherwise
    // double-fire reminders. Manual admin sends use sendDirectEmail/SMS and
    // bypass this check by design.
    const bookingCode = bookingPayload.booking_code;
    if (bookingCode) {
      const eventDate = new Date().toISOString().slice(0, 10);
      const { error: dupErr } = await supabase
        .from('notification_log')
        .insert({ booking_code: bookingCode, stage, event_date: eventDate });
      if (dupErr?.code === '23505') {
        console.log(`[Notify] Skipping duplicate "${stage}" for ${bookingCode} on ${eventDate}`);
        return;
      }
      if (dupErr) {
        // Don't block notifications on log-table issues (missing table, RLS, etc.).
        console.warn(`[Notify] notification_log insert failed for "${stage}" / ${bookingCode}: ${dupErr.message}`);
      }
    }

    const rendered = await getRenderedTemplate(stage, bookingPayload);
    if (!rendered) {
      console.log(`[Notify] No active template for "${stage}" — skipping`);
      // Still store a local record
      await storeSystemMessage(stage, bookingPayload);
      return;
    }

    const customer = bookingPayload.customer || {};
    const channel = rendered.channel || 'email';

    // Build merge fields for CTA button URLs
    const mergeFields = buildMergeFields(bookingPayload);
    const ctaHtml = buildCtaHtml(stage, mergeFields);

    // Stage-specific enrichments. Currently `payment_confirmed` (the post-payment
    // receipt) gets the itemized receipt + welcome banner + pickup next-steps card
    // injected above the template body so the email mirrors the customer portal.
    // Other stages are unchanged.
    let prependHtml = '';
    if (stage === 'payment_confirmed') {
      prependHtml =
        renderPrepWelcomeHtml(mergeFields) +
        renderItemizedReceiptHtml(bookingPayload) +
        renderPickupNextStepsHtml(mergeFields);
    }

    // Send email (skip for booking_submitted — emailService.js sends a branded HTML version)
    // Awaited so the dispatch isn't killed by serverless lifecycle when the parent handler returns.
    //
    // ⚠ IMPLICIT CONTRACT (Phase 1 audit F-3):
    // When `stage === 'booking_submitted'`, this function does NOT send an email.
    // The booking-confirmation email is sent by `emailService.sendBookingConfirmation`
    // from `bookingService.createBooking()` instead (it has a richer branded layout).
    // If that call site is ever removed or renamed, customers receive NO email after
    // booking submission. The static test in `tests/booking-submitted-contract.test.js`
    // guards against this regression.
    const skipEmail = stage === 'booking_submitted';
    // Dispatch every channel concurrently so the fastest one (web push) isn't
    // blocked behind Resend/Twilio round-trips. Each task keeps its own
    // try/catch; Promise.allSettled below is a second safety net so one channel
    // can never reject the batch. The whole batch is awaited before this
    // function returns (and awaited at the call site) so the serverless lambda
    // can't freeze mid-send — the historical cause of late/dropped push.
    const dispatchTasks = [];

    if (!skipEmail && (channel === 'email' || channel === 'both') && customer.email) {
      dispatchTasks.push((async () => {
      try {
        await sendEmail({
          to: customer.email,
          subject: rendered.subject,
          html: wrapInBrandedHTML(rendered.subject, rendered.body, ctaHtml, prependHtml),
        });
      } catch (e) {
        console.error(`[Notify] Email send error for "${stage}":`, e.message);
      }
      })());
    }

    // Send SMS
    if ((channel === 'sms' || channel === 'both') && customer.phone && rendered.sms_body) {
      dispatchTasks.push((async () => {
      try {
        await sendSMS({
          to: customer.phone,
          body: rendered.sms_body,
        });
      } catch (e) {
        console.error(`[Notify] SMS send error for "${stage}":`, e.message);
      }
      })());
    }

    // Sprint 12c: Web Push fan-out — non-blocking, additive to email/SMS.
    //
    // Push complements (does NOT replace) the existing dispatch. Customers who
    // opted in via the PushOptInCard (Sprint 12b) get an instant browser
    // notification alongside their email/SMS. Customers without a subscription,
    // or installations on browsers without push support, see zero impact —
    // pushService.sendToCustomer returns { sent: 0, ... } as a no-op.
    //
    // Body strategy: reuse rendered.sms_body since it's already terse and
    // customer-facing. Falls back to subject, then to a generic line so the
    // notification never displays an empty body.
    //
    // Idempotency: covered upstream by the notification_log F-7 check at the
    // top of this function (line ~601). If we got here, this is the only
    // dispatch attempt for (booking, stage, day).
    //
    // Failure isolation: wrapped in its own try/catch so a push failure
    // (network, bad VAPID config, etc.) never affects the email/SMS path
    // already completed above OR the storeSystemMessage call below.
    if (bookingPayload.customer_id) {
      dispatchTasks.push((async () => {
      try {
        const pushBody =
          rendered.sms_body ||
          rendered.subject ||
          (EVENT_SUMMARIES[stage] || 'You have a new update.');
        const bookingCodeForUrl = bookingPayload.booking_code
          ? `?code=${encodeURIComponent(bookingPayload.booking_code)}`
          : '';
        await sendPushToCustomer(bookingPayload.customer_id, {
          title: brand.name,
          body: pushBody,
          url: `/portal${bookingCodeForUrl}`,
          data: {
            stage,
            booking_code: bookingPayload.booking_code || null,
            // SW uses tag for grouping — one per booking so a follow-up
            // push for the same booking replaces the older one instead of
            // stacking. Falls back to stage if no booking code.
            tag: bookingPayload.booking_code
              ? `booking-${bookingPayload.booking_code}`
              : `stage-${stage}`,
          },
        });
      } catch (e) {
        console.error(`[Notify] Push send error for "${stage}":`, e.message);
      }
      })());
    }

    /* Sprint 18: Admin push fan-out — only for stages in ADMIN_PUSH_STAGES.
     * Failure-isolated so admin push errors never affect the customer dispatch
     * paths above or the storeSystemMessage call below. */
    if (ADMIN_PUSH_STAGES.has(stage)) {
      dispatchTasks.push((async () => {
      try {
        const customerName = [bookingPayload.customer?.first_name, bookingPayload.customer?.last_name]
          .filter(Boolean).join(' ') || 'a customer';
        const bookingCode = bookingPayload.booking_code || '';
        const adminBody = `${ADMIN_PUSH_SUMMARIES[stage]} — ${customerName}${bookingCode ? ` (${bookingCode})` : ''}`;
        const url = bookingPayload.booking_id
          ? `/bookings/${bookingPayload.booking_id}`
          : '/bookings';
        await sendPushToAllAdmins({
          title: `${brand.name} Dashboard`,
          body: adminBody,
          url,
          data: {
            stage,
            booking_id: bookingPayload.booking_id || null,
            booking_code: bookingCode || null,
            tag: bookingCode ? `admin-booking-${bookingCode}` : `admin-stage-${stage}`,
          },
        });
      } catch (e) {
        console.error(`[Notify] Admin push send error for "${stage}":`, e.message);
      }
      })());
    }

    // Wait for every channel to finish before returning so the serverless
    // lambda isn't frozen mid-dispatch. Promise.allSettled never rejects.
    await Promise.allSettled(dispatchTasks);

    // Store local copy in messages table
    await storeSystemMessage(stage, bookingPayload);

    console.log(`[Notify] Sent "${stage}" to ${customer.email || customer.phone} via ${channel}`);
  } catch (err) {
    console.error(`[Notify] sendBookingNotification("${stage}") failed:`, err.message);
  }
}

/**
 * Store a system-generated message in the local messages table.
 * This ensures all automated notifications appear in the messaging portal.
 */
async function storeSystemMessage(stage, bookingPayload) {
  const customerId = bookingPayload.customer_id;
  if (!customerId) return;

  const summary = EVENT_SUMMARIES[stage] || `Notification: ${stage}`;
  const bookingCode = bookingPayload.booking_code || '';
  const body = bookingCode
    ? `[Auto] ${summary} — ${bookingCode}`
    : `[Auto] ${summary}`;

  await storeLocalMessage({
    customerId,
    direction: 'outbound',
    channel: 'system',
    subject: summary,
    body,
    externalId: `notify-${stage}-${bookingCode}-${Date.now()}`,
    metadata: { stage, automated: true, booking_code: bookingCode },
  });
}

// ── Itemized Receipt Renderer ───────────────────────────────────────────────
// Mirrors the customer-portal "Itemized receipt" block (CustomerPortal.tsx) so
// the confirmation email shows the same totals and ordering. Single source of
// truth: booking row pricing fields (daily_rate, subtotal, addon fees,
// discount, tax, total_cost) plus payments[].

function fmtMoney(n) { return `$${Number(n || 0).toFixed(2)}`; }

function renderReceiptRow(label, value, opts = {}) {
  const color = opts.green ? '#15803d' : opts.bold ? '#1c1917' : '#44403c';
  const fontWeight = opts.bold ? '600' : '400';
  // Use table-row markup — Outlook & most email clients render flex
  // inconsistently, but table cells are 100% reliable.
  const padTop = opts.divider ? '10px' : '4px';
  const borderTop = opts.divider ? 'border-top:1px solid #e7e5e4;' : '';
  return `<tr>
    <td style="padding:${padTop} 0 4px;color:${color};font-size:13px;font-weight:${fontWeight};${borderTop}">${escapeHtml(label)}</td>
    <td style="padding:${padTop} 0 4px;color:${color};font-size:13px;font-weight:${fontWeight};text-align:right;font-variant-numeric:tabular-nums;${borderTop}">${escapeHtml(value)}</td>
  </tr>`;
}

function renderItemizedReceiptHtml(bp) {
  if (!bp) return '';
  const days = Number(bp.rental_days) || 0;
  const dailyRate = Number(bp.daily_rate) || 0;
  const subtotal = Number(bp.subtotal) || 0;
  const tax = Number(bp.tax_amount) || 0;
  const total = Number(bp.total_cost) || 0;
  const deposit = Number(bp.deposit_amount) || 0;
  const delivery = Number(bp.delivery_fee) || 0;
  const mileageFee = Number(bp.mileage_addon_fee) || 0;
  const tollFee = Number(bp.toll_addon_fee) || 0;
  const discount = Number(bp.discount_amount) || 0;
  const payments = Array.isArray(bp.payments) ? bp.payments : [];
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const rows = [];
  if (days > 0 && dailyRate > 0) {
    rows.push(renderReceiptRow(`${fmtMoney(dailyRate)}/day × ${days} day${days !== 1 ? 's' : ''}`, fmtMoney(subtotal)));
  } else if (subtotal > 0) {
    rows.push(renderReceiptRow('Rental subtotal', fmtMoney(subtotal)));
  }
  if (delivery > 0) rows.push(renderReceiptRow('Delivery fee', fmtMoney(delivery)));
  if (mileageFee > 0) rows.push(renderReceiptRow('Unlimited miles add-on', fmtMoney(mileageFee)));
  if (tollFee > 0) rows.push(renderReceiptRow('Unlimited tolls add-on', fmtMoney(tollFee)));
  if (discount > 0) rows.push(renderReceiptRow('Discount', `-${fmtMoney(discount)}`, { green: true }));
  if (tax > 0) rows.push(renderReceiptRow('FL sales tax', fmtMoney(tax)));
  rows.push(renderReceiptRow('Rental total', fmtMoney(total), { bold: true, divider: true }));

  const depositBlock = deposit > 0
    ? `<tr><td colspan="2" style="padding:14px 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#a8a29e;">Security Deposit</td></tr>
       ${renderReceiptRow('Refundable hold', fmtMoney(deposit))}
       <tr><td colspan="2" style="padding:4px 0 0;font-size:11px;color:#a8a29e;">Returned 3–5 business days after vehicle inspection.</td></tr>`
    : '';

  const totalChargedBlock = totalPaid > 0
    ? renderReceiptRow('Total charged', fmtMoney(totalPaid), { bold: true, divider: true })
    : '';

  return `
    <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:18px 20px;margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#a8a29e;">Itemized Receipt</p>
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#a8a29e;">Rental Charges</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${rows.join('')}
        ${depositBlock}
        ${totalChargedBlock}
      </table>
    </div>`;
}

function renderPrepWelcomeHtml(mergeFields) {
  const pickup = escapeHtml(mergeFields.pickup_location || 'our pickup location');
  return `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin:0 0 22px;">
      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
        You'll receive a confirmation when your ride is cleaned, prepped, and ready to pick up at <strong>${pickup}</strong>.
      </p>
    </div>`;
}

function renderPickupNextStepsHtml(mergeFields) {
  const portalLink = mergeFields.portal_link;
  const pickup = escapeHtml(mergeFields.pickup_location || 'the pickup location');
  return `
    <div style="border:1px solid #e7e5e4;border-radius:12px;padding:18px 20px;margin:0 0 24px;background:#ffffff;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#a8a29e;">Pickup Next Steps</p>
      <p style="margin:0 0 10px;font-size:14px;color:#1c1917;font-weight:600;">${pickup}</p>
      <ol style="margin:0 0 12px 18px;padding:0;color:#44403c;font-size:13px;line-height:1.7;">
        <li>We'll text you when your vehicle is cleaned, prepped, and ready.</li>
        <li>Open your customer portal to review the pickup instructions.</li>
        <li>Tap <em>Start your rental</em> in the portal to receive your lockbox code.</li>
      </ol>
      ${portalLink ? `<a href="${portalLink}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37 0%,#B8941E 100%);color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">Open My Portal →</a>` : ''}
    </div>`;
}

// ── Branded HTML Email Wrapper ──────────────────────────────────────────────

/**
 * Wraps plain-text template content in the Annie's Car Rental branded
 * email design (matching the hardcoded booking confirmation email).
 * Converts line breaks to HTML, preserves unicode emoji.
 *
 * `prependHtml` (optional) is inserted above the rendered body — used by
 * stage-specific enrichments (e.g. itemized receipt for `payment_confirmed`).
 *
 * Exported so the dashboard preview endpoint can render previews through the
 * exact same code path as real customer-facing sends. Keeping the preview and
 * the real send on the same renderer is what makes "what you see in preview
 * is what the customer gets" a guarantee instead of a hope.
 */
export function wrapInBrandedHTML(subject, plainTextBody, ctaHtml = '', prependHtml = '') {
  // ── Convert mixed plain-text + HTML body to safe email HTML ──
  //
  // Templates contain a mix of plain text (paragraphs, bullet points)
  // and inline HTML (<img>, <table> for photo galleries, <a> links).
  // We need to:
  //   1. Extract and preserve existing HTML blocks
  //   2. Convert remaining plain text to paragraphs with <br>
  //   3. Auto-link bare URLs (only in plain text, not inside HTML)
  //   4. Reassemble
  //
  // F-8: chrome rendering delegated to renderBrandedShell (utils/emailShell.js).

  const raw = plainTextBody || '';

  // Extract HTML blocks: <img .../>, <table>...</table>, <a>...</a>
  // Replace them with unique placeholders so they survive text processing
  const htmlBlocks = [];
  const withPlaceholders = raw.replace(
    /<(img\b[^>]*\/?>|table[\s\S]*?<\/table>|a\b[^>]*>[\s\S]*?<\/a>)/gi,
    (match) => {
      const idx = htmlBlocks.length;
      htmlBlocks.push(match);
      return `\x00HTML_BLOCK_${idx}\x00`;
    }
  );

  // Convert plain text to HTML paragraphs
  const bodyHtml = withPlaceholders
    .split(/\n\n+/)
    .map(para => {
      let inner = para.trim();
      if (!inner) return '';

      // Convert single line breaks to <br> (but not inside placeholders)
      inner = inner.replace(/\n/g, '<br>');

      // Auto-link bare URLs (only those NOT inside a placeholder)
      inner = inner.replace(
        /(https?:\/\/[^\s<\x00]+)/g,
        '<a href="$1" style="color:#c8a97e;text-decoration:underline;">$1</a>'
      );

      return `<p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">${inner}</p>`;
    })
    .join('');

  // Restore HTML blocks from placeholders
  const finalBody = bodyHtml.replace(
    /\x00HTML_BLOCK_(\d+)\x00/g,
    (_match, idx) => htmlBlocks[Number(idx)]
  );

  return renderBrandedShell(subject, `${prependHtml}\n      ${finalBody}\n      ${ctaHtml}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Render an array of photo URLs into inline HTML <img> tags for email.
 * Called in getRenderedTemplate (rendering layer), not in buildMergeFields (data layer).
 */
function renderPhotoGallery(urls) {
  if (!urls || urls.length === 0) return '';
  const cells = urls.map(url =>
    '<td style="padding:4px;"><img src="' + escapeHtml(url) + '" alt="Vehicle photo" style="width:100%;max-width:240px;border-radius:8px;border:1px solid #e7e5e4;" /></td>'
  ).join('');
  return '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>' + cells + '</tr></table>';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return dateStr; }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  try {
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    return timeStr;
  } catch { return timeStr; }
}
