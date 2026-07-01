/**
 * extensionService — customer- and admin-initiated rental extensions.
 *
 * Customer flow (portal):
 *   1. quoteExtension()             → validate + price extra days (no writes)
 *   2. createExtensionPaymentIntent → Stripe PaymentIntent for the extra days
 *   3. confirmExtensionPayment()    → on success, apply to the booking
 *
 * Admin flow (dashboard):
 *   adminExtendBooking()            → apply immediately, optionally recording a
 *                                     manual payment (cash/zelle/etc.) or waiving
 *
 * Pricing reuses computeRentalPricing so the extra days are charged at the
 * SAME weekly/monthly block + seasonal rates as the original booking — a
 * long-term renter adding a month is billed the monthly block rate, not flat
 * daily. The charge is the delta between a full recompute of the new span and
 * the current span (core rental only — flat add-ons, delivery, discounts and
 * loyalty are excluded so they aren't re-charged or re-credited).
 *
 * Everything confirm needs lives in the PaymentIntent metadata, so the flow
 * still reconciles the booking + ledger even if the optional rental_extensions
 * audit table (migration 023) has not been applied yet.
 */

import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { calcRentalDays, computeRentalPricing, resolveMultiplier } from './pricingService.js';
import { checkAvailability } from './availabilityService.js';
import { createNotification } from './notificationService.js';
import { extendPolicy as extendBonzahPolicy, payEndorsement as payBonzahEndorsement } from './bonzahService.js';

const stripe = getStripe();

/** Statuses from which a rental may be extended. */
const EXTENDABLE_STATUSES = ['active'];

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function round2(n) {
  return parseFloat(Number(n || 0).toFixed(2));
}
function toDateStr(value) {
  return String(value).split('T')[0];
}

async function loadBookingForExtension(bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email), vehicles(*)')
    .eq('id', bookingId)
    .single();
  if (error || !booking) throw bad('Booking not found', 404);
  return booking;
}

/**
 * Price an extension using weekly/monthly block logic (delta of full recompute).
 * Pure — no writes, no availability check.
 */
async function computeExtensionPricing(booking, requestedReturn) {
  const vehicle = booking.vehicles;
  if (!vehicle) throw bad('Vehicle not found for this booking', 500);

  const currentReturn = toDateStr(booking.return_date);

  // Seasonal multiplier resolved over the newly-added window.
  const { multiplier, name } = await resolveMultiplier(supabase, currentReturn, requestedReturn, booking.vehicle_id);

  const base = {
    vehicle,
    deliveryFeeAmount: 0,
    discountAmount: 0,
    mileageAddonFee: 0,
    tollAddonFee: 0,
    priceMultiplier: multiplier,
    seasonalRuleName: name,
  };

  const currentCore = computeRentalPricing({ ...base, pickupDate: booking.pickup_date, returnDate: currentReturn });
  const newCore = computeRentalPricing({ ...base, pickupDate: booking.pickup_date, returnDate: requestedReturn });

  const additionalDays = newCore.rental_days - currentCore.rental_days;
  const subtotal = round2(newCore.subtotal - currentCore.subtotal);
  const taxAmount = round2(newCore.tax_amount - currentCore.tax_amount);
  const total = round2(newCore.total_cost - currentCore.total_cost);

  return {
    additionalDays,
    currentRentalDays: currentCore.rental_days,
    newRentalDays: newCore.rental_days,
    rateType: newCore.rate_type,
    seasonalRuleName: name,
    subtotal,
    taxAmount,
    total,
  };
}

/**
 * Validate + price an extension to `newReturnDate`. Pure (no writes).
 */
