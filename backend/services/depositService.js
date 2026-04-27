import { supabase } from '../db/supabase.js';
import { getStripe } from '../utils/stripe.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';

const stripe = getStripe();

/** Fetch a booking with customer + vehicle joins for notification payloads */
async function getBookingForNotify(bookingId) {
  const { data } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('id', bookingId)
    .single();
  return data;
}

/**
 * Get the deposit configuration for a vehicle.
 * Looks up vehicle_deposits table; falls back to vehicle.deposit_amount.
 * Returns amount in cents.
 */
export async function getVehicleDepositAmount(vehicleId) {
  const { data, error } = await supabase
    .from('vehicle_deposits')
    .select('amount')
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  if (data) return data.amount;

  // Fallback to legacy column on vehicles table
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('deposit_amount')
    .eq('id', vehicleId)
    .single();

  return vehicle ? Math.round(Number(vehicle.deposit_amount) * 100) : 15000;
}

/**
 * Create a Stripe PaymentIntent for the security deposit.
 * This is a SEPARATE charge from the rental payment.
 */
export async function createDepositCharge(bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, vehicle_id, customer_id, customers(first_name, last_name, email), vehicles(year, make, model)')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Check for existing deposit record
  const { data: existing } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existing && existing.status === 'held') {
    return { alreadyHeld: true, amount: existing.amount };
  }

  const depositAmount = await getVehicleDepositAmount(booking.vehicle_id);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: depositAmount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_id: booking.id,
      booking_code: booking.booking_code,
      payment_type: 'deposit',
    },
    receipt_email: booking.customers?.email || undefined,
    description: `Annie's Car Rental — Security Deposit — ${booking.booking_code}`,
  });

  // Create or update the deposit record
  if (existing) {
    await supabase
      .from('booking_deposits')
      .update({
        amount: depositAmount,
        status: 'pending',
        stripe_charge_id: paymentIntent.id,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('booking_deposits').insert({
      booking_id: bookingId,
      amount: depositAmount,
      status: 'pending',
      stripe_charge_id: paymentIntent.id,
    });
  }

  return {
    clientSecret: paymentIntent.client_secret,
    amount: depositAmount,
    depositDollars: (depositAmount / 100).toFixed(2),
  };
}

/**
 * Mark a deposit as "held" after Stripe confirms the charge.
 */
export async function confirmDepositHeld(bookingId, stripePaymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
  if (pi.status !== 'succeeded') {
    throw Object.assign(new Error(`Deposit payment not succeeded (status: ${pi.status})`), { status: 400 });
  }

  const { error } = await supabase
    .from('booking_deposits')
    .update({ status: 'held', stripe_charge_id: pi.id })
    .eq('booking_id', bookingId);

  if (error) throw error;

  // Also update the legacy column for backward compatibility
  await supabase
    .from('bookings')
    .update({ deposit_status: 'paid', deposit_amount: pi.amount / 100 })
    .eq('id', bookingId);

  return { success: true };
}

/**
 * Refund the full deposit back to the customer.
 * Used when inspection passes with no incidentals.
 */
export async function releaseDeposit(bookingId, { refundedBy = 'system' } = {}) {
  const { data: deposit, error } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!deposit) {
    throw Object.assign(new Error('No deposit found for this booking'), { status: 404 });
  }

  if (deposit.status === 'refunded') {
    return { alreadyRefunded: true };
  }

  if (deposit.stripe_charge_id) {
    await stripe.refunds.create({
      payment_intent: deposit.stripe_charge_id,
      amount: deposit.amount,
    });
  }

  await supabase
    .from('booking_deposits')
    .update({
      status: 'refunded',
      refund_amount: deposit.amount,
      applied_amount: 0,
      refunded_at: new Date().toISOString(),
      refunded_by: refundedBy,
    })
    .eq('id', deposit.id);

  // Update legacy column
  await supabase
    .from('bookings')
    .update({ deposit_status: 'refunded' })
    .eq('id', bookingId);

  // Notify customer (fire-and-forget)
  try {
    const booking = await getBookingForNotify(bookingId);
    if (booking) {
      const payload = buildBookingPayload(booking);
      payload.deposit_amount = (deposit.amount / 100).toFixed(2);
      payload.refund_amount = (deposit.amount / 100).toFixed(2);
      payload.deposit_status = 'refunded';
      sendBookingNotification('deposit_refunded', payload);
    }
  } catch (e) {
    console.error('[Deposit] Failed to send refund notification:', e.message);
  }

  return { success: true, refundedAmount: deposit.amount };
}

/**
 * Settle deposit: apply incidentals against it.
 * If incidentals < deposit → refund remainder.
 * If incidentals > deposit → net amount owed by customer.
 */
export async function settleDeposit(bookingId, { incidentalTotal = 0, refundedBy = 'system' } = {}) {
  const { data: deposit } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!deposit) {
    return { noDeposit: true, amountOwed: incidentalTotal };
  }

  const appliedAmount = Math.min(deposit.amount, incidentalTotal);
  const refundAmount = Math.max(0, deposit.amount - incidentalTotal);
  const amountOwed = Math.max(0, incidentalTotal - deposit.amount);

  // Partial refund via Stripe
  if (refundAmount > 0 && deposit.stripe_charge_id) {
    await stripe.refunds.create({
      payment_intent: deposit.stripe_charge_id,
      amount: refundAmount,
    });
  }

  const newStatus = refundAmount === deposit.amount ? 'refunded'
    : appliedAmount > 0 ? 'applied'
    : 'refunded';

  await supabase
    .from('booking_deposits')
    .update({
      status: newStatus,
      applied_amount: appliedAmount,
      refund_amount: refundAmount,
      refunded_at: new Date().toISOString(),
      refunded_by: refundedBy,
    })
    .eq('id', deposit.id);

  // Update legacy column
  await supabase
    .from('bookings')
    .update({ deposit_status: refundAmount > 0 ? 'refunded' : 'forfeited' })
    .eq('id', bookingId);

  // Notify customer (fire-and-forget)
  try {
    const booking = await getBookingForNotify(bookingId);
    if (booking) {
      const payload = buildBookingPayload(booking);
      payload.deposit_amount = (deposit.amount / 100).toFixed(2);
      payload.refund_amount = (refundAmount / 100).toFixed(2);
      payload.incidental_total = (incidentalTotal / 100).toFixed(2);
      payload.deposit_status = newStatus;
      sendBookingNotification('deposit_settled', payload);
    }
  } catch (e) {
    console.error('[Deposit] Failed to send settlement notification:', e.message);
  }

  return {
    success: true,
    depositAmount: deposit.amount,
    appliedAmount,
    refundAmount,
    amountOwed,
  };
}
