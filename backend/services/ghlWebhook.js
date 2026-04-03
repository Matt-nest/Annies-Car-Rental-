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
