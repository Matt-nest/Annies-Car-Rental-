import brand from '../config/brand.js';
import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from './bookingService.js';
import { createNotification } from './notificationService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from './teamAlertService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { calcInsuranceCost } from './pricingService.js';
import { resolveBookingDepositCents } from './depositService.js';
import { bindPolicy as bindBonzahPolicy, BonzahError } from './bonzahService.js';
import {
  FEATURE_AUTO_OVERAGE_CHARGES,
  ensureStripeCustomer,
  savePaymentMethodFromIntent,
} from './cardOnFileService.js';

const stripe = getStripe();

/** Whether checkout should save the card for off-session overage charges. */
export function isCardOnFileEnabled() {
  return FEATURE_AUTO_OVERAGE_CHARGES;
}

/** setup_future_usage value that must match between Elements and the PaymentIntent. */
function expectedSetupFutureUsage(stripeCustomerId) {
  return FEATURE_AUTO_OVERAGE_CHARGES && stripeCustomerId ? 'off_session' : null;
}

function paymentIntentMatchesCardOnFileConfig(pi, stripeCustomerId) {
  const expected = expectedSetupFutureUsage(stripeCustomerId);
  const actual = pi.setup_future_usage || null;
  return actual === expected;
}

async function cancelStalePaymentIntent(piId, reason) {
  try {
    await stripe.paymentIntents.cancel(piId);
    console.log(`[Stripe] Canceled stale PI ${piId}: ${reason}`);
  } catch (err) {
    console.warn(`[Stripe] Could not cancel stale PI ${piId}:`, err.message);
  }
}

/**
 * Reuse an in-flight PI only when amount + card-on-file params still match what
 * Elements will send on confirmPayment. A PI minted before card-on-file was
 * enabled (setup_future_usage=null) triggers the classic mismatch error.
 */
async function reusePaymentIntentIfValid(pi, { stripeCustomerId, totalChargeCents }) {
  if (!pi || ['canceled', 'succeeded'].includes(pi.status)) return null;
  if (pi.amount !== totalChargeCents) {
    await cancelStalePaymentIntent(pi.id, 'amount changed');
    return null;
  }
  if (!paymentIntentMatchesCardOnFileConfig(pi, stripeCustomerId)) {
    await cancelStalePaymentIntent(
      pi.id,
      `setup_future_usage mismatch (pi=${pi.setup_future_usage || 'null'}, expected=${expectedSetupFutureUsage(stripeCustomerId) || 'null'})`
    );
    return null;
  }
  return {
    clientSecret: pi.client_secret,
    amount: pi.amount,
    currency: pi.currency,
  };
}

