/**
 * balanceService — mid-rental "balance due / pay now".
 *
 * The rental balance is `total_cost` minus the payments that make up the rental
 * (types 'rental' + 'extension'). Deposits (refundable holds), overage/damage
 * charges (billed separately), and refunds are intentionally excluded so the
 * number the customer sees maps cleanly to the rental total on their receipt.
 *
 * Lets a customer pay an outstanding balance any time during the rental —
 * useful for admin-created bookings, partial payments, or catching up an
 * installment. A paid balance is recorded as a 'rental' payment so it counts
 * toward the total everywhere.
 */

import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { createNotification } from './notificationService.js';

const stripe = getStripe();

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function round2(n) {
  return parseFloat(Number(n || 0).toFixed(2));
}

/** Payment types that count toward paying down `total_cost`. */
const RENTAL_PAYMENT_TYPES = ['rental', 'extension'];

/**
 * Compute the outstanding rental balance for a booking.
 * Returns { totalCost, paid, amountDue, amountDueCents }.
 */
export async function computeBalance(bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, total_cost')
    .eq('id', bookingId)
    .single();
  if (error || !booking) throw bad('Booking not found', 404);

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, payment_type, status')
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  const paid = (payments || [])
    .filter(p => RENTAL_PAYMENT_TYPES.includes(p.payment_type))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalCost = Number(booking.total_cost || 0);
  const amountDue = round2(Math.max(0, totalCost - paid));

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    totalCost: round2(totalCost),
    paid: round2(paid),
    amountDue,
    amountDueCents: Math.round(amountDue * 100),
  };
}

/**
 * Create a Stripe PaymentIntent for the outstanding balance.
 */
export async function createBalancePaymentIntent(bookingId, { expectedCents } = {}) {
  const balance = await computeBalance(bookingId);
  if (balance.amountDueCents <= 0) throw bad('There is no outstanding balance on this rental');

  if (expectedCents != null && Math.abs(balance.amountDueCents - Number(expectedCents)) > 1) {
    throw bad('Your balance changed — please refresh and try again.');
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_code, customers(email)')
    .eq('id', bookingId)
    .single();

  const pi = await stripe.paymentIntents.create({
    amount: balance.amountDueCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: booking?.customers?.email || undefined,
    description: `${brand.stripeDescriptionPrefix} — ${balance.bookingCode} balance payment`,
    metadata: {
      kind: 'balance',
      booking_id: bookingId,
      booking_code: balance.bookingCode,
      amount_cents: String(balance.amountDueCents),
    },
  });

  return { clientSecret: pi.client_secret, paymentIntentId: pi.id, balance };
}

/**
 * Apply a succeeded balance PaymentIntent — records a 'rental' payment.
 * Idempotent (keyed on payments.reference_id).
 */
export async function confirmBalancePayment(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') throw bad(`Payment has not succeeded (status: ${pi.status})`);
  if (pi.metadata?.kind !== 'balance') throw bad('This payment is not a balance payment');

  const bookingId = pi.metadata.booking_id;
  if (!bookingId) throw bad('No booking linked to this payment');

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', pi.id)
    .maybeSingle();
  if (existing) return { success: true, alreadyRecorded: true };

  const amountDollars = (Number(pi.metadata.amount_cents) || pi.amount) / 100;

  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: amountDollars,
    payment_type: 'rental',
    method: 'stripe',
    reference_id: pi.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: 'Balance payment via portal',
  });

  createNotification(
    'payment_received',
    `Balance payment: $${amountDollars.toFixed(2)}`,
    `Booking ${pi.metadata.booking_code} — balance paid via portal`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: amountDollars }
  ).catch(() => {});

  console.log(`[Balance] Booking ${pi.metadata.booking_code} balance payment recorded: $${amountDollars.toFixed(2)}`);
  return { success: true, amount: amountDollars };
}