export async function quoteExtension(bookingId, newReturnDate) {
  if (!newReturnDate) throw bad('A new return date is required');

  const booking = await loadBookingForExtension(bookingId);

  if (!EXTENDABLE_STATUSES.includes(booking.status)) {
    throw bad('Only an active rental can be extended. Please contact us for help.');
  }

  const currentReturn = toDateStr(booking.return_date);
  const requestedReturn = toDateStr(newReturnDate);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedReturn)) {
    throw bad('New return date must be a valid date (YYYY-MM-DD)');
  }
  if (requestedReturn <= currentReturn) {
    throw bad('The new return date must be after your current return date');
  }

  // Availability: the vehicle must be free from the current return date through
  // the requested new return date. Exclude this booking so it doesn't conflict
  // with itself.
  if (booking.vehicle_id) {
    const { available, conflicts } = await checkAvailability(
      booking.vehicle_id,
      currentReturn,
      requestedReturn,
      booking.id
    );
    if (!available) {
      const err = bad('This vehicle is already reserved for part of those dates. Please choose an earlier return date or contact us.', 409);
      err.conflicts = conflicts;
      throw err;
    }
  }

  const pricing = await computeExtensionPricing(booking, requestedReturn);
  if (pricing.additionalDays <= 0) throw bad('That date does not add any additional rental days');
  if (pricing.total <= 0) throw bad('Unable to price this extension. Please contact us.', 500);

  const rateLabel = pricing.rateType && pricing.rateType.startsWith('weekly')
    ? 'weekly rate'
    : pricing.rateType === 'monthly'
      ? 'monthly rate'
      : 'daily rate';

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    previousReturnDate: currentReturn,
    newReturnDate: requestedReturn,
    currentRentalDays: pricing.currentRentalDays,
    newRentalDays: pricing.newRentalDays,
    additionalDays: pricing.additionalDays,
    rateType: pricing.rateType,
    dailyRate: Number(booking.daily_rate) || 0,
    subtotal: pricing.subtotal,
    taxAmount: pricing.taxAmount,
    total: pricing.total,
    subtotalCents: Math.round(pricing.subtotal * 100),
    taxCents: Math.round(pricing.taxAmount * 100),
    amountCents: Math.round(pricing.total * 100),
    seasonalRuleName: pricing.seasonalRuleName,
    lineItems: [
      {
        label: `${pricing.additionalDays} additional day${pricing.additionalDays === 1 ? '' : 's'} (${rateLabel})`,
        amount: pricing.subtotal,
      },
      { label: 'Tax', amount: pricing.taxAmount },
    ],
    _booking: booking,
  };
}

/**
 * Create a Stripe PaymentIntent for a customer extension + record a pending row.
 */