async function resolveStripeCustomerForBooking(booking) {
  if (!FEATURE_AUTO_OVERAGE_CHARGES) return null;

  const { data: customerRow, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, stripe_customer_id')
    .eq('id', booking.customer_id)
    .single();

  if (error || !customerRow) {
    throw Object.assign(
      new Error('Unable to prepare payment — customer record not found. Please contact support.'),
      { status: 500 }
    );
  }

  try {
    const stripeCustomerId = await ensureStripeCustomer(customerRow);
    if (!stripeCustomerId) {
      throw new Error('Stripe customer could not be created');
    }
    return stripeCustomerId;
  } catch (err) {
    console.error('[Stripe] ensureStripeCustomer failed:', err.message);
    throw Object.assign(
      new Error('Unable to prepare payment. Please try again or contact support.'),
      { status: 500 }
    );
  }
}

async function insertPaymentIfMissing(row) {
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', row.reference_id)
    .eq('payment_type', row.payment_type)
    .maybeSingle();
  if (existing) return { inserted: false };
  const { error } = await supabase.from('payments').insert(row);
  if (error) throw error;
  return { inserted: true };
}

async function recordStripePaymentLedger(pi, bookingId) {
  const depositCents = Number(pi.metadata.deposit_cents) || 0;
  const insuranceCents = Number(pi.metadata.insurance_cents) || 0;
  const rentalCents = Number(pi.metadata.rental_cents) || pi.amount;
  const paidAt = new Date().toISOString();

  const rentalResult = await insertPaymentIfMissing({
    booking_id: bookingId,
    amount: rentalCents / 100,
    payment_type: 'rental',
    method: 'stripe',
    reference_id: pi.id,
    status: 'completed',
    paid_at: paidAt,
    notes: `Stripe payment — ${pi.payment_method_types?.join(', ') || 'card'}`,
  });

  if (insuranceCents > 0) {
    await insertPaymentIfMissing({
      booking_id: bookingId,
      amount: insuranceCents / 100,
      payment_type: 'insurance',
      method: 'stripe',
      reference_id: pi.id,
      status: 'completed',
      paid_at: paidAt,
      notes: 'Insurance collected with Stripe payment',
    });
  }

  if (depositCents > 0) {
    await insertPaymentIfMissing({
      booking_id: bookingId,
      amount: depositCents / 100,
      payment_type: 'deposit',
      method: 'stripe',
      reference_id: pi.id,
      status: 'completed',
      paid_at: paidAt,
      notes: 'Security deposit — refundable',
    });
  }

  return {
    rentalResult,
    rentalDollars: rentalCents / 100,
    depositDollars: depositCents / 100,
    depositCents,
    insuranceCents,
  };
}

/**
 * Create a PaymentIntent for a booking.
 * Charges total_cost + insurance_cost + security deposit in a single PaymentIntent.
 * The deposit portion is tracked separately in booking_deposits.
 * Accepts optional insurance_selection and expected_total_cents for server-side validation.
 * Returns { clientSecret, amount, currency, booking } for the frontend.
 */
export async function createPaymentIntent(bookingCode, { expected_total_cents } = {}) {
  // Look up the booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .eq('booking_code', bookingCode)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Don't allow payment for declined/cancelled bookings
  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('This booking has been ' + booking.status), { status: 400 });
  }

  // Approval gate: block the actual payment until an admin approves. The Pay
  // action passes expected_total_cents; the wizard's load-time summary fetch
  // does NOT, so it still returns pricing + status to drive the gated UI.
  // Website bookings sit at 'pending_approval'; admin-created ones are born
  // 'approved'. Enforced server-side so a tampered client can't pay early.
  if (expected_total_cents != null && booking.status === 'pending_approval') {
    throw Object.assign(
      new Error('This booking is awaiting owner approval. You’ll receive a secure link to complete payment once it’s approved.'),
      { status: 403 }
    );
  }

  // Calculate amount in cents — rental + insurance + security deposit
  const rentalCents = Math.round(Number(booking.total_cost) * 100);
  if (rentalCents <= 0) {
    throw Object.assign(new Error('Invalid booking total'), { status: 400 });
  }

  // Insurance cost reads directly from the booking record. The wizard's
  // POST /bookings/:code/insurance/quote already wrote bonzah_premium_cents +
  // bonzah_markup_cents in advance; we just sum them here.
  const insuranceDollars = calcInsuranceCost(booking);
  const insuranceCents = Math.round(insuranceDollars * 100);
  const insSource = booking.insurance_provider || null;
  const insTier = booking.bonzah_tier_id || null;

  // Security deposit — prefer booking snapshot (admin may have raised at approval)
  const depositCents = await resolveBookingDepositCents(booking);

  const totalChargeCents = rentalCents + insuranceCents + depositCents;

  // Server-side amount validation: reject if frontend total disagrees by more than 1 cent
  if (expected_total_cents != null && Math.abs(totalChargeCents - expected_total_cents) > 1) {
    throw Object.assign(
      new Error(`Amount mismatch: server calculated $${(totalChargeCents / 100).toFixed(2)} but frontend expected $${(expected_total_cents / 100).toFixed(2)}. Please refresh and try again.`),
      { status: 400 }
    );
  }

  // Resolve Stripe Customer before PI reuse so setup_future_usage stays aligned
  // with what Stripe Elements sends during deferred-intent confirmPayment.
  const stripeCustomerId = await resolveStripeCustomerForBooking(booking);

  const reuseContext = { stripeCustomerId, totalChargeCents };

  // Check if there's already a PaymentIntent for this booking.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('reference_id, status')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('method', 'stripe')
    .maybeSingle();

  if (existingPayment?.reference_id?.startsWith('pi_')) {
    try {
      const pi = await stripe.paymentIntents.retrieve(existingPayment.reference_id);
      if (pi.status === 'succeeded') {
        return {
          clientSecret: null,
          alreadyPaid: true,
          amount: pi.amount,
          currency: pi.currency,
          booking: await formatBookingSummary(booking),
        };
      }
      const reused = await reusePaymentIntentIfValid(pi, reuseContext);
      if (reused) {
        return { ...reused, booking: await formatBookingSummary(booking) };
      }
    } catch (e) {
      console.warn(`[Stripe] Could not retrieve existing PI ${existingPayment.reference_id}:`, e.message);
    }
  }

  const recentIntents = await stripe.paymentIntents.list({ limit: 10 });
  const activeIntent = recentIntents.data.find(
    pi => pi.metadata?.booking_id === booking.id && !['canceled', 'succeeded'].includes(pi.status)
  );
  if (activeIntent) {
    const reused = await reusePaymentIntentIfValid(activeIntent, reuseContext);
    if (reused) {
      return { ...reused, booking: await formatBookingSummary(booking) };
    }
  }

  const succeededIntent = recentIntents.data.find(
    pi => pi.metadata?.booking_id === booking.id && pi.status === 'succeeded'
  );
  if (succeededIntent) {
    return {
      clientSecret: null,
      alreadyPaid: true,
      amount: succeededIntent.amount,
      currency: succeededIntent.currency,
      booking: await formatBookingSummary(booking),
    };
  }

  // Create the PaymentIntent
  const piParams = {
    amount: totalChargeCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    // Restrict to the card-on-file-safe method set (cards + Apple/Google Pay + Link)
    // when configured. Off-session reusable only — no ACH/BNPL. White-label safe:
    // clones without the env var fall back to the account's default methods.
    ...(process.env.STRIPE_PAYMENT_METHOD_CONFIG
      ? { payment_method_configuration: process.env.STRIPE_PAYMENT_METHOD_CONFIG }
      : {}),
    ...(stripeCustomerId
      ? { customer: stripeCustomerId, setup_future_usage: 'off_session' }
      : {}),
    metadata: {
      booking_id: booking.id,
      booking_code: booking.booking_code,
      customer_name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      vehicle: `${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`,
      rental_cents: String(rentalCents),
      insurance_cents: String(insuranceCents),
      insurance_source: insSource || 'none',
      insurance_tier: insTier || 'none',
      deposit_cents: String(depositCents),
    },
    receipt_email: booking.customers?.email || undefined,
    description: `${brand.stripeDescriptionPrefix} — ${booking.booking_code} — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model} (incl. $${(depositCents / 100).toFixed(0)} refundable deposit${insuranceCents > 0 ? ` + $${(insuranceCents / 100).toFixed(0)} insurance` : ''})`,
  };

  // Self-heal from a stale/foreign STRIPE_PAYMENT_METHOD_CONFIG. If the env var
  // points at a payment_method_configuration that doesn't exist on THIS Stripe
  // account (e.g. copied from another clone), Stripe 400s "No such
  // payment_method_configuration" and previously took down the entire checkout —
  // the load-time summary swallowed it and the page showed $0 + deposit only.
  // Retry once without the config so a misconfigured env can never block payment.
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create(piParams);
  } catch (e) {
    if (piParams.payment_method_configuration && /payment_method_configuration/i.test(e?.message || '')) {
      console.warn(`[Stripe] Invalid STRIPE_PAYMENT_METHOD_CONFIG "${piParams.payment_method_configuration}" — retrying without it. Fix the env var on this project. (${e.message})`);
      delete piParams.payment_method_configuration;
      paymentIntent = await stripe.paymentIntents.create(piParams);
    } else {
      throw e;
    }
  }

  return {
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    booking: await formatBookingSummary(booking),
  };
}

