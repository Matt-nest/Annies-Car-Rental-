/**
 * squareCardOnFileService — Square Customer creation, card-on-file persistence,
 * scheduled-charge enqueueing, and 48h cron dispatch.
 *
 * Mirrors cardOnFileService.js (the Stripe version). All behavior is gated by
 * env var `FEATURE_AUTO_OVERAGE_CHARGES=true`; with the flag off every export is
 * a no-op so the booking flow is unaffected.
 */

import crypto from 'crypto';
import { getSquare, getSquareLocationId } from '../utils/square.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { sendPaymentDeclined } from './emailService.js';
import { sendEmail as sendBrandedEmail, wrapInBrandedHTML } from './notifyService.js';

const square = getSquare();

export const FEATURE_AUTO_OVERAGE_CHARGES =
  String(process.env.FEATURE_AUTO_OVERAGE_CHARGES || '').toLowerCase() === 'true';

/** 48-hour dispute window before a scheduled overage charge fires. */
export const OVERAGE_DELAY_MS = 48 * 60 * 60 * 1000;
/** On a retriable decline, wait this long before re-attempting the charge. */
export const RETRY_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
/** Max retry attempts after the initial charge (4 total). */
export const MAX_RETRIES = 3;

/**
 * Square decline codes worth retrying — transient issues that a later attempt
 * may clear. Anything not listed (expired/invalid card, CVV failure, auth
 * required) is permanent: retrying won't help.
 */
const RETRIABLE_DECLINE_CODES = new Set([
  'INSUFFICIENT_FUNDS',
  'GENERIC_DECLINE',
  'CARD_DECLINED',
  'TEMPORARY_ERROR',
  'TRANSIENT_ERROR',
  'CARD_PROCESSING_NOT_ENABLED',
  'GATEWAY_TIMEOUT',
]);

/** Square error codes that can never be cleared by retrying off-session. */
const PERMANENT_DECLINE_CODES = new Set([
  'CARD_EXPIRED',
  'INVALID_CARD',
  'INVALID_EXPIRATION',
  'CARD_NOT_SUPPORTED',
  'CVV_FAILURE',
  'CARD_DECLINED_VERIFICATION_REQUIRED',
  'CARD_DECLINED_CALL_ISSUER',
  'PAYMENT_LIMIT_EXCEEDED',
]);

/**
 * Idempotently get-or-create a Square Customer for the given customer row.
 * Persists the id to `customers.square_customer_id`.
 */
export async function ensureSquareCustomer(customer) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return null;
  if (!customer?.id) return null;
  if (customer.square_customer_id) return customer.square_customer_id;

  const resp = await square.customers.create({
    idempotencyKey: crypto.randomUUID(),
    givenName: customer.first_name || undefined,
    familyName: customer.last_name || undefined,
    emailAddress: customer.email || undefined,
    phoneNumber: customer.phone || undefined,
    referenceId: customer.id,
  });
  const squareCustomerId = resp.customer?.id;
  if (!squareCustomerId) return null;

  await supabase
    .from('customers')
    .update({ square_customer_id: squareCustomerId })
    .eq('id', customer.id);

  return squareCustomerId;
}

/**
 * Save the card used on a completed payment to the booking's customer so the
 * inspection-finalize step can charge it off-session. Square creates a
 * card-on-file from the payment id.
 */
export async function saveCardFromPayment(payment, booking) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return;
  if (!payment?.id || !booking?.id) return;

  const squareCustomerId = booking.customers?.square_customer_id;
  if (!squareCustomerId) return; // No customer attached — nothing to save against.

  try {
    const resp = await square.cards.create({
      idempotencyKey: crypto.randomUUID(),
      sourceId: payment.id,
      card: {
        customerId: squareCustomerId,
        referenceId: booking.id,
      },
    });
    const card = resp.card;
    if (!card?.id) return;
    await supabase
      .from('bookings')
      .update({
        square_card_id: card.id,
        card_brand: card.cardBrand || null,
        card_last4: card.last4 || null,
      })
      .eq('id', booking.id);
  } catch (err) {
    console.warn('[squareCardOnFile] saveCard failed:', err?.errors?.[0]?.detail || err.message);
  }
}

