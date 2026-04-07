import 'dotenv/config';
import { supabase } from '../db/supabase.js';

const GHL_WEBHOOKS = {
  'booking.created':          process.env.GHL_WEBHOOK_BOOKING_CREATED,
  'booking.approved':         process.env.GHL_WEBHOOK_BOOKING_APPROVED,
  'booking.declined':         process.env.GHL_WEBHOOK_BOOKING_DECLINED,
  'booking.cancelled':        process.env.GHL_WEBHOOK_BOOKING_CANCELLED,
  'booking.pickup_reminder':  process.env.GHL_WEBHOOK_PICKUP_REMINDER,
  'booking.return_reminder':  process.env.GHL_WEBHOOK_RETURN_REMINDER,
  'booking.completed':        process.env.GHL_WEBHOOK_COMPLETED,
};

/**
 * Fire a webhook to GHL. Fire-and-forget — failures are logged but don't
 * block the calling flow.
 */
export async function fireGHLWebhook(event, data) {
  const url = GHL_WEBHOOKS[event];
  if (!url || url.includes('...')) {
    console.log(`[GHL] Webhook not configured for event: ${event}`);
    return;
  }

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`GHL returned HTTP ${res.status}`);
    }

    console.log(`[GHL] Fired ${event} — OK`);
  } catch (err) {
    console.error(`[GHL] Webhook failed [${event}]:`, err.message);

    // Log failure to Supabase for retry/inspection
    await supabase.from('webhook_failures').insert({
      event,
      payload,
      error: err.message,
    }).then(({ error }) => {
      if (error) console.error('[GHL] Could not log webhook failure:', error.message);
    });
  }
}

/**
 * Build a standardized GHL payload from a fully-joined booking object.
 */
export function buildBookingPayload(booking) {
  return {
    booking_code: booking.booking_code,
    status: booking.status,
    customer: {
      first_name: booking.customers?.first_name,
      last_name:  booking.customers?.last_name,
      email:      booking.customers?.email,
      phone:      booking.customers?.phone,
      ghl_contact_id: booking.customers?.ghl_contact_id,
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
  };
}

// ── Template Interpolation ──────────────────────────────────────────────────

/**
 * Build a flat merge-field map from a booking payload.
 * This converts nested booking data into flat {{key}} → value pairs.
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
 * Returns { subject, body, sms_body, channel } or null if not found.
 */
export async function getRenderedTemplate(stage, bookingPayload) {
  const { data: template, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('stage', stage)
    .eq('is_active', true)
    .single();

  if (error || !template) {
    console.log(`[Templates] No template found for stage: ${stage}`);
    return null;
  }

  const fields = buildMergeFields(bookingPayload);

  return {
    name:     template.name,
    stage:    template.stage,
    channel:  template.channel || 'email',
    subject:  interpolateTemplate(template.subject, fields),
    body:     interpolateTemplate(template.body, fields),
    sms_body: interpolateTemplate(template.sms_body, fields),
    trigger_type: template.trigger_type,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    // Handle HH:MM format
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    return timeStr;
  } catch { return timeStr; }
}