/**
 * Build the payment_confirmed payload and send the itemized receipt.
 *
 * Idempotent across all three trigger paths (Stripe webhook, confirmPayment,
 * frontend post-success retry). Uses the PaymentIntent's own `metadata.receipt_sent_at`
 * as the idempotency key — set after a successful send so subsequent calls skip.
 *
 * Awaited so the dispatch isn't killed by Vercel's serverless lifecycle.
 * Errors are logged but never thrown.
 */
export async function sendPaymentReceipt(bookingId, pi, rentalDollars, depositDollars) {
  try {
    // Re-fetch the PI to get the freshest metadata (idempotency check).
    // Skip if a receipt has already been dispatched for this PI.
    const fresh = await stripe.paymentIntents.retrieve(pi.id);
    if (fresh.metadata?.receipt_sent_at) {
      console.log(`[Stripe] Receipt already sent for ${pi.id} at ${fresh.metadata.receipt_sent_at} — skipping`);
      return { skipped: true, reason: 'already_sent' };
    }

    const paidBooking = await getBookingDetail(bookingId);
    if (!paidBooking) {
      console.warn(`[Stripe] sendPaymentReceipt: booking ${bookingId} not found, skipping receipt`);
      return { skipped: true, reason: 'booking_not_found' };
    }
    if (!paidBooking.customers?.email) {
      console.warn(`[Stripe] sendPaymentReceipt: booking ${bookingId} has no customer email, skipping receipt`);
      return { skipped: true, reason: 'no_email' };
    }

    const payload = buildBookingPayload(paidBooking);
    payload.amount = rentalDollars.toFixed(2);
    payload.deposit_amount = depositDollars.toFixed(2);
    payload.total_charged = (pi.amount / 100).toFixed(2);
    payload.payment_method = pi.payment_method_types?.join(', ') || 'Card';
    payload.payment_date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    payload.payment_time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    payload.vehicle_name = paidBooking.vehicles ? `${paidBooking.vehicles.year} ${paidBooking.vehicles.make} ${paidBooking.vehicles.model}` : 'Vehicle';
    payload.pickup_date_formatted = paidBooking.pickup_date ? new Date(paidBooking.pickup_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    payload.return_date_formatted = paidBooking.return_date ? new Date(paidBooking.return_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    payload.rental_days = paidBooking.pickup_date && paidBooking.return_date ? Math.ceil((new Date(paidBooking.return_date) - new Date(paidBooking.pickup_date)) / (1000 * 60 * 60 * 24)) : '';
    payload.total_miles = payload.rental_days ? (Number(payload.rental_days) * 200).toLocaleString() : '—';
    payload.tax_amount = paidBooking.tax_amount ? parseFloat(paidBooking.tax_amount).toFixed(2) : '0.00';

    await sendBookingNotification('payment_confirmed', payload);

    // Mark the PI as having had its receipt sent — prevents double-dispatch
    // from the multiple trigger paths (webhook, confirmPayment, frontend retry).
    await stripe.paymentIntents.update(pi.id, {
      metadata: { ...fresh.metadata, receipt_sent_at: new Date().toISOString() },
    }).catch(e => console.warn(`[Stripe] Failed to mark receipt_sent_at on ${pi.id}:`, e.message));

    console.log(`[Stripe] Receipt sent for booking ${bookingId} (PI ${pi.id})`);
    return { sent: true };
  } catch (err) {
    console.error(`[Stripe] sendPaymentReceipt failed for booking ${bookingId}:`, err.message);
    return { error: err.message };
  }
}

/**
 * Trigger a payment receipt by PI id. Used by the frontend after a successful
 * Stripe confirmation to guarantee the receipt is dispatched, independent of
 * whether the webhook arrives (or arrives in time). Idempotent.
 */
export async function triggerReceiptByPaymentIntent(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') {
    throw Object.assign(new Error(`Payment is not succeeded (status: ${pi.status})`), { status: 400 });
  }
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) {
    throw Object.assign(new Error('No booking linked to this payment'), { status: 400 });
  }
  const depositCents = Number(pi.metadata.deposit_cents) || 0;
  const rentalCents = Number(pi.metadata.rental_cents) || pi.amount;
  return sendPaymentReceipt(bookingId, pi, rentalCents / 100, depositCents / 100);
}

