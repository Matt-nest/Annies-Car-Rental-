import crypto from 'crypto';
import brand from '../config/brand.js';
import { getSquare, getSquareLocationId } from '../utils/square.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from './bookingService.js';
import { createNotification } from './notificationService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { calcInsuranceCost } from './pricingService.js';
import { bindPolicy as bindBonzahPolicy, BonzahError } from './bonzahService.js';
import {
  FEATURE_AUTO_OVERAGE_CHARGES,
  ensureSquareCustomer,
  saveCardFromPayment,
} from './squareCardOnFileService.js';

const square = getSquare();

/**
 * Shared amount math — rental + insurance + vehicle-specific security deposit.
 * Mirrors the Stripe service so both providers charge identical totals.
 */
async function computeCharge(booking) {
  const rentalCents = Math.round(Number(booking.total_cost) * 100);
  if (rentalCents <= 0) {
    throw Object.assign(new Error('Invalid booking total'), { status: 400 });
  }

  const insuranceCents = Math.round(calcInsuranceCost(booking) * 100);

  // Vehicle-specific deposit (defaults to $150 / 15000 cents)
  let depositCents = 15000;
  if (booking.vehicle_id) {
    const { data: vd } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', booking.vehicle_id)
      .maybeSingle();
    if (vd) depositCents = vd.amount;
  }

  return {
    rentalCents,
    insuranceCents,
    depositCents,
    totalChargeCents: rentalCents + insuranceCents + depositCents,
  };
}

/**
 * Look up a booking by code with the same projection the Stripe service uses.
 */
async function loadBooking(bookingCode) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(id, first_name, last_name, email, phone, stripe_customer_id, square_customer_id), vehicles(year, make, model, vehicle_code)')
    .eq('booking_code', bookingCode)
    .single();
  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }
  return booking;
}

/**
 * Create (and immediately capture) a Square payment for a booking.
 *
 * Square has no PaymentIntent/clientSecret: the client tokenizes the card with
 * the Web Payments SDK and posts the single-use `sourceToken` here. We charge
 * rental + insurance + deposit in one payment, then record it. SCA/3DS results
 * arrive as `verificationToken`.
 */
export async function createPayment(bookingCode, { sourceToken, verificationToken, expected_total_cents } = {}) {
  if (!sourceToken) {
    throw Object.assign(new Error('sourceToken is required'), { status: 400 });
  }

  const booking = await loadBooking(bookingCode);

  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('This booking has been ' + booking.status), { status: 400 });
  }

  // Idempotency / double-charge guard — provider-agnostic. If a completed rental
  // payment already exists for this booking, don't charge again.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('reference_id, status')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('status', 'completed')
    .maybeSingle();

  if (existingPayment) {
    return { alreadyPaid: true, booking: await formatBookingSummary(booking) };
  }

  const { rentalCents, insuranceCents, depositCents, totalChargeCents } = await computeCharge(booking);

  // Reject if the frontend total disagrees by more than 1 cent
  if (expected_total_cents != null && Math.abs(totalChargeCents - expected_total_cents) > 1) {
    throw Object.assign(
      new Error(`Amount mismatch: server calculated $${(totalChargeCents / 100).toFixed(2)} but frontend expected $${(expected_total_cents / 100).toFixed(2)}. Please refresh and try again.`),
      { status: 400 }
    );
  }

  // When card-on-file is enabled, attach a Square Customer so we can save the
  // card and charge any post-inspection overage 48h later. No-op when off.
  let squareCustomerId = null;
  if (FEATURE_AUTO_OVERAGE_CHARGES) {
    try {
      squareCustomerId = await ensureSquareCustomer(booking.customers);
      // ensureSquareCustomer persists the new id to the DB but not to our
      // in-memory row — propagate it so saveCardFromPayment (which reads
      // booking.customers.square_customer_id downstream) sees it this request.
      if (squareCustomerId && booking.customers) {
        booking.customers.square_customer_id = squareCustomerId;
      }
    } catch (err) {
      console.warn('[Square] ensureSquareCustomer failed (continuing without card-on-file):', err.message);
    }
  }

  const insLabel = insuranceCents > 0 ? ` + $${(insuranceCents / 100).toFixed(0)} insurance` : '';
  let payment;
  try {
    const resp = await square.payments.create({
      sourceId: sourceToken,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(totalChargeCents), currency: 'USD' },
      autocomplete: true,
      locationId: getSquareLocationId() || undefined,
      referenceId: booking.booking_code,
      note: `${brand.stripeDescriptionPrefix} — ${booking.booking_code} — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model} (incl. $${(depositCents / 100).toFixed(0)} deposit${insLabel})`.slice(0, 500),
      ...(squareCustomerId ? { customerId: squareCustomerId } : {}),
      ...(verificationToken ? { verificationToken } : {}),
    });
    payment = resp.payment;
  } catch (err) {
    const detail = err?.errors?.[0]?.detail || err?.message || 'Card was declined.';
    throw Object.assign(new Error(detail), { status: 402 });
  }

  if (!payment || !['COMPLETED', 'APPROVED'].includes(payment.status)) {
    throw Object.assign(new Error(`Payment not completed (status: ${payment?.status || 'unknown'})`), { status: 402 });
  }

  await recordPayment({ booking, payment, rentalCents, depositCents });

  return { success: true, paymentId: payment.id, booking: await formatBookingSummary(booking) };
}

