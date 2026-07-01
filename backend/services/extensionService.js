/**
 * extensionService — customer-initiated rental extensions.
 *
 * Flow:
 *   1. quoteExtension()             → validate + price extra days (no writes)
 *   2. createExtensionPaymentIntent → create a Stripe PaymentIntent for the
 *                                     extra days and record a pending row
 *   3. confirmExtensionPayment()    → on Stripe success, extend the booking's
 *                                     return_date / rental_days / totals, write
 *                                     a `payments` row (type 'extension'), log
 *                                     the change, and notify the dashboard.
 *
 * Everything the confirm step needs lives in the PaymentIntent metadata, so the
 * flow still fully reconciles the booking + ledger even if the optional
 * `rental_extensions` audit table (migration 023) has not been applied yet.
 */

import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { calcRentalDays } from './pricingService.js';
import { checkAvailability } from './availabilityService.js';
import { createNotification } from './notificationService.js';

const stripe = getStripe();
const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.07');

/** Statuses from which a customer may extend an in-progress rental. */
const EXTENDABLE_STATUSES = ['active'];

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** Normalize a date-ish value to a 'YYYY-MM-DD' string. */
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
 * Validate + price an extension to `newReturnDate`. Pure (no writes).
 * Returns a quote object used by both the quote endpoint and the PI creation.
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

  const currentRentalDays = Number(booking.rental_days) || calcRentalDays(booking.pickup_date, currentReturn);
  const newRentalDays = calcRentalDays(booking.pickup_date, requestedReturn);
  const additionalDays = newRentalDays - currentRentalDays;
  if (additionalDays <= 0) throw bad('That date does not add any additional rental days');

  // Availability: the vehicle must be free from the day after the current
  // return date through the requested new return date. Exclude this booking
  // so it doesn't conflict with itself.
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

  const dailyRate = Number(booking.daily_rate) || Number(booking.vehicles?.daily_rate) || 0;
  if (dailyRate <= 0) throw bad('Unable to price this extension — no daily rate on file. Please contact us.', 500);

  const subtotal = parseFloat((additionalDays * dailyRate).toFixed(2));
  const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const total = parseFloat((subtotal + taxAmount).toFixed(2));

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    previousReturnDate: currentReturn,
    newReturnDate: requestedReturn,
    currentRentalDays,
    newRentalDays,
    additionalDays,
    dailyRate,
    subtotal,
    taxRate: TAX_RATE,
    taxAmount,
    total,
    subtotalCents: Math.round(subtotal * 100),
    taxCents: Math.round(taxAmount * 100),
    amountCents: Math.round(total * 100),
    lineItems: [
      { label: `${additionalDays} additional day${additionalDays === 1 ? '' : 's'} @ $${dailyRate.toFixed(2)}`, amount: subtotal },
      { label: `Tax (${Math.round(TAX_RATE * 100)}%)`, amount: taxAmount },
    ],
    _booking: booking,
  };
}

/**
 * Create a Stripe PaymentIntent for an extension and record a pending row.
 * Returns { clientSecret, quote, extensionId }.
 */
