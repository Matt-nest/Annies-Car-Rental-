/**
 * cardOnFileService — Stripe Customer creation, payment-method persistence,
 * scheduled-charge enqueueing, and 48h cron dispatch.
 *
 * All behavior is gated by env var `FEATURE_AUTO_OVERAGE_CHARGES=true`. With
 * the flag off, every export below is a no-op (returns null/empty) so the
 * existing booking flow is unaffected.
 */

import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';

const stripe = getStripe();

export const FEATURE_AUTO_OVERAGE_CHARGES =
  String(process.env.FEATURE_AUTO_OVERAGE_CHARGES || '').toLowerCase() === 'true';

/** 48-hour dispute window before a scheduled overage charge fires. */
export const OVERAGE_DELAY_MS = 48 * 60 * 60 * 1000;

/**
 * Idempotently get-or-create a Stripe Customer for the given customer row.
 * Persists the resulting customer.id to `customers.stripe_customer_id` for
 * subsequent off-session charges.
 */
export async function ensureStripeCustomer(customer) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return null;
  if (!customer?.id) return null;

  if (customer.stripe_customer_id) return customer.stripe_customer_id;

  const stripeCustomer = await stripe.customers.create({
    email: customer.email || undefined,
    name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || undefined,
    phone: customer.phone || undefined,
    metadata: { internal_customer_id: customer.id },
  });

  await supabase
    .from('customers')
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq('id', customer.id);

  return stripeCustomer.id;
}

/**
 * Persist the payment_method used on a succeeded PI to the booking row so the
 * inspection-finalize step can charge it later off-session.
 */
export async function savePaymentMethodFromIntent(pi, bookingId) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return;
  if (!pi?.payment_method || !bookingId) return;
  try {
    const pm = typeof pi.payment_method === 'string'
      ? await stripe.paymentMethods.retrieve(pi.payment_method)
      : pi.payment_method;
    await supabase
      .from('bookings')
      .update({
        stripe_payment_method_id: pm.id,
        card_brand: pm.card?.brand || null,
        card_last4: pm.card?.last4 || null,
      })
      .eq('id', bookingId);
  } catch (err) {
    console.warn('[cardOnFile] savePaymentMethod failed:', err.message);
  }
}

/**
 * Schedule an overage charge to fire after the dispute window closes.
 * Returns the inserted row id, or null if the feature flag is off / no card
 * is on file (caller falls back to the manual collection flow).
 */
export async function scheduleOverageCharge({
  bookingId,
  amountCents,
  description,
  lineItems = [],
  delayMs = OVERAGE_DELAY_MS,
}) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return null;
  if (!bookingId || !amountCents || amountCents <= 0) return null;

  // Verify a card is on file before scheduling; otherwise the cron will fail.
  const { data: booking } = await supabase
    .from('bookings')
    .select('stripe_payment_method_id')
    .eq('id', bookingId)
    .single();

  if (!booking?.stripe_payment_method_id) return null;

  const scheduledFor = new Date(Date.now() + delayMs).toISOString();
  const { data, error } = await supabase
    .from('pending_overage_charges')
    .insert({
      booking_id: bookingId,
      amount_cents: amountCents,
      description,
      line_items: lineItems,
      scheduled_for: scheduledFor,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[cardOnFile] schedule failed:', error.message);
    return null;
  }

  await logChargeEvent(data.id, 'created', { amount_cents: amountCents, scheduled_for: scheduledFor }, 'system');
  return data.id;
}

/**
 * Process pending overage charges whose dispute window has closed.
 * Called from the cron route. Returns a summary for logging/observability.
 */
export async function processDueOverageCharges() {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return { skipped: true, reason: 'feature_flag_off' };

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('pending_overage_charges')
    .select('id, booking_id, amount_cents, description, line_items')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .limit(50);

  if (error) {
    console.error('[cardOnFile] processDue query failed:', error.message);
    return { error: error.message };
  }
  if (!due || due.length === 0) return { processed: 0 };

  const results = [];
  for (const charge of due) {
    results.push(await processSingleCharge(charge));
  }
  return { processed: results.length, results };
}