/**
 * Bind a Bonzah policy after Stripe charged the customer.
 *
 * Idempotent: skips if booking already has bonzah_policy_no, or if insurance_status
 * is already 'active'/'bind_failed'. Only runs when insurance_provider === 'bonzah'.
 *
 * Failure handling: on any Bonzah error, marks insurance_status='bind_failed',
 * logs to console, sends an admin alert. Stripe charge stands; admin reconciles.
 */
async function bindBonzahAfterPayment(bookingId) {
  // Re-fetch booking + customer + vehicle in one shot
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(year, make, model)')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    console.warn(`[Bonzah] bindBonzahAfterPayment: booking ${bookingId} not found`);
    return;
  }

  if (booking.insurance_provider !== 'bonzah') return; // Customer chose own — nothing to bind
  if (booking.bonzah_policy_no) return;                 // Already bound
  if (booking.insurance_status === 'bind_failed') return; // Manual reconciliation pending

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
      // Bonzah already issued the policy and took our money — surface loudly so admin can reconcile by hand.
      console.error(`[Bonzah] CRITICAL: bind succeeded (policy_no=${result.policy_no}) but DB update failed for ${booking.booking_code}: ${updErr.message}`);
    }

    console.log(`[Bonzah] Policy bound for ${booking.booking_code}: ${result.policy_no}`);
    // Customer-facing policy_issued email is intentionally not sent — Bonzah sends
    // their own policy email to the customer email captured in the quote payload.
  } catch (err) {
    const isBonzahErr = err instanceof BonzahError;
    console.error(
      `[Bonzah] BIND FAILED for ${booking.booking_code} (Stripe already charged):`,
      isBonzahErr ? `${err.bonzahTxt || err.message} (status ${err.bonzahStatus})` : err.message
    );

    await supabase.from('bookings').update({ insurance_status: 'bind_failed' }).eq('id', bookingId);

    // Surface to admin via in-app dashboard notification only — the runbook's first
    // signal. Admin email intentionally not sent; the dashboard notification + the
    // dedicated Insurance page are the canonical reconciliation channels.
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
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const bookingId = pi.metadata.booking_id;
      if (!bookingId) break;

      const { rentalResult, rentalDollars, depositDollars, depositCents } =
        await recordStripePaymentLedger(pi, bookingId);

      // Update booking deposit status
      await supabase
        .from('bookings')
        .update({
          deposit_status: 'paid',
          deposit_amount: depositDollars,
        })
        .eq('id', bookingId);

      // Persist payment_method token to the booking so post-inspection overage
      // charges can fire off-session 48h after inspection. No-op when the
      // FEATURE_AUTO_OVERAGE_CHARGES flag is off.
      await savePaymentMethodFromIntent(pi, bookingId);

      // Create booking_deposits record for settlement tracking
      if (depositCents > 0) {
        const { error: depErr } = await supabase.from('booking_deposits').upsert({
          booking_id: bookingId,
          amount: depositCents,
          stripe_charge_id: pi.id,
          status: 'held',
        }, { onConflict: 'booking_id' });
        if (depErr) console.warn(`[Stripe] booking_deposits upsert failed for ${bookingId}:`, depErr.message);
      }

      console.log(`[Stripe] Payment succeeded for booking ${pi.metadata.booking_code}: $${rentalDollars} rental + $${depositDollars} deposit = $${pi.amount / 100} total`);

      // Bind the Bonzah policy now that we've collected the customer's money.
      // No-op if customer chose 'own' insurance. Failures mark the booking
      // insurance_status='bind_failed' and notify admin — Stripe charge stands.
      await bindBonzahAfterPayment(bookingId);

      // Send itemized receipt to customer
      await sendPaymentReceipt(bookingId, pi, rentalDollars, depositDollars);

      // Dashboard notification
      if (rentalResult.inserted) {
        createNotification(
          'payment_received',
          `Payment received: $${(pi.amount / 100).toFixed(2)}`,
          `Booking ${pi.metadata.booking_code} — ${pi.metadata.customer_name || ''}`,
          `/bookings/${bookingId}`,
          { booking_id: bookingId, amount: pi.amount / 100 }
        ).catch(() => {});
      }

      // Auto-confirm: payment only reaches here for already-approved bookings
      // (the approval gate blocks pending_approval), so a completed payment + a
      // signed agreement transitions the booking to 'confirmed'.
      const booking = await getBookingDetail(bookingId).catch(() => null);
      if (booking && booking.status === 'approved') {
        const { data: agreement } = await supabase
          .from('rental_agreements')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (agreement) {
          await transitionBooking(bookingId, 'confirmed', {
            changedBy: 'system',
            reason: 'Payment completed and agreement already signed'
          }).catch(e => console.error('[Auto-Confirm Error]', e));
        }
      }

      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.log(`[Stripe] Payment failed for booking ${pi.metadata?.booking_code}: ${pi.last_payment_error?.message}`);
      break;
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object;
      const bookingId = pi.metadata?.booking_id;
      console.log(`[Stripe] PaymentIntent canceled for booking ${pi.metadata?.booking_code}`);
      if (bookingId) {
        // Mark deposit as none so the booking doesn't sit in limbo
        await supabase
          .from('bookings')
          .update({ deposit_status: 'none' })
          .eq('id', bookingId)
          .eq('deposit_status', 'pending');
      }
      break;
    }

    default:
      // Unexpected event type
      break;
  }
}