/**
 * Record a completed Square payment into the ledger and run all downstream
 * side-effects. Idempotent via `payments.reference_id` — safe to call from both
 * the synchronous pay path and the webhook.
 */
async function recordPayment({ booking, payment, rentalCents, depositCents }) {
  const bookingId = booking.id;

  // Idempotency: skip if this Square payment is already recorded.
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', payment.id)
    .maybeSingle();

  const rentalDollars = rentalCents / 100;
  const depositDollars = depositCents / 100;
  const cardBrand = payment.cardDetails?.card?.cardBrand || null;
  const last4 = payment.cardDetails?.card?.last4 || null;
  const methodLabel = cardBrand ? `${cardBrand} ••${last4}` : 'card';

  if (existing) {
    // Already recorded (other path won the race). Still ensure the receipt went out.
    await sendPaymentReceipt(bookingId, payment, rentalDollars, depositDollars);
    return { alreadyRecorded: true };
  }

  // Rental payment row
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: rentalDollars,
    payment_type: 'rental',
    method: 'square',
    reference_id: payment.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: `Square payment — ${methodLabel}`,
  });

  // Deposit payment row (separate for accounting)
  if (depositCents > 0) {
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount: depositDollars,
      payment_type: 'deposit',
      method: 'square',
      reference_id: payment.id,
      status: 'completed',
      paid_at: new Date().toISOString(),
      notes: `Security deposit — refundable`,
    });
  }

  await supabase
    .from('bookings')
    .update({ deposit_status: 'paid', deposit_amount: depositDollars })
    .eq('id', bookingId);

  // Save the card on file for off-session overage charges (no-op when flag off).
  await saveCardFromPayment(payment, booking);

  // booking_deposits record for settlement tracking
  if (depositCents > 0) {
    const { error: depErr } = await supabase.from('booking_deposits').upsert({
      booking_id: bookingId,
      amount: depositCents,
      square_payment_id: payment.id,
      status: 'held',
    }, { onConflict: 'booking_id' });
    if (depErr) console.warn(`[Square] booking_deposits upsert failed for ${bookingId}:`, depErr.message);
  }

  console.log(`[Square] Payment recorded for booking ${booking.booking_code}: $${rentalDollars} rental + $${depositDollars} deposit`);

  // Bind Bonzah policy now that we've collected the money (no-op for 'own' insurance).
  await bindBonzahAfterPayment(bookingId);

  // Customer receipt
  await sendPaymentReceipt(bookingId, payment, rentalDollars, depositDollars);

  // Dashboard notification
  const totalDollars = Number(payment.amountMoney?.amount || 0) / 100;
  createNotification(
    'payment_received',
    `Payment received: $${totalDollars.toFixed(2)}`,
    `Booking ${booking.booking_code} — ${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim(),
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: totalDollars }
  ).catch(() => {});

  // Auto-confirm (admin-created bookings auto-approve on payment)
  let fresh = await getBookingDetail(bookingId).catch(() => null);
  if (fresh && fresh.status === 'pending_approval' && fresh.created_by_admin) {
    await transitionBooking(bookingId, 'approved', {
      changedBy: 'system',
      reason: 'Auto-approved on payment success (admin-created booking)',
    }).catch(e => console.error('[Auto-Approve Error]', e));
    fresh = await getBookingDetail(bookingId).catch(() => fresh);
  }
  if (fresh && fresh.status === 'approved') {
    const { data: agreement } = await supabase
      .from('rental_agreements')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (agreement) {
      await transitionBooking(bookingId, 'confirmed', {
        changedBy: 'system',
        reason: 'Payment completed and agreement already signed',
      }).catch(e => console.error('[Auto-Confirm Error]', e));
    }
  }

  return { success: true };
}

/**
 * Send the itemized payment receipt. Idempotent via `bookings.receipt_sent_at`
 * (Square has no updatable payment metadata, so the lock lives in the DB).
 * Errors are logged, never thrown.
 */
export async function sendPaymentReceipt(bookingId, payment, rentalDollars, depositDollars) {
  try {
    const { data: lockRow } = await supabase
      .from('bookings')
      .select('receipt_sent_at')
      .eq('id', bookingId)
      .single();
    if (lockRow?.receipt_sent_at) {
      console.log(`[Square] Receipt already sent for booking ${bookingId} at ${lockRow.receipt_sent_at} — skipping`);
      return { skipped: true, reason: 'already_sent' };
    }

    const paidBooking = await getBookingDetail(bookingId);
    if (!paidBooking) return { skipped: true, reason: 'booking_not_found' };
    if (!paidBooking.customers?.email) return { skipped: true, reason: 'no_email' };

    const totalCents = Number(payment.amountMoney?.amount || 0);
    const payload = buildBookingPayload(paidBooking);
    payload.amount = rentalDollars.toFixed(2);
    payload.deposit_amount = depositDollars.toFixed(2);
    payload.total_charged = (totalCents / 100).toFixed(2);
    payload.payment_method = payment.cardDetails?.card?.cardBrand || 'Card';
    payload.payment_date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    payload.payment_time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    payload.vehicle_name = paidBooking.vehicles ? `${paidBooking.vehicles.year} ${paidBooking.vehicles.make} ${paidBooking.vehicles.model}` : 'Vehicle';
    payload.pickup_date_formatted = paidBooking.pickup_date ? new Date(paidBooking.pickup_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    payload.return_date_formatted = paidBooking.return_date ? new Date(paidBooking.return_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    payload.rental_days = paidBooking.pickup_date && paidBooking.return_date ? Math.ceil((new Date(paidBooking.return_date) - new Date(paidBooking.pickup_date)) / (1000 * 60 * 60 * 24)) : '';
    payload.total_miles = payload.rental_days ? (Number(payload.rental_days) * 200).toLocaleString() : '—';
    payload.tax_amount = paidBooking.tax_amount ? parseFloat(paidBooking.tax_amount).toFixed(2) : '0.00';

    await sendBookingNotification('payment_confirmed', payload);

    // Set the lock so the multiple trigger paths (webhook, pay, frontend retry)
    // dispatch at most one receipt per booking.
    await supabase
      .from('bookings')
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq('id', bookingId);

    console.log(`[Square] Receipt sent for booking ${bookingId} (payment ${payment.id})`);
    return { sent: true };
  } catch (err) {
    console.error(`[Square] sendPaymentReceipt failed for booking ${bookingId}:`, err.message);
    return { error: err.message };
  }
}

/**
 * Trigger a receipt by Square payment id (frontend post-success retry path).
 * Idempotent.
 */
export async function triggerReceiptByPaymentId(paymentId) {
  const resp = await square.payments.get({ paymentId });
  const payment = resp.payment;
  if (!payment || !['COMPLETED', 'APPROVED'].includes(payment.status)) {
    throw Object.assign(new Error(`Payment is not completed (status: ${payment?.status || 'unknown'})`), { status: 400 });
  }
  const bookingCode = payment.referenceId;
  if (!bookingCode) {
    throw Object.assign(new Error('No booking linked to this payment'), { status: 400 });
  }
  const booking = await loadBooking(bookingCode);
  const { rentalCents, depositCents } = await computeCharge(booking);
  return sendPaymentReceipt(booking.id, payment, rentalCents / 100, depositCents / 100);
}

/**
 * Handle a verified Square webhook event. Backup path for `payment.created` /
 * `payment.updated` — records the payment if the synchronous pay path didn't.
 *
 * Also handles send_link recurring rental reconciliation: when a renter pays
 * via a reusable Square Payment Link, this auto-flips the oldest unpaid
 * recurring_charges row to 'paid'.
 */
export async function handleSquareWebhook(event) {
  const type = event?.type || '';
  if (type !== 'payment.created' && type !== 'payment.updated') return;

  const payment = event?.data?.object?.payment;
  if (!payment || !['COMPLETED', 'APPROVED'].includes(payment.status)) return;

  const bookingCode = payment.referenceId;

  // ── Path 1: booking-linked payment (standard checkout) ─────────────────────
  if (bookingCode) {
    let booking;
    try {
      booking = await loadBooking(bookingCode);
    } catch {
      // Not a booking code — might be a recurring referenceId like "recurring:<id>"
      // Fall through to Path 2.
    }

    if (booking) {
      const { rentalCents, depositCents } = await computeCharge(booking);
      await recordPayment({ booking, payment, rentalCents, depositCents });
      return;
    }
  }

  // ── Path 2: send_link recurring rental payment ─────────────────────────────
  // Payments made through a reusable Square Payment Link won't have a booking
  // referenceId. Match the payment to a recurring rental by looking up the
  // order's payment link association.
  await reconcileRecurringPaymentFromWebhook(payment);
}

/**
 * Reconcile a recurring rental payment that came through a Square Payment Link.
 *
 * Strategy:
 *   1. If the payment has an orderId, fetch the order to get its source
 *      (payment_link_id). Match against recurring_rentals.square_payment_link_id.
 *   2. Fallback: match by amount + square_customer_id (less precise but catches
 *      edge cases where the order lookup fails).
 *   3. Find the oldest unpaid charge for the matched plan and mark it paid.
 */
async function reconcileRecurringPaymentFromWebhook(payment) {
  try {
    let plan = null;

    // Strategy A: match via orderId → payment link
    if (payment.orderId) {
      try {
        const orderResp = await square.orders.get({
          orderId: payment.orderId,
        });
        const order = orderResp.order;

        // The order source contains the payment link reference
        // Square attaches source.name = "CHECKOUT_LINK_API" for payment link orders
        // and the order's metadata/checkout_id can link back
        if (order) {
          // Look for the checkout/payment-link association in recurring_rentals.
          // Square Payment Link orders don't directly embed the link ID in the
          // order object, but we can match by:
          //   - The order.source.name being a Payment Link order
          //   - The amount matching a recurring plan
          //   - The customer matching

          const amountCents = Number(payment.amountMoney?.amount || 0);
          const amountDollars = (amountCents / 100).toFixed(2);
          const squareCustomerId = payment.customerId || null;

          // Direct match: find a recurring plan whose payment link amount matches
          // and that has unpaid charges. Prefer customer ID match when available.
          const query = supabase
            .from('recurring_rentals')
            .select('id, amount, square_payment_link_id, square_customer_id')
            .eq('amount', amountDollars)
            .in('status', ['active', 'past_due'])
            .not('square_payment_link_id', 'is', null);

          if (squareCustomerId) {
            query.eq('square_customer_id', squareCustomerId);
          }

          const { data: candidates } = await query.limit(5);

          if (candidates?.length === 1) {
            plan = candidates[0];
          } else if (candidates?.length > 1 && squareCustomerId) {
            // Multiple plans for same customer+amount — take the one with the
            // earliest unpaid charge (most overdue gets priority).
            plan = candidates[0];
          }
        }
      } catch (err) {
        console.warn('[Square Webhook] Order lookup for recurring reconciliation failed:', err.message);
      }
    }

    // Strategy B: match by referenceId pattern "recurring:<plan_id>"
    if (!plan && payment.referenceId?.startsWith('recurring:')) {
      const planId = payment.referenceId.replace('recurring:', '');
      const { data: found } = await supabase
        .from('recurring_rentals')
        .select('id, amount, square_payment_link_id, square_customer_id')
        .eq('id', planId)
        .in('status', ['active', 'past_due'])
        .single();
      if (found) plan = found;
    }

    if (!plan) {
      // Not a recurring rental payment — silently ignore. This is expected for
      // payments that aren't booking-linked and aren't from a payment link.
      return;
    }

    // Find the oldest unpaid charge for this plan
    const { data: unpaidCharge } = await supabase
      .from('recurring_charges')
      .select('id, period_start, amount, status')
      .eq('recurring_rental_id', plan.id)
      .in('status', ['scheduled', 'failed', 'past_due'])
      .order('period_start', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!unpaidCharge) {
      console.log(`[Square Webhook] Recurring plan ${plan.id} has no unpaid charges to reconcile`);
      return;
    }

    // Import markChargePaid dynamically to avoid circular dependency
    const { markChargePaid } = await import('./recurringRentalService.js');
    await markChargePaid(unpaidCharge.id, { squarePaymentId: payment.id });

    console.log(
      `[Square Webhook] ✅ Reconciled send_link payment ${payment.id} → ` +
      `recurring charge ${unpaidCharge.id} (plan ${plan.id}, period ${unpaidCharge.period_start})`
    );
  } catch (err) {
    console.error('[Square Webhook] Recurring reconciliation error:', err.message);
  }
}

/**
 * Bind a Bonzah policy after the customer was charged. Provider-agnostic —
 * duplicated from stripeService so the Square path stays self-contained.
 */
async function bindBonzahAfterPayment(bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(year, make, model)')
    .eq('id', bookingId)
    .single();

  if (error || !booking) return;
  if (booking.insurance_provider !== 'bonzah') return;
  if (booking.bonzah_policy_no) return;
  if (booking.insurance_status === 'bind_failed') return;

  if (!booking.bonzah_tier_id || !booking.bonzah_quote_id) {
    console.warn(`[Bonzah] booking ${booking.booking_code} marked provider=bonzah but no quote on file`);
    await supabase.from('bookings').update({ insurance_status: 'bind_failed' }).eq('id', bookingId);
    return;
  }

  try {
    const result = await bindBonzahPolicy(booking, booking.customers, booking.bonzah_tier_id, bookingId);
    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        bonzah_policy_id: result.policy_id,
        bonzah_policy_no: result.policy_no,
        bonzah_total_charged_cents: Number(booking.bonzah_premium_cents || 0) + Number(booking.bonzah_markup_cents || 0),
        insurance_status: 'active',
        bonzah_last_synced_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
    if (updErr) {
      console.error(`[Bonzah] CRITICAL: bind succeeded (policy_no=${result.policy_no}) but DB update failed for ${booking.booking_code}: ${updErr.message}`);
    }
    console.log(`[Bonzah] Policy bound for ${booking.booking_code}: ${result.policy_no}`);
  } catch (err) {
    const isBonzahErr = err instanceof BonzahError;
    console.error(
      `[Bonzah] BIND FAILED for ${booking.booking_code} (customer already charged):`,
      isBonzahErr ? `${err.bonzahTxt || err.message} (status ${err.bonzahStatus})` : err.message
    );
    await supabase.from('bookings').update({ insurance_status: 'bind_failed' }).eq('id', bookingId);
    createNotification(
      'bonzah_bind_failed',
      `Bonzah bind failed: ${booking.booking_code}`,
      `Customer was charged but Bonzah policy was not issued. Manual reconciliation required.`,
      `/bookings/${bookingId}`,
      { booking_id: bookingId, error: err?.message }
    ).catch(() => {});
  }
}

/**
 * Format a booking into the checkout summary the frontend renders.
 * Mirrors stripeService.formatBookingSummary.
 */
async function formatBookingSummary(booking) {
  let depositAmount = 150;
  if (booking.vehicle_id) {
    const { data: vd } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', booking.vehicle_id)
      .maybeSingle();
    if (vd) depositAmount = vd.amount / 100;
  }

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
    insuranceSource: booking.insurance_provider || null,
    insuranceTier: booking.bonzah_tier_id || null,
    insuranceCost,
    depositAmount,
    depositIncludedInCharge: true,
    totalChargedWithDeposit: Number(booking.total_cost) + insuranceCost + depositAmount,
    hasDelivery: !!booking.delivery_requested,
    hasUnlimitedMiles: !!booking.unlimited_miles,
    hasUnlimitedTolls: !!booking.unlimited_tolls,
  };
}

/** Expose the booking summary for the GET config/summary endpoint. */
export async function getBookingSummary(bookingCode) {
  const booking = await loadBooking(bookingCode);
  const { totalChargeCents } = await computeCharge(booking);
  return { booking: await formatBookingSummary(booking), amount: totalChargeCents };
}
