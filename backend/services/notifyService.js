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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "Annie's Car Rental <noreply@anniescarrental.com>";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// ── Core Send Functions ─────────────────────────────────────────────────────

/**
 * Send an email via Resend REST API.
 * Returns { id } on success or { error } on failure.
 */
export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[Notify] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }
  if (!to) {
    console.warn('[Notify] No email address provided — skipping');
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Notify] Resend error for ${to}:`, err);
      return { error: err };
    }

    const data = await res.json();
    console.log(`[Notify] Email sent "${subject}" → ${to} (id: ${data.id})`);
    return data;
  } catch (err) {
    console.error(`[Notify] Email failed to ${to}:`, err.message);
    return { error: err.message };
  }
}

/**
 * Send an SMS via Twilio REST API (no SDK needed).
 * Returns { sid } on success or { error } on failure.
 */
export async function sendSMS({ to, body }) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[Notify] Twilio not configured — skipping SMS to ${to}`);
    return { skipped: true };
  }
  if (!to) {
    console.warn('[Notify] No phone number provided — skipping SMS');
    return { skipped: true };
  }

  // Normalize phone number — ensure it starts with +1 for US
  let normalized = to.replace(/\D/g, '');
  if (normalized.length === 10) normalized = '1' + normalized;
  if (!normalized.startsWith('+')) normalized = '+' + normalized;

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

  return {
    first_name:     c.first_name || 'Guest',
    last_name:      c.last_name || '',
    email:          c.email || '',
    phone:          c.phone || '',
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
    // Payment fields
    amount:         bp.amount || bp.total_cost || '',
    payment_method: bp.payment_method || 'Card',
    payment_date:   formatDate(bp.payment_date || new Date().toISOString()),
    refund_amount:  bp.refund_amount || '',
    // Damage fields
    damage_description: bp.damage_description || '',
    damage_fee:     bp.damage_fee || '',
    damage_type:    bp.damage_type || 'repairs',
    // Review
    review_link:    bp.review_link || 'https://g.page/annies-car-rental/review',
  };
}

/**
 * Interpolate a template string with merge fields.
 * Replaces all {{key}} placeholders with values from the fields map.
 */
export function interpolateTemplate(template, fields) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return fields[key] !== undefined && fields[key] !== '' ? fields[key] : match;
  });
}

/**
 * Get a rendered template by stage, interpolated with booking data.
 * Returns { subject, body, sms_body, channel } or null if not found/inactive.
 */
export async function getRenderedTemplate(stage, bookingPayload) {
  const { data: template, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('stage', stage)
    .eq('is_active', true)
    .single();

  if (error || !template) {
    console.log(`[Notify] No active template for stage: ${stage}`);
    return null;
  }

  const fields = buildMergeFields(bookingPayload);

  return {
    name:       template.name,
    stage:      template.stage,
    channel:    template.channel || 'email',
    subject:    interpolateTemplate(template.subject, fields),
    body:       interpolateTemplate(template.body, fields),
    sms_body:   interpolateTemplate(template.sms_body, fields),
    trigger_type: template.trigger_type,
  };
}

// ── Main Notification Entry Point ───────────────────────────────────────────

/**
 * Build a standardized payload from a fully-joined booking object.
 * (Same shape as the old buildBookingPayload.)
 */
export function buildBookingPayload(booking) {
  return {
    customer_id: booking.customer_id,
    booking_code: booking.booking_code,
    status: booking.status,
    customer: {
      first_name: booking.customers?.first_name,
      last_name:  booking.customers?.last_name,
      email:      booking.customers?.email,
      phone:      booking.customers?.phone,
    },
    vehicle: {
      year:  booking.vehicles?.year,
      make:  booking.vehicles?.make,
      model: booking.vehicles?.model,
      vehicle_code: booking.vehicles?.vehicle_code,
    },
    pickup_date:     booking.pickup_date,
    return_date:     booking.return_date,
    pickup_time:     booking.pickup_time,
    return_time:     booking.return_time,
    pickup_location: booking.pickup_location,
    total_cost:      booking.total_cost,
    rental_days:     booking.rental_days,
    insurance_provider: booking.insurance_provider,
    special_requests:   booking.special_requests,
    decline_reason:     booking.decline_reason,
  };
}

/** Human-readable summaries for each event (used for local message storage) */
const EVENT_SUMMARIES = {
  booking_submitted:      'New booking request submitted',
  booking_approved:       'Booking approved — awaiting agreement & payment',
  booking_declined:       'Booking request declined',
  booking_cancelled:      'Booking cancelled',
  pickup_reminder:        'Pickup reminder sent',
  return_reminder:        'Return reminder sent',
  late_return_warning:    'Late return warning',
  rental_completed:       'Rental completed — review request sent',
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
    const rendered = await getRenderedTemplate(stage, bookingPayload);
    if (!rendered) {
      console.log(`[Notify] No active template for "${stage}" — skipping`);
      // Still store a local record
      await storeSystemMessage(stage, bookingPayload);
      return;
    }

    const customer = bookingPayload.customer || {};
    const channel = rendered.channel || 'email';

    // Send email
    if ((channel === 'email' || channel === 'both') && customer.email) {
      sendEmail({
        to: customer.email,
        subject: rendered.subject,
        html: rendered.body,
      }).catch(e => console.error('[Notify] Email fire-and-forget error:', e.message));
    }

    // Send SMS
    if ((channel === 'sms' || channel === 'both') && customer.phone && rendered.sms_body) {
      sendSMS({
        to: customer.phone,
        body: rendered.sms_body,
      }).catch(e => console.error('[Notify] SMS fire-and-forget error:', e.message));
    }

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

// ── Helpers ─────────────────────────────────────────────────────────────────

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
