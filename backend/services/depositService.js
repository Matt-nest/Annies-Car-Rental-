import brand from '../config/brand.js';
import { supabase } from '../db/supabase.js';
import { getStripe } from '../utils/stripe.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { PAYMENT_PROVIDER, isSquareProvider } from '../config/paymentProvider.js';
import { refundSquarePayment, getSquareRemainingRefundableDollars } from './squareService.js';
import { getPaymentMethodLabel, normalizeDashboardPaymentMethod } from '../utils/paymentMethods.js';

/** Fetch a booking with customer + vehicle joins for notification payloads */
async function getBookingForNotify(bookingId) {
  const { data } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('id', bookingId)
    .single();
  return data;
}

async function getStripeRemainingRefundableCents(paymentIntentId) {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.latest_charge) {
    const charge = await stripe.charges.retrieve(pi.latest_charge);
    return Math.max(0, charge.amount - charge.amount_refunded);
  }
  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const refunded = (refunds.data || []).reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(0, pi.amount - refunded);
}

async function createDepositRefund(paymentIntentId, amountCents, reason = 'requested_by_customer') {
  if (isSquareProvider()) {
    const remainingDollars = await getSquareRemainingRefundableDollars(paymentIntentId);
    if ((amountCents / 100) > remainingDollars) {
      throw Object.assign(
        new Error(`Refund exceeds Square remaining refundable amount ($${remainingDollars.toFixed(2)})`),
        { status: 400 }
      );
    }
    return refundSquarePayment({
      paymentId: paymentIntentId,
      amountDollars: amountCents / 100,
      reason,
    });
  }

  const stripe = getStripe();
  const remaining = await getStripeRemainingRefundableCents(paymentIntentId);
  if (amountCents > remaining) {
    throw Object.assign(
      new Error(`Refund exceeds Stripe remaining refundable amount ($${(remaining / 100).toFixed(2)})`),
      { status: 400 }
    );
  }
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountCents,
    reason,
  });
}