/**
 * Confirm a payment after the frontend reports success.
 * Retrieves the PaymentIntent from Stripe, verifies it succeeded,
 * and records the payment + updates the booking.
 * This handles the case where webhooks can't reach the server (e.g. localhost).
 */
export async function confirmPayment(paymentIntentId) {
  // Retrieve the PaymentIntent from Stripe to verify it actually succeeded
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== 'succeeded') {
    throw Object.assign(
      new Error(`Payment has not succeeded (status: ${pi.status})`),
      { status: 400 }
    );
  }

  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) {
    throw Object.assign(new Error('No booking linked to this payment'), { status: 400 });
  }

  const depositCents = Number(pi.metadata.deposit_cents) || 0;
  const rentalCents = Number(pi.metadata.rental_cents) || pi.amount;
  const rentalDollars = rentalCents / 100;
  const depositDollars = depositCents / 100;

  const { rentalResult } = await recordStripePaymentLedger(pi, bookingId);

  if (!rentalResult.inserted) {
    await sendPaymentReceipt(bookingId, pi, rentalDollars, depositDollars);
    return { success: true, alreadyRecorded: true };
  }

  // Update booking deposit status
  await supabase
    .from('bookings')
    .update({
      deposit_status: depositCents > 0 ? 'paid' : 'none',
      deposit_amount: depositDollars,
    })
    .eq('id', bookingId);

  if (depositCents > 0) {
    const { error: depErr } = await supabase.from('booking_deposits').upsert({
      booking_id: bookingId,
      amount: depositCents,
      stripe_charge_id: pi.id,
      status: 'held',
    }, { onConflict: 'booking_id' });
    if (depErr) console.warn(`[Stripe] booking_deposits upsert failed for ${bookingId}:`, depErr.message);
  }

  console.log(`[Stripe] Payment confirmed for booking ${pi.metadata.booking_code}: $${pi.amount / 100}`);

  await bindBonzahAfterPayment(bookingId);
  await sendPaymentReceipt(bookingId, pi, rentalDollars, depositDollars);

  createNotification(
    'payment_received',
    `Payment received: $${(pi.amount / 100).toFixed(2)}`,
    `Booking ${pi.metadata.booking_code} — ${pi.metadata.customer_name || ''}`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: pi.amount / 100 }
  ).catch(() => {});

  const booking = await getBookingDetail(bookingId).catch(() => null);
  if (booking) {
    sendTeamAlertAsync(TEAM_ALERT_EVENTS.PAYMENT_RECEIVED, {
      booking,
      amount: pi.amount / 100,
    });
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
        reason: 'Payment completed and agreement already signed'
      }).catch(e => console.error('[Auto-Confirm Error]', e));
    }
  }

  return { success: true };
}

