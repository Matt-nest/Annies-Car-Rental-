/**
 * cardOnFileService — Square Customer creation, payment-method persistence,
 * scheduled-charge enqueueing, and 48h cron dispatch.
 *
 * All behavior is gated by env var `FEATURE_AUTO_OVERAGE_CHARGES=true`. With
 * the flag off, every export below is a no-op (returns null/empty) so the
 * existing booking flow is unaffected.
 */

import { squareRequest } from '../utils/square.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';

export const FEATURE_AUTO_OVERAGE_CHARGES =
  String(process.env.FEATURE_AUTO_OVERAGE_CHARGES || '').toLowerCase() === 'true';

/** 48-hour dispute window before a scheduled overage charge fires. */
export const OVERAGE_DELAY_MS = 48 * 60 * 60 * 1000;

/**
 * Idempotently get-or-create a Square Customer for the given customer row.
 * Persists the resulting customer.id to `customers.stripe_customer_id` for
 * subsequent off-session charges.
 */
export async function ensureSquareCustomer(customer) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return null;
  if (!customer?.id) return null;

  if (customer.stripe_customer_id) return customer.stripe_customer_id;

  const res = await squareRequest('/v2/customers', {
    method: 'POST',
    body: {
      given_name: customer.first_name || undefined,
      family_name: customer.last_name || undefined,
      email_address: customer.email || undefined,
      phone_number: customer.phone || undefined,
      reference_id: customer.id,
    },
  });

  const squareCustomerId = res.customer.id;
  await supabase
    .from('customers')
    .update({ stripe_customer_id: squareCustomerId })
    .eq('id', customer.id);

  return squareCustomerId;
}

/**
 * Get-or-create a Square Customer regardless of the overage feature flag.
 * Used when the customer explicitly manages a card on file from the portal.
 */
export async function getOrCreateSquareCustomer(customerId) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, stripe_customer_id')
    .eq('id', customerId)
    .single();
  if (error || !customer) throw Object.assign(new Error('Customer not found'), { status: 404 });

  if (customer.stripe_customer_id) return customer.stripe_customer_id;

  const res = await squareRequest('/v2/customers', {
    method: 'POST',
    body: {
      given_name: customer.first_name || undefined,
      family_name: customer.last_name || undefined,
      email_address: customer.email || undefined,
      phone_number: customer.phone || undefined,
      reference_id: customer.id,
    },
  });

  const squareCustomerId = res.customer.id;
  await supabase.from('customers').update({ stripe_customer_id: squareCustomerId }).eq('id', customer.id);
  return squareCustomerId;
}

/** Return the card on file for a booking, or null. */
export async function getCardOnFile(bookingId) {
  const { data: b } = await supabase
    .from('bookings')
    .select('card_brand, card_last4, stripe_payment_method_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!b?.stripe_payment_method_id) return null;
  return { brand: b.card_brand || 'card', last4: b.card_last4 || '' };
}

/**
 * Save a Card on File using a tokenized Square source nonce.
 */
export async function saveCardOnFile(bookingId, sourceId) {
  const { data: b } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single();
  if (!b) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const squareCustomerId = await getOrCreateSquareCustomer(b.customer_id);

  const res = await squareRequest('/v2/cards', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      source_id: sourceId,
      card: {
        customer_id: squareCustomerId,
      },
    },
  });

  const card = res.card;
  await supabase
    .from('bookings')
    .update({
      stripe_payment_method_id: card.id,
      card_brand: card.card_brand || null,
      card_last4: card.last_4 || null,
    })
    .eq('id', bookingId);

  return { brand: card.card_brand || 'card', last4: card.last_4 || '' };
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
    const res = await squareRequest('/v2/payments', {
      method: 'POST',
      body: {
        idempotency_key: crypto.randomUUID(),
        amount_money: {
          amount: charge.amount_cents,
          currency: 'USD',
        },
        source_id: booking.stripe_payment_method_id,
        customer_id: booking.customers.stripe_customer_id,
        reference_id: booking.booking_code,
        note: `${brand.squareDescriptionPrefix || 'Overage'} — ${booking.booking_code} overage: ${charge.description}`,
      },
    });

    const payment = res.payment;
    if (['COMPLETED', 'APPROVED'].includes(payment.status)) {
      await supabase
        .from('pending_overage_charges')
        .update({
          status: 'succeeded',
          payment_intent_id: payment.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', charge.id);
      await logChargeEvent(charge.id, 'processed', { pi_id: payment.id }, 'system');
      return { id: charge.id, status: 'succeeded', pi_id: payment.id };
    }

    await markFailed(charge.id, `status:${payment.status}`);
    await logChargeEvent(charge.id, 'failed', { status: payment.status }, 'system');
    return { id: charge.id, status: 'failed', reason: payment.status };
  } catch (err) {
    const reason = err?.message || 'Square payment failed';
    await markFailed(charge.id, reason);
    await logChargeEvent(charge.id, 'failed', { message: reason }, 'system');
    return { id: charge.id, status: 'failed', reason };
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

/**
 * Admin: list ALL overage charges for a booking (every status, no feature-flag
 * gate) so staff can see + manage them from the dashboard. Returns [] if the
 * table hasn't been migrated.
 */
export async function listChargesForBookingAdmin(bookingId) {
  const { data, error } = await supabase
    .from('pending_overage_charges')
    .select('id, booking_id, amount_cents, description, line_items, scheduled_for, status, dispute_message, payment_intent_id, failure_reason, created_at, processed_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/**
 * Admin: cancel a scheduled overage charge before it fires. Only 'pending' or
 * 'disputed' charges can be cancelled — anything already processing/succeeded
 * is out of the customer's/admin's hands.
 */
export async function cancelPendingCharge(chargeId, actor = 'admin') {
  const { data: charge } = await supabase
    .from('pending_overage_charges')
    .select('id, status')
    .eq('id', chargeId)
    .single();

  if (!charge) throw Object.assign(new Error('Charge not found'), { status: 404 });
  if (!['pending', 'disputed'].includes(charge.status)) {
    throw Object.assign(new Error(`This charge can no longer be cancelled (status: ${charge.status})`), { status: 400 });
  }

  await supabase
    .from('pending_overage_charges')
    .update({ status: 'cancelled', processed_at: new Date().toISOString() })
    .eq('id', chargeId);

  await logChargeEvent(chargeId, 'cancelled', {}, actor);
  return { ok: true, status: 'cancelled' };
}
