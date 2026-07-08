import brand from '../config/brand.js';
import { requireProvider } from '../config/paymentProvider.js';
import { supabase } from '../db/supabase.js';
import { squareRequest, getSquareConfig } from '../utils/square.js';
import { transitionBooking, getBookingDetail } from './bookingService.js';
import { createNotification } from './notificationService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from './teamAlertService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { calcInsuranceCost } from './pricingService.js';
import { bindPolicy as bindBonzahPolicy, BonzahError } from './bonzahService.js';

function centsToDollars(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function squarePaymentIsComplete(payment) {
  return ['COMPLETED', 'APPROVED'].includes(payment?.status);
}

async function getDepositCentsForVehicle(vehicleId) {
  let depositCents = 15000;
  if (vehicleId) {
    const { data } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', vehicleId)
      .maybeSingle();
    if (data?.amount != null) depositCents = Number(data.amount);
  }
  return depositCents;
}

async function getBookingByCode(bookingCode) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .eq('booking_code', String(bookingCode || '').toUpperCase())
    .single();
  if (error || !booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
  return booking;
}

async function getPaymentTotals(booking) {
  const rentalCents = Math.round(Number(booking.total_cost || 0) * 100);
  if (rentalCents <= 0) throw Object.assign(new Error('Invalid booking total'), { status: 400 });
  const insuranceCents = Math.round(calcInsuranceCost(booking) * 100);
  const depositCents = await getDepositCentsForVehicle(booking.vehicle_id);
  return {
    rentalCents,
    insuranceCents,
    depositCents,
    totalCents: rentalCents + insuranceCents + depositCents,
  };
}

async function insertPaymentIfMissing(payment) {
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', payment.reference_id)
    .eq('payment_type', payment.payment_type)
    .limit(1);
  if (existing?.length) return { inserted: false, id: existing[0].id };

  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select('id')
    .single();
  if (error) throw error;
  return { inserted: true, id: data.id };
}

async function finalizeBookingAfterPayment(bookingId) {
  let booking = await getBookingDetail(bookingId).catch(() => null);
  if (booking && booking.status === 'pending_approval' && booking.created_by_admin) {
    await transitionBooking(bookingId, 'approved', {
      changedBy: 'system',
      reason: 'Auto-approved on Square payment success (admin-created booking)',
    }).catch(e => console.error('[Square Auto-Approve Error]', e));
    booking = await getBookingDetail(bookingId).catch(() => booking);
  }
  if (booking && booking.status === 'approved') {
    const { data: agreement } = await supabase
      .from('rental_agreements')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (agreement) {
      await transitionBooking(bookingId, 'confirmed', {
        changedBy: 'system',
        reason: 'Square payment completed and agreement already signed',
      }).catch(e => console.error('[Square Auto-Confirm Error]', e));
    }
  }
}

async function bindBonzahAfterPayment(bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(year, make, model)')
    .eq('id', bookingId)
    .single();
  if (error || !booking || booking.insurance_provider !== 'bonzah') return;
  if (booking.bonzah_policy_no || booking.insurance_status === 'bind_failed') return;
  if (!booking.bonzah_tier_id || !booking.bonzah_quote_id) {
    await supabase.from('bookings').update({ insurance_status: 'bind_failed' }).eq('id', bookingId);
    return;
  }

  try {
    const result = await bindBonzahPolicy(booking, booking.customers, booking.bonzah_tier_id, bookingId);
    await supabase
      .from('bookings')
      .update({
        bonzah_policy_id: result.policy_id,
        bonzah_policy_no: result.policy_no,
        bonzah_total_charged_cents: Number(booking.bonzah_premium_cents || 0) + Number(booking.bonzah_markup_cents || 0),
        insurance_status: 'active',
        bonzah_last_synced_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
  } catch (err) {
    const msg = err instanceof BonzahError ? `${err.bonzahTxt || err.message} (status ${err.bonzahStatus})` : err.message;
    console.error(`[Bonzah] Square bind failed for ${booking.booking_code}:`, msg);
    await supabase.from('bookings').update({ insurance_status: 'bind_failed' }).eq('id', bookingId);
    createNotification(
      'bonzah_bind_failed',
      `Bonzah bind failed: ${booking.booking_code}`,
      'Customer was charged by Square but Bonzah policy was not issued. Manual reconciliation required.',
      `/bookings/${bookingId}`,
      { booking_id: bookingId, error: msg }
    ).catch(() => {});
  }
}

async function sendSquareReceipt(bookingId, payment, rentalDollars, depositDollars) {
  const paidBooking = await getBookingDetail(bookingId).catch(() => null);
  if (!paidBooking?.customers?.email) return { skipped: true };
  const payload = buildBookingPayload(paidBooking);
  payload.amount = rentalDollars.toFixed(2);
  payload.deposit_amount = depositDollars.toFixed(2);
  payload.total_charged = centsToDollars(payment.amount_money?.amount).toFixed(2);
  payload.payment_method = 'Card via Square';
  payload.payment_date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  payload.payment_time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  await sendBookingNotification('payment_confirmed', payload);
  return { sent: true };
}

async function recordSuccessfulSquarePayment(payment, bookingOverride = null) {
  const booking = bookingOverride || await getBookingByCode(payment.reference_id);
  const totals = await getPaymentTotals(booking);
  const paidAt = payment.created_at || new Date().toISOString();

  const rentalResult = await insertPaymentIfMissing({
    booking_id: booking.id,
    amount: centsToDollars(totals.rentalCents),
    payment_type: 'rental',
    method: 'square',
    reference_id: payment.id,
    status: 'completed',
    paid_at: paidAt,
    notes: `Square payment — ${payment.card_details?.card?.card_brand || 'card'}`,
  });

  if (totals.insuranceCents > 0) {
    await insertPaymentIfMissing({
      booking_id: booking.id,
      amount: centsToDollars(totals.insuranceCents),
      payment_type: 'insurance',
      method: 'square',
      reference_id: payment.id,
      status: 'completed',
      paid_at: paidAt,
      notes: 'Insurance collected with Square payment',
    });
  }

  if (totals.depositCents > 0) {
    await insertPaymentIfMissing({
      booking_id: booking.id,
      amount: centsToDollars(totals.depositCents),
      payment_type: 'deposit',
      method: 'square',
      reference_id: payment.id,
      status: 'completed',
      paid_at: paidAt,
      notes: 'Security deposit — refundable',
    });
    await supabase.from('booking_deposits').upsert({
      booking_id: booking.id,
      amount: totals.depositCents,
      stripe_charge_id: payment.id,
      status: 'held',
    }, { onConflict: 'booking_id' }).catch(() => {});
  }

  await supabase
    .from('bookings')
    .update({ deposit_status: totals.depositCents > 0 ? 'paid' : 'none', deposit_amount: centsToDollars(totals.depositCents) })
    .eq('id', booking.id);

  await bindBonzahAfterPayment(booking.id);

  if (rentalResult.inserted) {
    await sendSquareReceipt(booking.id, payment, centsToDollars(totals.rentalCents), centsToDollars(totals.depositCents));
    createNotification(
      'payment_received',
      `Square payment received: $${centsToDollars(payment.amount_money?.amount).toFixed(2)}`,
      `Booking ${booking.booking_code} — ${payment.buyer_email_address || ''}`,
      `/bookings/${booking.id}`,
      { booking_id: booking.id, amount: centsToDollars(payment.amount_money?.amount), provider: 'square' }
    ).catch(() => {});
    getBookingDetail(booking.id)
      .then((detail) => {
        if (detail) {
          sendTeamAlertAsync(TEAM_ALERT_EVENTS.PAYMENT_RECEIVED, {
            booking: detail,
            amount: centsToDollars(payment.amount_money?.amount),
          });
        }
      })
      .catch(() => {});
  }

  await finalizeBookingAfterPayment(booking.id);

  return { success: true, alreadyRecorded: !rentalResult.inserted, payment_id: payment.id };
}

async function formatSquareBookingSummary(booking) {
  const depositAmount = centsToDollars(await getDepositCentsForVehicle(booking.vehicle_id));
  const insuranceSource = booking.insurance_provider || null;
  const insuranceTier = booking.bonzah_tier_id || null;
  const insuranceCost = calcInsuranceCost(booking);

  return {
    bookingCode: booking.booking_code,
    status: booking.status,
    customerName: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    customerEmail: booking.customers?.email || '',
    vehicle: booking.vehicles
      ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`
      : null,
    pickupDate: booking.pickup_date,
    returnDate: booking.return_date,
    rentalDays: booking.rental_days,
    dailyRate: Number(booking.daily_rate),
    subtotal: Number(booking.subtotal),
    deliveryFee: Number(booking.delivery_fee || 0),
    discountAmount: Number(booking.discount_amount || 0),
    mileageAddonFee: Number(booking.mileage_addon_fee || 0),
    tollAddonFee: Number(booking.toll_addon_fee || 0),
    taxAmount: Number(booking.tax_amount || 0),
    totalCost: Number(booking.total_cost),
    rateType: booking.rate_type || 'daily',
    lineItems: booking.line_items || null,
    mileageAllowance: booking.mileage_allowance || null,
    insuranceSource,
    insuranceTier,
    insuranceCost,
    depositAmount,
    depositIncludedInCharge: true,
    totalChargedWithDeposit: Number(booking.total_cost) + insuranceCost + depositAmount,
    hasDelivery: !!booking.delivery_requested,
    hasUnlimitedMiles: !!booking.unlimited_miles,
    hasUnlimitedTolls: !!booking.unlimited_tolls,
    deliveryType: booking.delivery_type || null,
    deliveryAddress: booking.delivery_address || null,
  };
}

export async function getSquareBookingSummary(bookingCode) {
  requireProvider('square');
  const booking = await getBookingByCode(bookingCode);
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('status')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('status', 'completed')
    .maybeSingle();
  return { alreadyPaid: !!existingPayment, booking: await formatSquareBookingSummary(booking) };
}

export async function createSquarePayment(bookingCode, { source_id, expected_total_cents, idempotency_key }) {
  requireProvider('square');
  if (!source_id) throw Object.assign(new Error('source_id is required'), { status: 400 });
  const booking = await getBookingByCode(bookingCode);
  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error(`This booking has been ${booking.status}`), { status: 400 });
  }

  // Preserve approval gate behavior before charging a card.
  if (expected_total_cents != null && booking.status === 'pending_approval') {
    throw Object.assign(
      new Error('This booking is awaiting owner approval. You’ll receive a secure link to complete payment once it’s approved.'),
      { status: 403 }
    );
  }

  const existing = await supabase
    .from('payments')
    .select('reference_id')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('method', 'square')
    .limit(1);
  if (existing.data?.[0]?.reference_id) {
    return { success: true, alreadyPaid: true, payment_id: existing.data[0].reference_id };
  }

  const totals = await getPaymentTotals(booking);
  if (expected_total_cents != null && Math.abs(totals.totalCents - Number(expected_total_cents)) > 1) {
    throw Object.assign(
      new Error(`Amount mismatch: server calculated $${(totals.totalCents / 100).toFixed(2)} but frontend expected $${(Number(expected_total_cents) / 100).toFixed(2)}. Please refresh and try again.`),
      { status: 400 }
    );
  }

  const { locationId } = getSquareConfig();
  const response = await squareRequest('/v2/payments', {
    method: 'POST',
    body: {
      source_id,
      idempotency_key: idempotency_key || `${booking.booking_code}-${Date.now()}`,
      location_id: locationId,
      amount_money: { amount: totals.totalCents, currency: 'USD' },
      reference_id: booking.booking_code,
      buyer_email_address: booking.customers?.email || undefined,
      note: `${brand.name} ${booking.booking_code} rental + deposit`,
      autocomplete: true,
    },
  });

  if (!squarePaymentIsComplete(response.payment)) {
    throw Object.assign(new Error(`Square payment did not complete (status: ${response.payment?.status || 'unknown'})`), { status: 402 });
  }

  return recordSuccessfulSquarePayment(response.payment, booking);
}

export async function confirmSquarePayment(paymentId) {
  requireProvider('square');
  const response = await squareRequest(`/v2/payments/${paymentId}`);
  if (!squarePaymentIsComplete(response.payment)) {
    throw Object.assign(new Error(`Square payment is not complete (status: ${response.payment?.status || 'unknown'})`), { status: 400 });
  }
  return recordSuccessfulSquarePayment(response.payment);
}

export async function handleSquareWebhookEvent(event) {
  const payment = event?.data?.object?.payment;
  if (!payment || !squarePaymentIsComplete(payment)) return { ignored: true };
  return recordSuccessfulSquarePayment(payment);
}

export async function getSquareRemainingRefundableDollars(paymentId) {
  const { payment } = await squareRequest(`/v2/payments/${paymentId}`);
  const amount = Number(payment?.amount_money?.amount || 0);
  const refunded = Number(payment?.refunded_money?.amount || 0);
  return centsToDollars(Math.max(0, amount - refunded));
}

export async function refundSquarePayment({ paymentId, amountDollars, reason }) {
  requireProvider('square');
  const remaining = await getSquareRemainingRefundableDollars(paymentId);
  if (amountDollars <= 0 || amountDollars > remaining) {
    throw Object.assign(new Error(`Invalid refund amount. Maximum available is $${remaining.toFixed(2)}.`), { status: 400 });
  }
  const response = await squareRequest('/v2/refunds', {
    method: 'POST',
    body: {
      idempotency_key: `refund-${paymentId}-${Date.now()}`,
      payment_id: paymentId,
      reason: reason || 'requested_by_customer',
      amount_money: { amount: Math.round(amountDollars * 100), currency: 'USD' },
    },
  });
  return response.refund;
}
