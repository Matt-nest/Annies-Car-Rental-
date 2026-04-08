/**
 * Outbound Messaging Service — Resend (email) + Twilio (SMS)
 *
 * Replaces GoHighLevel webhooks with direct API calls.
 * No npm packages needed — uses fetch() for both APIs.
 *
 * Required env vars:
 *   RESEND_API_KEY          — from resend.com
 *   TWILIO_ACCOUNT_SID      — from twilio.com/console
 *   TWILIO_AUTH_TOKEN        — from twilio.com/console
 *   TWILIO_PHONE_NUMBER     — your Twilio number e.g. +17725551234
 *
 * Optional:
 *   EMAIL_FROM              — default: Annie's Car Rental <noreply@anniescarrental.com>
 *   OWNER_EMAIL             — for admin notifications
 *   OWNER_PHONE             — for admin SMS alerts
 */

import { supabase } from '../db/supabase.js';
import { storeLocalMessage } from './messagingService.js';

// ── Config ──────────────────────────────────────────────────────────────────

const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const TWILIO_SID        = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN      = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM       = process.env.TWILIO_PHONE_NUMBER;

const FROM_EMAIL = process.env.EMAIL_FROM || "Annie's Car Rental <noreply@anniescarrental.com>";
const SITE_URL   = process.env.SITE_URL || 'https://anniescarrental.com';

// ── Low-level Senders ───────────────────────────────────────────────────────

/**
 * Send an email via Resend REST API.
 * Returns { id } on success, { error } on failure.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.log(`[Email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }

  try {
    const payload = { from: FROM_EMAIL, to, subject };
    if (html) payload.html = html;
    else if (text) payload.text = text;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Email] Resend error for ${to}:`, err);
      return { error: err };
    }

    const data = await res.json();
    console.log(`[Email] Sent "${subject}" to ${to} — id: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { error: err.message };
  }
}

/**
 * Send an SMS via Twilio REST API (no npm package).
 * Returns { sid } on success, { error } on failure.
 */