export async function createExtensionPaymentIntent(bookingId, newReturnDate, { expectedTotalCents } = {}) {
  const quote = await quoteExtension(bookingId, newReturnDate);
  const booking = quote._booking;

  if (expectedTotalCents != null && Math.abs(quote.amountCents - Number(expectedTotalCents)) > 1) {
    throw bad(
      `Amount mismatch: server calculated $${(quote.amountCents / 100).toFixed(2)} but the page expected $${(Number(expectedTotalCents) / 100).toFixed(2)}. Please refresh and try again.`
    );
  }

  // Record a pending extension row first so we can stamp its id onto the PI
  // metadata. Best-effort: if the audit table hasn't been migrated yet, the
  // flow still works — confirm reads everything it needs from PI metadata.
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
 * Apply a succeeded extension PaymentIntent to the booking. Idempotent across
 * the webhook + client-confirm paths (keyed on the payments.reference_id row).
 */
export async function confirmExtensionPayment(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') {
    throw bad(`Payment has not succeeded (status: ${pi.status})`);
  }
  if (pi.metadata?.kind !== 'extension') {
    throw bad('This payment is not a rental extension');
  }

  const bookingId = pi.metadata.booking_id;
  if (!bookingId) throw bad('No booking linked to this extension payment');

  // Idempotency — bail if we already recorded this extension payment.
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', pi.id)
    .eq('payment_type', 'extension')
    .maybeSingle();
  if (existing) {
    return { success: true, alreadyRecorded: true };
  }

  const newReturnDate = toDateStr(pi.metadata.new_return_date);
  const additionalDays = Number(pi.metadata.additional_days) || 0;
  const subtotalCents = Number(pi.metadata.subtotal_cents) || 0;
  const taxCents = Number(pi.metadata.tax_cents) || 0;
  const amountCents = Number(pi.metadata.amount_cents) || pi.amount;
  const amountDollars = amountCents / 100;

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, pickup_date, return_date, rental_days, subtotal, tax_amount, total_cost, line_items, status, customers(first_name, last_name)')
    .eq('id', bookingId)
    .single();
  if (bErr || !booking) throw bad('Booking not found', 404);

  // Record the extension payment in the ledger.
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: amountDollars,
    payment_type: 'extension',
    method: 'stripe',
    reference_id: pi.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: `Rental extension — +${additionalDays} day${additionalDays === 1 ? '' : 's'} to ${newReturnDate}`,
  });

  // Extend the booking. Recompute rental_days from the new span so it stays exact.
  const newRentalDays = calcRentalDays(booking.pickup_date, newReturnDate);
  const existingLineItems = Array.isArray(booking.line_items) ? booking.line_items : [];
  const updatedLineItems = [
    ...existingLineItems,
    { label: `Rental extension (+${additionalDays} day${additionalDays === 1 ? '' : 's'})`, amount: parseFloat((subtotalCents / 100).toFixed(2)) },
  ];

  const { error: updErr } = await supabase
    .from('bookings')
    .update({
      return_date: newReturnDate,
      rental_days: newRentalDays,
      subtotal: parseFloat((Number(booking.subtotal || 0) + subtotalCents / 100).toFixed(2)),
      tax_amount: parseFloat((Number(booking.tax_amount || 0) + taxCents / 100).toFixed(2)),
      total_cost: parseFloat((Number(booking.total_cost || 0) + amountCents / 100).toFixed(2)),
      line_items: updatedLineItems,
    })
    .eq('id', bookingId);
  if (updErr) {
    console.error(`[Extension] CRITICAL: payment recorded but booking ${booking.booking_code} update failed: ${updErr.message}`);
    throw updErr;
  }

  // Mark the audit row paid (best-effort).
  await supabase
    .from('rental_extensions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('payment_intent_id', pi.id)
    .then(() => {}, () => {});

  // Timeline entry (status unchanged — it stays 'active').
  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    from_status: booking.status,
    to_status: booking.status,
    changed_by: 'customer',
    reason: `Rental extended by ${additionalDays} day${additionalDays === 1 ? '' : 's'} to ${newReturnDate} — $${amountDollars.toFixed(2)} paid`,
  }).then(() => {}, () => {});

  // Dashboard notification.
  const cName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
  createNotification(
    'rental_extended',
    `Rental extended: ${booking.booking_code}`,
    `${cName ? cName + ' ' : ''}added ${additionalDays} day${additionalDays === 1 ? '' : 's'} (now due ${newReturnDate}) — $${amountDollars.toFixed(2)} paid`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, additional_days: additionalDays, new_return_date: newReturnDate, amount: amountDollars }
  ).catch(() => {});

  console.log(`[Extension] Booking ${booking.booking_code} extended +${additionalDays}d → ${newReturnDate} ($${amountDollars.toFixed(2)})`);
  return { success: true, newReturnDate, additionalDays, amount: amountDollars };
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