/**
 * Read-only booking summary for the checkout page load.
 *
 * Returns full pricing WITHOUT creating a PaymentIntent and WITHOUT the
 * approval gate, so the itemized breakdown renders correctly even while a
 * booking is still `pending_approval`. The old load path derived the summary
 * from createPaymentIntent, which both minted a live PI on every page load and
 * sat behind the approval gate — any failure there left the client's
 * bookingSummary null, collapsing the breakdown to a deposit-only line. The
 * actual charge still goes exclusively through createPaymentIntent.
 */
export async function getBookingSummary(bookingCode) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .eq('booking_code', bookingCode)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Preserve the "already paid" short-circuit the old create-payment-intent
  // load provided, so reopening a paid booking still jumps to the confirmed
  // screen instead of re-showing the payment step.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('status')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('status', 'completed')
    .maybeSingle();

  return {
    alreadyPaid: !!existingPayment,
    cardOnFileEnabled: isCardOnFileEnabled(),
    booking: await formatBookingSummary(booking),
  };
}

/**
 * Format a booking into a summary for the frontend checkout page
 */
async function formatBookingSummary(booking) {
  const depositCents = await resolveBookingDepositCents(booking);
  const depositAmount = depositCents / 100;

  // Calculate insurance cost from stored booking data (Bonzah quote columns)
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
    // Weekly pricing fields
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