async function getLatestCompletedDepositPayment(bookingId) {
  const { data } = await supabase
    .from('payments')
    .select('id, amount, method, reference_id')
    .eq('booking_id', bookingId)
    .eq('payment_type', 'deposit')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function resolveDepositRefundTarget(deposit, depositPayment) {
  const paymentMethod = String(depositPayment?.method || '').toLowerCase();
  const reference = deposit?.stripe_charge_id || depositPayment?.reference_id || null;

  if (paymentMethod === 'stripe' && reference?.startsWith('pi_')) {
    return { kind: 'gateway', method: 'stripe', reference };
  }
  if (paymentMethod === 'square' && reference) {
    return { kind: 'gateway', method: 'square', reference };
  }

  // Legacy gateway deposits may have a booking_deposits row but no payment row.
  if (!depositPayment && reference) {
    if (reference.startsWith('pi_')) return { kind: 'gateway', method: 'stripe', reference };
    if (isSquareProvider()) return { kind: 'gateway', method: 'square', reference };
  }

  return {
    kind: 'manual',
    method: paymentMethod || 'manual',
    reference: depositPayment?.reference_id || null,
  };
}

function remainingDepositCents(deposit) {
  return Math.max(
    0,
    Number(deposit?.amount || 0)
      - Number(deposit?.refund_amount || 0)
      - Number(deposit?.applied_amount || 0)
  );
}

function resolveDepositStatus({ amount, refunded, applied }) {
  const total = Number(amount || 0);
  const refundedTotal = Number(refunded || 0);
  const appliedTotal = Number(applied || 0);

  if (refundedTotal >= total && appliedTotal <= 0) return 'refunded';
  if (appliedTotal >= total && refundedTotal <= 0) return 'applied';
  if (refundedTotal > 0 || appliedTotal > 0) return 'partial_refund';
  return 'held';
}

async function recordDepositRefundLedger({ bookingId, amountCents, referenceId, paymentIntentId, note, method }) {
  if (amountCents <= 0) return;

  const depositPayment = await getLatestCompletedDepositPayment(bookingId);
  const refundMethod = method || depositPayment?.method || (isSquareProvider() ? 'square' : PAYMENT_PROVIDER);

  const gatewayRef = refundMethod === 'square' ? 'Square Payment' : refundMethod === 'stripe' ? 'PI' : 'Manual reference';
  const notes = depositPayment
    ? `Refund for payment ${depositPayment.id} - ${note}${paymentIntentId ? ` (${gatewayRef}: ${paymentIntentId})` : ' (manual/non-gateway deposit)'}`
    : `${note}${paymentIntentId ? ` (${gatewayRef}: ${paymentIntentId})` : ' (manual/non-gateway deposit)'}`;

  await supabase.from('payments').insert({
    booking_id: bookingId,
    payment_type: 'refund',
    amount: -(amountCents / 100),
    method: refundMethod,
    reference_id: referenceId || `manual_deposit_refund_${Date.now()}`,
    notes,
    status: 'completed',
    paid_at: new Date().toISOString(),
  });

  if (depositPayment) {
    const { data: childRefunds } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', bookingId)
      .eq('payment_type', 'refund')
      .ilike('notes', `%Refund for payment ${depositPayment.id}%`);

    const totalRefunded = (childRefunds || []).reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const { data: depositRow } = await supabase
      .from('payments')
      .select('amount')
      .eq('id', depositPayment.id)
      .single();

    const depositAmount = Number(depositRow?.amount || 0);
    const depositStatus = totalRefunded >= depositAmount ? 'refunded' : 'partial_refund';

    await supabase
      .from('booking_deposits')
      .update({
        status: depositStatus,
        refund_amount: Math.round(totalRefunded * 100),
        refunded_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId);

    if (depositStatus === 'refunded') {
      await supabase
        .from('bookings')
        .update({ deposit_status: 'refunded' })
        .eq('id', bookingId);
    }
  }
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
 * Resolve the deposit for checkout — prefer the snapshot on the booking row
 * (admin may have increased it at approval) and fall back to vehicle config.
 * Returns amount in cents.
 */
export async function resolveBookingDepositCents(booking) {
  const snap = Number(booking?.deposit_amount);
  if (Number.isFinite(snap) && snap > 0) {
    return Math.round(snap * 100);
  }
  if (booking?.vehicle_id) {
    return getVehicleDepositAmount(booking.vehicle_id);
  }
  return 15000;
}

/**
 * Create a Stripe PaymentIntent for the security deposit.
 * This is a SEPARATE charge from the rental payment.
 */
export async function createDepositCharge(bookingId) {
  if (isSquareProvider()) {
    throw Object.assign(
      new Error('Standalone deposit charges are disabled for Square. Use the customer checkout payment, which includes the refundable deposit.'),
      { status: 400 }
    );
  }
  const stripe = getStripe();
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
    description: `${brand.stripeDescriptionPrefix} — Security Deposit — ${booking.booking_code}`,
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
  const stripe = getStripe();
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

  if (!['held', 'partial_refund'].includes(String(deposit.status || '').toLowerCase())) {
    throw Object.assign(new Error('Deposit has not been collected for this booking'), { status: 400 });
  }

  const alreadyRefunded = Number(deposit.refund_amount || 0);
  const alreadyApplied = Number(deposit.applied_amount || 0);
  const amountToRefund = remainingDepositCents(deposit);
  if (amountToRefund <= 0) {
    return { alreadyRefunded: true };
  }

  const depositPayment = await getLatestCompletedDepositPayment(bookingId);
  const refundTarget = resolveDepositRefundTarget(deposit, depositPayment);

  let gatewayRefund = null;
  if (refundTarget.kind === 'gateway') {
    gatewayRefund = await createDepositRefund(refundTarget.reference, amountToRefund);
  }

  await recordDepositRefundLedger({
    bookingId,
    amountCents: amountToRefund,
    referenceId: gatewayRefund?.id,
    paymentIntentId: refundTarget.kind === 'gateway' ? refundTarget.reference : null,
    method: refundTarget.method,
    note: 'Security deposit released',
  });

  const refundedTotal = alreadyRefunded + amountToRefund;
  const finalStatus = resolveDepositStatus({
    amount: deposit.amount,
    refunded: refundedTotal,
    applied: alreadyApplied,
  });

  await supabase
    .from('booking_deposits')
    .update({
      status: finalStatus,
      refund_amount: refundedTotal,
      applied_amount: alreadyApplied,
      refunded_at: new Date().toISOString(),
      refunded_by: refundedBy,
    })
    .eq('id', deposit.id);

  // Update legacy column
  await supabase
    .from('bookings')
    .update({ deposit_status: finalStatus })
    .eq('id', bookingId);

  // Notify customer (fire-and-forget)
  try {
    const booking = await getBookingForNotify(bookingId);
    if (booking) {
      const payload = buildBookingPayload(booking);
      payload.deposit_amount = (deposit.amount / 100).toFixed(2);
      payload.refund_amount = (amountToRefund / 100).toFixed(2);
      payload.deposit_status = 'refunded';
      payload.payment_method = refundTarget.method === 'manual' ? 'Manual' : refundTarget.method;
      sendBookingNotification('deposit_refunded', payload);
    }
  } catch (e) {
    console.error('[Deposit] Failed to send refund notification:', e.message);
  }

  return { success: true, refundedAmount: amountToRefund };
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

  if (!['held', 'partial_refund'].includes(String(deposit.status || '').toLowerCase())) {
    return { noDeposit: true, amountOwed: incidentalTotal, status: deposit.status };
  }

  const alreadyRefunded = Number(deposit.refund_amount || 0);
  const alreadyApplied = Number(deposit.applied_amount || 0);
  const refundableDeposit = remainingDepositCents(deposit);
  const appliedAmount = Math.min(refundableDeposit, incidentalTotal);
  const refundAmount = Math.max(0, refundableDeposit - incidentalTotal);
  const amountOwed = Math.max(0, incidentalTotal - refundableDeposit);

  const depositPayment = await getLatestCompletedDepositPayment(bookingId);
  const refundTarget = resolveDepositRefundTarget(deposit, depositPayment);

  let gatewayRefund = null;
  if (refundAmount > 0 && refundTarget.kind === 'gateway') {
    gatewayRefund = await createDepositRefund(refundTarget.reference, refundAmount);
  }

  await recordDepositRefundLedger({
    bookingId,
    amountCents: refundAmount,
    referenceId: gatewayRefund?.id,
    paymentIntentId: refundTarget.kind === 'gateway' ? refundTarget.reference : null,
    method: refundTarget.method,
    note: 'Security deposit settled',
  });

  const appliedTotal = alreadyApplied + appliedAmount;
  const refundedTotal = alreadyRefunded + refundAmount;
  const newStatus = resolveDepositStatus({
    amount: deposit.amount,
    refunded: refundedTotal,
    applied: appliedTotal,
  });

  await supabase
    .from('booking_deposits')
    .update({
      status: newStatus,
      applied_amount: appliedTotal,
      refund_amount: refundedTotal,
      refunded_at: new Date().toISOString(),
      refunded_by: refundedBy,
    })
    .eq('id', deposit.id);

  // Update legacy column
  await supabase
    .from('bookings')
    .update({ deposit_status: newStatus })
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
      payload.payment_method = refundTarget.method === 'manual' ? 'Manual' : refundTarget.method;
      sendBookingNotification('deposit_settled', payload);
    }
  } catch (e) {
    console.error('[Deposit] Failed to send settlement notification:', e.message);
  }

  // Card-on-file: when incidentals exceed the deposit, schedule the overage
  // charge to fire 48h later (giving the customer a dispute window). Falls back
  // to the existing manual collection path when the feature flag is off or
  // when no card is on file. Email notification handled separately below.
  let overageScheduledId = null;
  if (amountOwed > 0) {
    try {
      const { scheduleOverageCharge, FEATURE_AUTO_OVERAGE_CHARGES, OVERAGE_DELAY_MS } =
        await import('./cardOnFileService.js');
      if (FEATURE_AUTO_OVERAGE_CHARGES) {
        overageScheduledId = await scheduleOverageCharge({
          bookingId,
          amountCents: amountOwed,
          description: 'Inspection charges exceed security deposit',
          lineItems: [{ description: 'Net amount owed after deposit applied', amount_cents: amountOwed }],
        });
        if (overageScheduledId) {
          // Email customer with itemized charges + dispute window. Reuses the
          // payment_confirmed receipt block by injecting a charge-summary into
          // a dedicated `inspection_charges_scheduled` notification stage —
          // falls back silently if the template isn't in the email_templates
          // table yet (admin can enable later via the Messaging tab).
          const booking = await getBookingForNotify(bookingId);
          if (booking) {
            const payload = buildBookingPayload(booking);
            payload.refund_amount = '0.00';
            payload.incidental_total = (incidentalTotal / 100).toFixed(2);
            payload.amount_owed = (amountOwed / 100).toFixed(2);
            payload.charge_scheduled_iso = new Date(Date.now() + OVERAGE_DELAY_MS).toISOString();
            payload.dispute_window_hours = 48;
            sendBookingNotification('inspection_charges_scheduled', payload);
          }
        }
      }
    } catch (e) {
      console.error('[Deposit] Overage charge scheduling failed:', e.message);
    }
  }

  return {
    success: true,
    depositAmount: deposit.amount,
    appliedAmount,
    refundAmount,
    amountOwed,
    overageScheduledId,
  };
}

/**
 * List deposits across all bookings for dashboard reporting.
 * @param {{ status?: string }} opts — 'held' (default), 'review_required', 'all', or a specific status
 */
export async function listDeposits({ status = 'held' } = {}) {
  const reviewRequired = status === 'review_required';
  let query = supabase
    .from('booking_deposits')
    .select(`
      id, booking_id, amount, status, stripe_charge_id,
      refund_amount, applied_amount, refunded_at, created_at,
      bookings!inner (
        id, booking_code, status, pickup_date, return_date,
        customers ( first_name, last_name, email ),
        vehicles ( year, make, model, vehicle_code )
      )
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    if (status === 'held' || reviewRequired) {
      query = query.in('status', ['held', 'partial_refund']);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  if (!reviewRequired) return rows;

  return rows
    .filter(row => ['returned', 'completed'].includes(String(row.bookings?.status || '').toLowerCase()))
    .map(row => ({ ...row, review_required: true }));
}

/**
 * Record a manually-collected deposit (Stripe/Card, Zelle, Cash, Cashapp).
 * Creates booking_deposits + payments ledger entry.
 */
export async function recordManualDeposit(bookingId, {
  amountCents,
  method = 'cash',
  referenceId = null,
  notes = null,
  recordedBy = 'admin',
} = {}) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, vehicle_id, deposit_amount, deposit_status')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  const { data: existing } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existing?.status === 'held') {
    throw Object.assign(new Error('Deposit is already held for this booking'), { status: 400 });
  }

  const cents = amountCents ?? await getVehicleDepositAmount(booking.vehicle_id);
  if (cents <= 0) {
    throw Object.assign(new Error('Deposit amount must be greater than zero'), { status: 400 });
  }

  const dollars = cents / 100;
  const normalizedMethod = normalizeDashboardPaymentMethod(method);
  const methodLabel = getPaymentMethodLabel(normalizedMethod);
  const gatewayReference = normalizedMethod === 'stripe'
    ? (referenceId || null)
    : null;

  if (existing) {
    const { error: updErr } = await supabase
      .from('booking_deposits')
      .update({
        amount: cents,
        status: 'held',
        stripe_charge_id: gatewayReference,
      })
      .eq('id', existing.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase.from('booking_deposits').insert({
      booking_id: bookingId,
      amount: cents,
      status: 'held',
      stripe_charge_id: gatewayReference,
    });
    if (insErr) throw insErr;
  }

  await supabase.from('payments').insert({
    booking_id: bookingId,
    payment_type: 'deposit',
    amount: dollars,
    method: normalizedMethod,
    reference_id: referenceId || `manual_deposit_${Date.now()}`,
    notes: notes || `Security deposit collected via ${methodLabel} by ${recordedBy}`,
    status: 'completed',
    paid_at: new Date().toISOString(),
  });

  await supabase
    .from('bookings')
    .update({ deposit_amount: dollars, deposit_status: 'paid' })
    .eq('id', bookingId);

  return {
    success: true,
    amount: cents,
    status: 'held',
    dollars: dollars.toFixed(2),
    method: normalizedMethod,
    method_label: methodLabel,
  };
}