export async function sendSMS({ to, body }) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log(`[SMS] Twilio not configured — skipping SMS to ${to}`);
    return { skipped: true };
  }

  // Clean up phone number — ensure it starts with +1 for US
  let phone = to.replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  if (!phone.startsWith('+')) phone = '+' + phone;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', TWILIO_FROM);
    params.append('To', phone);
    params.append('Body', body);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[SMS] Twilio error for ${phone}:`, data.message || data);
      return { error: data.message || data };
    }

    console.log(`[SMS] Sent to ${phone} — sid: ${data.sid}`);
    return data;
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ── Template System ─────────────────────────────────────────────────────────

/**
 * Build a flat merge-field map from a booking payload.
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
    amount:         bp.amount || bp.total_cost || '',
    payment_method: bp.payment_method || 'Card',
    payment_date:   formatDate(bp.payment_date || new Date().toISOString()),
    refund_amount:  bp.refund_amount || '',
    damage_description: bp.damage_description || '',
    damage_fee:     bp.damage_fee || '',
    damage_type:    bp.damage_type || 'repairs',
    review_link:    bp.review_link || 'https://g.page/annies-car-rental/review',
    status_url:     `${SITE_URL}/booking-status?code=${bp.booking_code || ''}`,
    confirm_url:    `${SITE_URL}/confirm?code=${bp.booking_code || ''}`,
  };
}

/**
 * Interpolate a template string: replaces {{key}} with values.
 */
export function interpolateTemplate(template, fields) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return fields[key] !== undefined && fields[key] !== '' ? fields[key] : match;
  });
}

/**
 * Get a rendered template by stage from the email_templates table.
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

// ── Booking Payload Builder ─────────────────────────────────────────────────

/**
 * Build a standardized payload from a fully-joined booking object.
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

// ── High-Level Notification Dispatch ────────────────────────────────────────

/** Human-readable summaries for each event */
const EVENT_SUMMARIES = {
  'booking.created':          'New booking request submitted',
  'booking.approved':         'Booking approved — awaiting agreement & payment',
  'booking.declined':         'Booking request declined',
  'booking.cancelled':        'Booking cancelled',
  'booking.pickup_reminder':  'Pickup reminder',
  'booking.return_reminder':  'Return reminder',
  'booking.overdue':          'Vehicle return is overdue',
  'booking.completed':        'Rental completed — thank you!',
  'booking.approval_reminder':'Owner reminder — pending booking needs approval',
};

/** Map events to template stages in email_templates table */
const EVENT_TO_STAGE = {
  'booking.created':          'booking_created',
  'booking.approved':         'booking_approved',
  'booking.declined':         'booking_declined',
  'booking.cancelled':        'booking_cancelled',
  'booking.pickup_reminder':  'pickup_reminder',
  'booking.return_reminder':  'return_reminder',
  'booking.overdue':          'overdue_return',
  'booking.completed':        'rental_completed',
  'booking.approval_reminder':'approval_reminder',
};

/**
 * Send a notification for a booking event.
 * Looks up the template, sends email + SMS, stores locally.
 *
 * This is the main function that replaces fireGHLWebhook().
 */
export async function sendNotification(event, bookingPayload) {
  const customerId = bookingPayload.customer_id;
  const customer   = bookingPayload.customer || {};
  const summary    = EVENT_SUMMARIES[event] || `Notification: ${event}`;
  const bookingCode = bookingPayload.booking_code || '';

  console.log(`[Notify] ${event} — ${bookingCode} — ${customer.email || customer.phone || 'unknown'}`);

  // 1. Try to find a template for this event
  const stage = EVENT_TO_STAGE[event];
  let template = null;
  if (stage) {
    template = await getRenderedTemplate(stage, bookingPayload).catch(() => null);
  }

  // 2. Send email (if customer has email)
  if (customer.email) {
    const emailSubject = template?.subject || `Annie's Car Rental — ${summary}`;
    const emailBody    = template?.body || buildFallbackEmailHTML(summary, bookingPayload);

    const emailResult = await sendEmail({
      to: customer.email,
      subject: emailSubject,
      html: emailBody,
    });

    // Store email record locally
    if (customerId) {
      await storeLocalMessage({
        customerId,
        direction: 'outbound',
        channel: 'email',
        subject: emailSubject,
        body: `[Auto] ${summary}${bookingCode ? ` — ${bookingCode}` : ''}`,
        externalId: `email-${event}-${bookingCode}-${Date.now()}`,
        metadata: { event, automated: true, booking_code: bookingCode, email_id: emailResult?.id },
      }).catch(e => console.error('[Notify] Failed to store email message:', e.message));
    }
  }

  // 3. Send SMS (if customer has phone and template has sms_body)
  if (customer.phone) {
    const smsBody = template?.sms_body || `Annie's Car Rental: ${summary}. Booking ${bookingCode}`;

    if (smsBody && smsBody.trim()) {
      const smsResult = await sendSMS({
        to: customer.phone,
        body: smsBody,
      });

      // Store SMS record locally
      if (customerId) {
        await storeLocalMessage({
          customerId,
          direction: 'outbound',
          channel: 'sms',
          subject: null,
          body: `[Auto SMS] ${smsBody.slice(0, 100)}`,
          externalId: `sms-${event}-${bookingCode}-${Date.now()}`,
          metadata: { event, automated: true, booking_code: bookingCode, twilio_sid: smsResult?.sid },
        }).catch(e => console.error('[Notify] Failed to store SMS message:', e.message));
      }
    }
  }

  // 4. Log webhook-style failure record if both fail
  // (helpful for the webhook_failures dashboard page)
  if (!customer.email && !customer.phone) {
    console.warn(`[Notify] No contact info for event ${event} — booking ${bookingCode}`);
    await supabase.from('webhook_failures').insert({
      event,
      payload: bookingPayload,
      error: 'No customer email or phone available',
    }).catch(() => {});
  }
}

/**
 * Send a manual message from the dashboard (email or SMS).
 * Used by the messaging portal "Send" button.
 */
export async function sendManualMessage({ customerId, channel, to, subject, body, html }) {
  let result;

  if (channel === 'sms') {
    result = await sendSMS({ to, body });
  } else {
    result = await sendEmail({
      to,
      subject: subject || 'Message from Annie\'s Car Rental',
      html: html || body,
    });
  }

  // Store locally
  await storeLocalMessage({
    customerId,
    direction: 'outbound',
    channel,
    subject,
    body,
    externalId: result?.sid || result?.id || null,
    metadata: { manual: true },
  });

  return result;
}

// ── Fallback Email Template ─────────────────────────────────────────────────

function buildFallbackEmailHTML(summary, payload) {
  const c = payload.customer || {};
  const bookingCode = payload.booking_code || '';
  const statusUrl = `${SITE_URL}/booking-status?code=${bookingCode}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">
    <div style="background:#1c1917;padding:28px 32px;">
      <p style="margin:0;color:#d6d3d1;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Annie's Car Rental</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">${summary}</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#44403c;font-size:15px;">Hi ${c.first_name || 'there'},</p>
      <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.6;">
        ${summary}${bookingCode ? ` — Reference: <strong>${bookingCode}</strong>` : ''}.
      </p>
      ${bookingCode ? `
      <a href="${statusUrl}" style="display:block;text-align:center;background:#1c1917;color:#fff;font-size:14px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px;">
        Check Booking Status
      </a>` : ''}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;">
      <p style="margin:0;font-size:12px;color:#a8a29e;text-align:center;">
        Annie's Car Rental · Port St. Lucie, FL · (772) 985-6667
      </p>
    </div>
  </div>
</body>
</html>`.trim();
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
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    return timeStr;
  } catch { return timeStr; }
}