/**
 * Schedule an overage charge to fire after the dispute window closes.
 * Returns the inserted row id, or null if disabled / no card on file.
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

  const { data: booking } = await supabase
    .from('bookings')
    .select('square_card_id')
    .eq('id', bookingId)
    .single();

  if (!booking?.square_card_id) return null;

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
    console.error('[squareCardOnFile] schedule failed:', error.message);
    return null;
  }

  await logChargeEvent(data.id, 'created', { amount_cents: amountCents, scheduled_for: scheduledFor }, 'system');
  return data.id;
}

/**
 * Process pending overage charges whose dispute window has closed.
 * Called from the cron route. Returns a summary for logging.
 */
export async function processDueOverageCharges() {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return { skipped: true, reason: 'feature_flag_off' };

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('pending_overage_charges')
    .select('id, booking_id, amount_cents, description, line_items, attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .limit(50);

  if (error) {
    console.error('[squareCardOnFile] processDue query failed:', error.message);
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
    .select('id, booking_code, customer_id, square_card_id, customers(square_customer_id, email, first_name)')
    .eq('id', charge.booking_id)
    .single();

  if (!booking?.square_card_id || !booking.customers?.square_customer_id) {
    await markFailed(charge.id, 'missing_payment_method');
    return { id: charge.id, status: 'failed', reason: 'missing_payment_method' };
  }

  // Claim the row first to prevent double-fire if the cron overlaps.
  const { error: claimErr } = await supabase
    .from('pending_overage_charges')
    .update({ status: 'processing' })
    .eq('id', charge.id)
    .eq('status', 'pending');
  if (claimErr) return { id: charge.id, status: 'skipped', reason: 'claim_failed' };

  try {
    const resp = await square.payments.create({
      idempotencyKey: crypto.randomUUID(),
      sourceId: booking.square_card_id,
      customerId: booking.customers.square_customer_id,
      amountMoney: { amount: BigInt(charge.amount_cents), currency: 'USD' },
      autocomplete: true,
      locationId: getSquareLocationId() || undefined,
      referenceId: booking.booking_code,
      note: `${brand.stripeDescriptionPrefix} — ${booking.booking_code} overage: ${charge.description}`.slice(0, 500),
    });
    const payment = resp.payment;

    await supabase
      .from('pending_overage_charges')
      .update({
        status: 'succeeded',
        payment_intent_id: payment?.id,
        attempts: (charge.attempts || 0) + 1,
        processed_at: new Date().toISOString(),
      })
      .eq('id', charge.id);
    await logChargeEvent(charge.id, 'processed', { payment_id: payment?.id }, 'system');
    return { id: charge.id, status: 'succeeded', payment_id: payment?.id };
  } catch (err) {
    const code = err?.errors?.[0]?.code || err?.code || 'UNKNOWN';
    const attemptsMade = (charge.attempts || 0) + 1;
    const retriesUsed = attemptsMade - 1;
    const retriable = !PERMANENT_DECLINE_CODES.has(code) && RETRIABLE_DECLINE_CODES.has(code);

    if (retriable && retriesUsed < MAX_RETRIES) {
      const nextAttempt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
      await supabase
        .from('pending_overage_charges')
        .update({ status: 'pending', attempts: attemptsMade, scheduled_for: nextAttempt })
        .eq('id', charge.id);
      await logChargeEvent(charge.id, 'retry_scheduled', { code, attempt: attemptsMade, next_attempt: nextAttempt }, 'system');
      if (attemptsMade === 1) await notifyCustomerDeclined(charge, booking, code);
      return { id: charge.id, status: 'retry_scheduled', attempt: attemptsMade, next_attempt: nextAttempt };
    }

    const reason = code || err.message;
    await markFailed(charge.id, reason, attemptsMade);
    await logChargeEvent(charge.id, 'failed', { code, message: err.message, attempts: attemptsMade, exhausted: retriable }, 'system');
    if (attemptsMade === 1) await notifyCustomerDeclined(charge, booking, code);
    await notifyAdminChargeFailed(charge, booking, { reason, attempts: attemptsMade, exhausted: retriable });
    return { id: charge.id, status: 'failed', reason, attempts: attemptsMade };
  }
}

/** Friendly phrasing for a Square decline code, for customer-facing copy. */
function humanizeDecline(code) {
  const map = {
    INSUFFICIENT_FUNDS: 'insufficient funds',
    CARD_DECLINED: 'the card was declined',
    GENERIC_DECLINE: 'the card was declined',
    CARD_EXPIRED: 'the card has expired',
    INVALID_CARD: 'the card number is invalid',
    CVV_FAILURE: 'the card security code was incorrect',
    CARD_DECLINED_VERIFICATION_REQUIRED: 'the card requires verification',
    CARD_DECLINED_CALL_ISSUER: 'the card issuer declined the charge',
  };
  return map[code] || String(code || 'declined').replace(/_/g, ' ').toLowerCase();
}

async function notifyCustomerDeclined(charge, booking, declineCode) {
  const customer = booking.customers;
  if (!customer?.email) return;
  try {
    await sendPaymentDeclined({
      customer,
      booking,
      amountCents: charge.amount_cents,
      reason: humanizeDecline(declineCode),
    });
    await logChargeEvent(charge.id, 'customer_notified', { decline_code: declineCode }, 'system');
  } catch (err) {
    console.warn('[squareCardOnFile] customer decline email failed:', err.message);
  }
}

async function notifyAdminChargeFailed(charge, booking, { reason, attempts, exhausted }) {
  try {
    const amount = `$${((charge.amount_cents || 0) / 100).toFixed(2)}`;
    const customer = booking.customers || {};
    const who = customer.first_name || customer.email || 'Unknown customer';
    const outcome = exhausted
      ? `gave up after ${attempts} attempt${attempts === 1 ? '' : 's'}`
      : 'card declined — not retriable';
    const text = [
      'An automatic incidental/overage charge could not be collected and needs manual follow-up.',
      '',
      `Booking: ${booking.booking_code}`,
      `Customer: ${who}${customer.email ? ` (${customer.email})` : ''}`,
      `Amount: ${amount}`,
      `Reason: ${reason}`,
      `Outcome: ${outcome}`,
      '',
      'The customer has been asked to update their card on file. Review in the dashboard to retry or settle manually against the deposit.',
    ].join('\n');

    await sendBrandedEmail({
      to: brand.ownerEmail,
      subject: `⚠️ Overage charge failed — ${booking.booking_code} (${amount})`,
      html: wrapInBrandedHTML(`Overage Charge Failed — ${booking.booking_code}`, text),
    });
    await logChargeEvent(charge.id, 'admin_alerted', { to: brand.ownerEmail, reason, attempts }, 'system');
  } catch (err) {
    console.warn('[squareCardOnFile] admin failure alert failed:', err.message);
  }
}

async function markFailed(chargeId, reason, attempts) {
  const update = {
    status: 'failed',
    failure_reason: String(reason || 'unknown').slice(0, 500),
    processed_at: new Date().toISOString(),
  };
  if (attempts !== undefined) update.attempts = attempts;
  await supabase.from('pending_overage_charges').update(update).eq('id', chargeId);
}

/** Customer dispute action (within the 48h window). */
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
    console.warn('[squareCardOnFile] log insert failed:', err.message);
  }
}

/** List pending charges visible to the customer for a given booking. */
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
