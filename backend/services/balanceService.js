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

import { squareRequest } from '../utils/square.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { createNotification } from './notificationService.js';

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
/**
 * Create a Square payment for the outstanding balance.
 */
export async function createSquareBalancePayment(bookingId, { source_id, expectedCents, idempotencyKey } = {}) {
  const balance = await computeBalance(bookingId);
  if (balance.amountDueCents <= 0) throw bad('There is no outstanding balance on this rental');

  if (expectedCents != null && Math.abs(balance.amountDueCents - Number(expectedCents)) > 1) {
    throw bad('Your balance changed — please refresh and try again.');
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_code')
    .eq('id', bookingId)
    .single();

  const ref = booking?.booking_code || 'booking';

  let squarePayment = null;
  const payRes = await squareRequest('/v2/payments', {
    method: 'POST',
    body: {
      idempotency_key: idempotencyKey || crypto.randomUUID(),
      amount_money: {
        amount: balance.amountDueCents,
        currency: 'USD',
      },
      source_id,
      reference_id: ref,
      note: `${brand.squareDescriptionPrefix || 'Rental'} — ${ref} balance payment`,
    },
  });
  squarePayment = payRes.payment;

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', squarePayment.id)
    .maybeSingle();
  if (existing) return { success: true, alreadyRecorded: true, balance };

  const amountDollars = squarePayment.amount_money.amount / 100;

  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: amountDollars,
    payment_type: 'rental',
    method: 'square',
    reference_id: squarePayment.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: 'Balance payment via portal',
  });

  createNotification(
    'payment_received',
    `Balance payment: $${amountDollars.toFixed(2)}`,
    `Booking ${ref} — balance paid via portal`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: amountDollars }
  ).catch(() => {});

  console.log(`[Balance] Booking ${ref} balance payment recorded: $${amountDollars.toFixed(2)}`);
  return { success: true, amount: amountDollars, balance };
}