export async function createExtensionPaymentIntent(bookingId, newReturnDate, { expectedTotalCents } = {}) {
  const quote = await quoteExtension(bookingId, newReturnDate);
  const booking = quote._booking;

  if (expectedTotalCents != null && Math.abs(quote.amountCents - Number(expectedTotalCents)) > 1) {
    throw bad(
      `Amount mismatch: server calculated $${(quote.amountCents / 100).toFixed(2)} but the page expected $${(Number(expectedTotalCents) / 100).toFixed(2)}. Please refresh and try again.`
    );
  }

  let extensionId = null;
  try {
    const { data: row, error } = await supabase
      .from('rental_extensions')
      .insert({
        booking_id: booking.id,
        previous_return_date: quote.previousReturnDate,
        new_return_date: quote.newReturnDate,
        additional_days: quote.additionalDays,
        daily_rate: quote.dailyRate,
        subtotal_cents: quote.subtotalCents,
        tax_cents: quote.taxCents,
        amount_cents: quote.amountCents,
        status: 'pending_payment',
        created_by: 'customer',
      })
      .select('id')
      .single();
    if (error) throw error;
    extensionId = row.id;
  } catch (e) {
    console.warn('[Extension] could not record pending row (continuing on metadata only):', e.message);
  }

  const vehicleName = booking.vehicles
    ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`
    : 'Vehicle';

  const paymentIntent = await stripe.paymentIntents.create({
    amount: quote.amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: booking.customers?.email || undefined,
    description: `${brand.stripeDescriptionPrefix} — ${booking.booking_code} rental extension: +${quote.additionalDays} day${quote.additionalDays === 1 ? '' : 's'} (${vehicleName})`,
    metadata: {
      kind: 'extension',
      booking_id: booking.id,
      booking_code: booking.booking_code,
      extension_id: extensionId || 'none',
      previous_return_date: quote.previousReturnDate,
      new_return_date: quote.newReturnDate,
      additional_days: String(quote.additionalDays),
      subtotal_cents: String(quote.subtotalCents),
      tax_cents: String(quote.taxCents),
      amount_cents: String(quote.amountCents),
    },
  });

  if (extensionId) {
    await supabase
      .from('rental_extensions')
      .update({ payment_intent_id: paymentIntent.id })
      .eq('id', extensionId)
      .then(() => {}, () => {});
  }

  const { _booking, ...publicQuote } = quote;
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    extensionId,
    quote: publicQuote,
  };
}

/**
 * Shared: apply an already-decided extension to the booking. Handles the ledger
 * row, booking date/price update, audit row, timeline, Bonzah policy extension
 * and dashboard notification. Callers own idempotency + validation.
 */
async function _applyExtensionToBooking(booking, {
  newReturnDate,
  additionalDays,
  subtotalCents,
  taxCents,
  amountCents,
  actor,             // 'customer' | 'admin:<id>'
  payment,           // { method, referenceId, status } | null (null = no ledger row)
  matchExtensionBy,  // { payment_intent_id } | { id } | null — which pending row to mark paid
}) {
  const amountDollars = amountCents / 100;

  if (payment) {
    await supabase.from('payments').insert({
      booking_id: booking.id,
      amount: amountDollars,
      payment_type: 'extension',
      method: payment.method,
      reference_id: payment.referenceId,
      status: payment.status || 'completed',
      paid_at: new Date().toISOString(),
      notes: `Rental extension — +${additionalDays} day${additionalDays === 1 ? '' : 's'} to ${newReturnDate}`,
    });
  }

  const newRentalDays = calcRentalDays(booking.pickup_date, newReturnDate);
  const existingLineItems = Array.isArray(booking.line_items) ? booking.line_items : [];
  const updatedLineItems = [
    ...existingLineItems,
    { label: `Rental extension (+${additionalDays} day${additionalDays === 1 ? '' : 's'})`, amount: round2(subtotalCents / 100) },
  ];

  const { error: updErr } = await supabase
    .from('bookings')
    .update({
      return_date: newReturnDate,
      rental_days: newRentalDays,
      subtotal: round2(Number(booking.subtotal || 0) + subtotalCents / 100),
      tax_amount: round2(Number(booking.tax_amount || 0) + taxCents / 100),
      total_cost: round2(Number(booking.total_cost || 0) + amountCents / 100),
      line_items: updatedLineItems,
    })
    .eq('id', booking.id);
  if (updErr) {
    console.error(`[Extension] CRITICAL: could not update booking ${booking.booking_code}: ${updErr.message}`);
    throw updErr;
  }

  if (matchExtensionBy) {
    const q = supabase.from('rental_extensions').update({ status: 'paid', paid_at: new Date().toISOString() });
    for (const [k, v] of Object.entries(matchExtensionBy)) q.eq(k, v);
    await q.then(() => {}, () => {});
  }

  await supabase.from('booking_status_log').insert({
    booking_id: booking.id,
    from_status: booking.status,
    to_status: booking.status,
    changed_by: actor,
    reason: `Rental extended by ${additionalDays} day${additionalDays === 1 ? '' : 's'} to ${newReturnDate} — $${amountDollars.toFixed(2)}${payment ? ' collected' : ' (no charge)'}`,
  }).then(() => {}, () => {});

  const cName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
  createNotification(
    'rental_extended',
    `Rental extended: ${booking.booking_code}`,
    `${cName ? cName + ' ' : ''}added ${additionalDays} day${additionalDays === 1 ? '' : 's'} (now due ${newReturnDate}) — $${amountDollars.toFixed(2)}`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id, additional_days: additionalDays, new_return_date: newReturnDate, amount: amountDollars }
  ).catch(() => {});

  // Best-effort: extend the Bonzah policy end date to cover the new return date.
  await maybeExtendBonzahPolicy(booking, newReturnDate).catch(e =>
    console.error('[Extension] Bonzah extend failed:', e.message)
  );

  console.log(`[Extension] Booking ${booking.booking_code} extended +${additionalDays}d → ${newReturnDate} ($${amountDollars.toFixed(2)})`);
  return { success: true, newReturnDate, additionalDays, amount: amountDollars };
}

/**
 * Extend the bound Bonzah policy to the new return date (date-change endorsement
 * + pay the additional premium). No-op unless an active Bonzah policy exists.
 * Failures never block the rental extension — they raise an admin notification.
 */
async function maybeExtendBonzahPolicy(booking, newReturnDate) {
  if (booking.insurance_provider !== 'bonzah') return;
  if (!booking.bonzah_policy_id) return;
  if (booking.insurance_status !== 'active') return;

  try {
    const endo = await extendBonzahPolicy(
      booking.bonzah_policy_id,
      {
        newPolicyEndDate: newReturnDate,
        newPolicyEndTime: booking.return_time || '23:59:00',
        policyStartDate: toDateStr(booking.pickup_date),
        policyStartTime: booking.pickup_time || '00:00:00',
      },
      booking.id
    );

    if (endo.premium_value > 0 && endo.epayment_id) {
      await payBonzahEndorsement(endo.epayment_id, endo.premium_value, booking.id);
    }

    const addedCents = Math.round(Number(endo.premium_value || 0) * 100);
    await supabase
      .from('bookings')
      .update({
        bonzah_total_charged_cents: Number(booking.bonzah_total_charged_cents || 0) + Math.max(0, addedCents),
        bonzah_last_synced_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .then(() => {}, () => {});

    console.log(`[Extension][Bonzah] Policy ${booking.bonzah_policy_id} extended to ${newReturnDate} (+$${Number(endo.premium_value || 0).toFixed(2)})`);
  } catch (err) {
    createNotification(
      'bonzah_extend_failed',
      `Bonzah extension failed: ${booking.booking_code}`,
      `The rental was extended to ${newReturnDate} but the Bonzah policy end date was NOT updated. Manual reconciliation required.`,
      `/bookings/${booking.id}`,
      { booking_id: booking.id, error: err?.message }
    ).catch(() => {});
    throw err;
  }
}

/**
 * Apply a succeeded extension PaymentIntent (customer flow). Idempotent across
 * the webhook + client-confirm paths (keyed on the payments.reference_id row).
 */
export async function confirmExtensionPayment(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') throw bad(`Payment has not succeeded (status: ${pi.status})`);
  if (pi.metadata?.kind !== 'extension') throw bad('This payment is not a rental extension');

  const bookingId = pi.metadata.booking_id;
  if (!bookingId) throw bad('No booking linked to this extension payment');

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', pi.id)
    .eq('payment_type', 'extension')
    .maybeSingle();
  if (existing) return { success: true, alreadyRecorded: true };

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, pickup_date, pickup_time, return_date, return_time, rental_days, subtotal, tax_amount, total_cost, line_items, status, insurance_provider, insurance_status, bonzah_policy_id, bonzah_total_charged_cents, customers(first_name, last_name)')
    .eq('id', bookingId)
    .single();
  if (bErr || !booking) throw bad('Booking not found', 404);

  return _applyExtensionToBooking(booking, {
    newReturnDate: toDateStr(pi.metadata.new_return_date),
    additionalDays: Number(pi.metadata.additional_days) || 0,
    subtotalCents: Number(pi.metadata.subtotal_cents) || 0,
    taxCents: Number(pi.metadata.tax_cents) || 0,
    amountCents: Number(pi.metadata.amount_cents) || pi.amount,
    actor: 'customer',
    payment: { method: 'stripe', referenceId: pi.id, status: 'completed' },
    matchExtensionBy: { payment_intent_id: pi.id },
  });
}

/**
 * Admin-initiated extension (dashboard). Applies immediately. Optionally records
 * a manual payment (cash/zelle/etc.) or waives the charge.
 *
 * @param opts.newReturnDate 'YYYY-MM-DD'
 * @param opts.collectPayment boolean — record a manual payment row
 * @param opts.method payment method when collecting (default 'cash')
 * @param opts.reference optional manual reference id
 * @param opts.actorId admin user id (for the audit trail)
 */
export async function adminExtendBooking(bookingId, { newReturnDate, collectPayment = true, method = 'cash', reference = null, actorId = null } = {}) {
  const quote = await quoteExtension(bookingId, newReturnDate);
  const booking = quote._booking;
  const actor = `admin:${actorId || 'unknown'}`;

  // Record an audit row (best-effort) so the admin extension shows in history.
  let extensionId = null;
  try {
    const { data: row } = await supabase
      .from('rental_extensions')
      .insert({
        booking_id: booking.id,
        previous_return_date: quote.previousReturnDate,
        new_return_date: quote.newReturnDate,
        additional_days: quote.additionalDays,
        daily_rate: quote.dailyRate,
        subtotal_cents: quote.subtotalCents,
        tax_cents: quote.taxCents,
        amount_cents: quote.amountCents,
        status: collectPayment ? 'paid' : 'cancelled',
        created_by: actor,
        paid_at: collectPayment ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    extensionId = row?.id || null;
  } catch (e) {
    console.warn('[Extension][admin] audit row insert failed (continuing):', e.message);
  }

  const result = await _applyExtensionToBooking(booking, {
    newReturnDate: quote.newReturnDate,
    additionalDays: quote.additionalDays,
    subtotalCents: quote.subtotalCents,
    taxCents: quote.taxCents,
    amountCents: quote.amountCents,
    actor,
    payment: collectPayment
      ? { method, referenceId: reference || `manual_ext_${Date.now()}`, status: 'completed' }
      : null,
    matchExtensionBy: null, // already stamped above
  });

  return { ...result, extensionId, quote: { ...quote, _booking: undefined } };
}

/** Mark a pending extension failed (best-effort, from the webhook). */
export async function markExtensionFailed(paymentIntentId) {
  await supabase
    .from('rental_extensions')
    .update({ status: 'failed' })
    .eq('payment_intent_id', paymentIntentId)
    .eq('status', 'pending_payment')
    .then(() => {}, () => {});
}

/**
 * List extensions for a booking. Returns [] if the audit table hasn't been
 * migrated yet, so dashboard callers degrade gracefully.
 */
export async function listExtensions(bookingId) {
  const { data, error } = await supabase
    .from('rental_extensions')
    .select('id, previous_return_date, new_return_date, additional_days, daily_rate, subtotal_cents, tax_cents, amount_cents, status, payment_intent_id, created_by, created_at, paid_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}