async function processSingleCharge(charge) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, stripe_payment_method_id, customers(stripe_customer_id, email)')
    .eq('id', charge.booking_id)
    .single();

  if (!booking?.stripe_payment_method_id || !booking.customers?.stripe_customer_id) {
    await markFailed(charge.id, 'missing_payment_method');
    return { id: charge.id, status: 'failed', reason: 'missing_payment_method' };
  }

  // Mark processing first to prevent double-fire if the cron overlaps.
  const { error: claimErr } = await supabase
    .from('pending_overage_charges')
    .update({ status: 'processing' })
    .eq('id', charge.id)
    .eq('status', 'pending');
  if (claimErr) return { id: charge.id, status: 'skipped', reason: 'claim_failed' };

  try {
    const pi = await stripe.paymentIntents.create({
      amount: charge.amount_cents,
      currency: 'usd',
      customer: booking.customers.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `Annie's — ${booking.booking_code} overage: ${charge.description}`,
      metadata: {
        booking_id: booking.id,
        booking_code: booking.booking_code,
        overage_charge_id: charge.id,
      },
    });

    await supabase
      .from('pending_overage_charges')
      .update({
        status: 'succeeded',
        payment_intent_id: pi.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', charge.id);
    await logChargeEvent(charge.id, 'processed', { pi_id: pi.id }, 'system');
    return { id: charge.id, status: 'succeeded', pi_id: pi.id };
  } catch (err) {
    // Stripe throws on requires_action / authentication_required / card_declined etc.
    const code = err?.code || err?.raw?.code;
    await markFailed(charge.id, code || err.message);
    await logChargeEvent(charge.id, 'failed', { code, message: err.message }, 'system');
    return { id: charge.id, status: 'failed', reason: code || err.message };
  }
}

async function markFailed(chargeId, reason) {
  await supabase
    .from('pending_overage_charges')
    .update({
      status: 'failed',
      failure_reason: String(reason || 'unknown').slice(0, 500),
      processed_at: new Date().toISOString(),
    })
    .eq('id', chargeId);
}

/**
 * Customer dispute action (within the 48h window).
 * Flips status pending → disputed and writes the message.
 */
export async function disputePendingCharge(chargeId, message) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) {
    throw Object.assign(new Error('Auto overage charges are not enabled'), { status: 400 });
  }

  const { data: charge } = await supabase
    .from('pending_overage_charges')
    .select('id, status, scheduled_for')
    .eq('id', chargeId)
    .single();

  if (!charge) throw Object.assign(new Error('Charge not found'), { status: 404 });
  if (charge.status !== 'pending') {
    throw Object.assign(new Error(`This charge is no longer disputable (status: ${charge.status})`), { status: 400 });
  }
  if (new Date(charge.scheduled_for) < new Date()) {
    throw Object.assign(new Error('The dispute window for this charge has closed'), { status: 400 });
  }

  await supabase
    .from('pending_overage_charges')
    .update({ status: 'disputed', dispute_message: String(message || '').slice(0, 2000) })
    .eq('id', chargeId);

  await logChargeEvent(chargeId, 'disputed', { message }, 'customer');
  return { ok: true };
}

async function logChargeEvent(chargeId, event, detail, actor) {
  try {
    await supabase.from('pending_overage_charge_log').insert({
      charge_id: chargeId,
      event,
      detail,
      actor: actor || 'system',
    });
  } catch (err) {
    console.warn('[cardOnFile] log insert failed:', err.message);
  }
}

/**
 * List pending charges visible to the customer for a given booking.
 * Used by the customer portal dispute UI.
 */
export async function listCustomerVisibleCharges(bookingId) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return [];
  const { data } = await supabase
    .from('pending_overage_charges')
    .select('id, amount_cents, description, line_items, scheduled_for, status, created_at')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'disputed', 'processing', 'succeeded', 'failed'])
    .order('created_at', { ascending: false });
  return data || [];
}
