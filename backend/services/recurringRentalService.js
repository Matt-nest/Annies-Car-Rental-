/**
 * recurringRentalService — long-term private rentals billed on a schedule.
 *
 * Two collection methods:
 *   - auto_charge: the cron worker charges a saved card off-session each cycle.
 *   - send_link:   a reusable Square Payment Link the renter pays whenever; the
 *                  cron opens each cycle and (optionally) reminds them.
 *
 * Mirrors the squareCardOnFileService charge/retry shape. Square-only.
 */
import crypto from 'crypto';
import { getSquare, getSquareLocationId } from '../utils/square.js';
import { IS_SQUARE } from '../utils/paymentProvider.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { sendEmail as sendBrandedEmail, wrapInBrandedHTML } from './notifyService.js';

const square = getSquare();

const VALID_INTERVALS = new Set(['weekly', 'biweekly', 'monthly']);
const VALID_METHODS = new Set(['auto_charge', 'send_link']);

const RETRIABLE_DECLINE_CODES = new Set([
  'INSUFFICIENT_FUNDS', 'GENERIC_DECLINE', 'CARD_DECLINED',
  'TEMPORARY_ERROR', 'TRANSIENT_ERROR', 'GATEWAY_TIMEOUT',
]);

function assertSquare() {
  if (!IS_SQUARE) throw Object.assign(new Error('Recurring rentals require Square'), { status: 400 });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Advance a YYYY-MM-DD date by N intervals. */
function addInterval(dateStr, interval, count = 1) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * count);
  else if (interval === 'biweekly') d.setUTCDate(d.getUTCDate() + 14 * count);
  else d.setUTCMonth(d.getUTCMonth() + count); // monthly
  return d.toISOString().slice(0, 10);
}

const toCents = (dollars) => Math.round(Number(dollars) * 100);

// ── Square Payment Link (reusable, for send_link plans) ──────────────────────
/** Create a reusable Square quick-pay link. Returns { id, url }. */
export async function createPaymentLink({ name, amountCents }) {
  assertSquare();
  const resp = await square.checkout.paymentLinks.create({
    idempotencyKey: crypto.randomUUID(),
    quickPay: {
      name: String(name || 'Rental payment').slice(0, 255),
      priceMoney: { amount: BigInt(amountCents), currency: 'USD' },
      locationId: getSquareLocationId(),
    },
    checkoutOptions: { allowTipping: false },
  });
  const link = resp.paymentLink;
  if (!link?.url && !link?.longUrl) {
    throw Object.assign(new Error('Could not create payment link'), { status: 502 });
  }
  return { id: link.id, url: link.url || link.longUrl };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
/**
 * Create a recurring rental. amount is in dollars.
 * For send_link, generates the reusable link. For auto_charge, squareCardId is
 * required (the saved card to charge).
 */
export async function createRecurringRental({
  customerId, vehicleId = null, bookingId = null,
  amount, interval = 'monthly', intervalCount = 1,
  collectionMethod = 'auto_charge', squareCardId = null,
  startDate = null, billingAnchorDay = null, notes = null, createdBy = null,
}) {
  assertSquare();
  if (!customerId) throw Object.assign(new Error('customerId is required'), { status: 400 });
  if (!VALID_INTERVALS.has(interval)) throw Object.assign(new Error('Invalid interval'), { status: 400 });
  if (!VALID_METHODS.has(collectionMethod)) throw Object.assign(new Error('Invalid collection method'), { status: 400 });
  const amountCents = toCents(amount);
  if (!amountCents || amountCents <= 0) throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });

  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name, square_customer_id')
    .eq('id', customerId)
    .single();
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });

  const start = startDate || today();
  const row = {
    customer_id: customerId,
    vehicle_id: vehicleId,
    booking_id: bookingId,
    status: 'active',
    amount,
    interval,
    interval_count: intervalCount,
    billing_anchor_day: billingAnchorDay,
    collection_method: collectionMethod,
    square_customer_id: customer.square_customer_id || null,
    square_card_id: collectionMethod === 'auto_charge' ? squareCardId : null,
    start_date: start,
    next_charge_date: start,
    created_by: createdBy,
  };

  if (collectionMethod === 'auto_charge' && !squareCardId) {
    throw Object.assign(new Error('A saved card is required for auto-charge plans'), { status: 400 });
  }

  if (collectionMethod === 'send_link') {
    const name = `${brand.name} — recurring rental (${customer.first_name || ''} ${customer.last_name || ''})`.trim();
    const link = await createPaymentLink({ name, amountCents });
    row.square_payment_link_id = link.id;
    row.square_payment_link_url = link.url;
  }

  const { data, error } = await supabase.from('recurring_rentals').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function listRecurringForCustomer(customerId) {
  const { data: plans } = await supabase
    .from('recurring_rentals')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (!plans?.length) return [];

  const ids = plans.map((p) => p.id);
  const { data: charges } = await supabase
    .from('recurring_charges')
    .select('*')
    .in('recurring_rental_id', ids)
    .order('period_start', { ascending: false });

  const byPlan = {};
  for (const c of charges || []) (byPlan[c.recurring_rental_id] ||= []).push(c);
  return plans.map((p) => ({ ...p, charges: byPlan[p.id] || [] }));
}

/** Portal-safe view: the active plan + its recent/upcoming charges. */
export async function getRecurringForPortal(customerId) {
  const plans = await listRecurringForCustomer(customerId);
  const active = plans.find((p) => p.status === 'active' || p.status === 'past_due') || null;
  if (!active) return null;
  return {
    id: active.id,
    status: active.status,
    amount: active.amount,
    interval: active.interval,
    interval_count: active.interval_count,
    collection_method: active.collection_method,
    next_charge_date: active.next_charge_date,
    payment_link_url: active.square_payment_link_url || null,
    charges: (active.charges || []).slice(0, 6),
  };
}

async function setStatus(id, status, extra = {}) {
  const { data, error } = await supabase
    .from('recurring_rentals')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const pauseRecurring = (id) => setStatus(id, 'paused');
export const resumeRecurring = (id) => setStatus(id, 'active');
export const cancelRecurring = (id) => setStatus(id, 'cancelled', { cancelled_at: new Date().toISOString() });

/**
 * Manually mark a recurring charge paid (admin reconciliation for send_link
 * cycles the renter paid via the reusable link, or any cycle settled out-of-band).
 * Records a ledger row when the plan is booking-linked and recovers a past_due
 * plan once it has no remaining unpaid cycles. Idempotent.
 */
export async function markChargePaid(chargeId, { squarePaymentId = null } = {}) {
  const { data: charge } = await supabase
    .from('recurring_charges')
    .select('*')
    .eq('id', chargeId)
    .single();
  if (!charge) throw Object.assign(new Error('Charge not found'), { status: 404 });
  if (charge.status === 'paid') return charge;

  const { data: updated, error } = await supabase
    .from('recurring_charges')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      square_payment_id: squarePaymentId || charge.square_payment_id,
    })
    .eq('id', chargeId)
    .select()
    .single();
  if (error) throw error;

  const { data: plan } = await supabase
    .from('recurring_rentals')
    .select('id, booking_id, status')
    .eq('id', charge.recurring_rental_id)
    .single();

  if (plan?.booking_id) {
    await supabase.from('payments').insert({
      booking_id: plan.booking_id,
      amount: charge.amount,
      payment_type: 'recurring',
      method: 'square',
      reference_id: squarePaymentId || `manual-${chargeId}`,
      status: 'completed',
      paid_at: new Date().toISOString(),
      notes: `Recurring payment reconciled — ${charge.period_start}`,
    });
  }

  // Recover a past-due plan once nothing is outstanding.
  if (plan?.status === 'past_due') {
    const { data: unpaid } = await supabase
      .from('recurring_charges')
      .select('id')
      .eq('recurring_rental_id', plan.id)
      .in('status', ['scheduled', 'failed', 'past_due'])
      .limit(1);
    if (!unpaid?.length) {
      await supabase
        .from('recurring_rentals')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', plan.id);
    }
  }

  return updated;
}

// ── Cron: process due cycles ─────────────────────────────────────────────────
/** Charge/open every active|past_due plan whose next_charge_date has arrived. */
export async function processDueRecurringCharges() {
  if (!IS_SQUARE) return { skipped: true, reason: 'not_square' };

  const { data: due, error } = await supabase
    .from('recurring_rentals')
    .select('*')
    .in('status', ['active', 'past_due'])
    .lte('next_charge_date', today())
    .limit(100);
  if (error) return { error: error.message };
  if (!due?.length) return { processed: 0 };

  const results = [];
  for (const plan of due) results.push(await processPlan(plan));
  return { processed: results.length, results };
}

async function ensureChargeRow(plan) {
  const periodStart = plan.next_charge_date;
  const periodEnd = addInterval(periodStart, plan.interval, plan.interval_count);

  // Idempotent: one row per (plan, period_start).
  const { data: existing } = await supabase
    .from('recurring_charges')
    .select('*')
    .eq('recurring_rental_id', plan.id)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('recurring_charges')
    .insert({
      recurring_rental_id: plan.id,
      period_start: periodStart,
      period_end: periodEnd,
      amount: plan.amount,
      due_date: periodStart,
      status: 'scheduled',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function processPlan(plan) {
  try {
    const charge = await ensureChargeRow(plan);
    const nextDate = addInterval(plan.next_charge_date, plan.interval, plan.interval_count);

    if (plan.collection_method === 'send_link') {
      // Open the cycle and move the plan forward; the renter pays the link.
      if (charge.status === 'scheduled' && charge.attempts === 0) {
        await notifyLinkDue(plan, charge);
        await supabase.from('recurring_charges').update({ attempts: 1, last_attempt_at: new Date().toISOString() }).eq('id', charge.id);
      }
      await supabase.from('recurring_rentals').update({ next_charge_date: nextDate, status: 'active', updated_at: new Date().toISOString() }).eq('id', plan.id);
      return { id: plan.id, method: 'send_link', status: 'opened', period: charge.period_start };
    }

    // auto_charge
    if (charge.status === 'paid') {
      await supabase.from('recurring_rentals').update({ next_charge_date: nextDate, status: 'active', updated_at: new Date().toISOString() }).eq('id', plan.id);
      return { id: plan.id, status: 'already_paid' };
    }
    if (charge.attempts >= plan.max_charge_attempts) {
      return { id: plan.id, status: 'max_attempts_reached' };
    }
    if (!plan.square_card_id || !plan.square_customer_id) {
      await failCharge(plan, charge, 'missing_payment_method');
      return { id: plan.id, status: 'failed', reason: 'missing_payment_method' };
    }

    return await attemptAutoCharge(plan, charge, nextDate);
  } catch (err) {
    console.error('[recurring] processPlan error:', err.message);
    return { id: plan.id, status: 'error', error: err.message };
  }
}

async function attemptAutoCharge(plan, charge, nextDate) {
  const attempts = (charge.attempts || 0) + 1;
  await supabase.from('recurring_charges').update({ attempts, last_attempt_at: new Date().toISOString() }).eq('id', charge.id);

  try {
    const resp = await square.payments.create({
      idempotencyKey: `recur-${charge.id}-${attempts}`,
      sourceId: plan.square_card_id,
      customerId: plan.square_customer_id,
      amountMoney: { amount: BigInt(toCents(charge.amount)), currency: 'USD' },
      autocomplete: true,
      locationId: getSquareLocationId() || undefined,
      referenceId: `recurring:${plan.id}`,
      note: `${brand.name} recurring rental — ${charge.period_start}`.slice(0, 500),
    });
    const payment = resp.payment;

    await supabase.from('recurring_charges').update({
      status: 'paid', square_payment_id: payment?.id, paid_at: new Date().toISOString(),
    }).eq('id', charge.id);

    // Ledger row for accounting (booking_id when the plan is linked to one).
    if (plan.booking_id) {
      await supabase.from('payments').insert({
        booking_id: plan.booking_id,
        amount: charge.amount,
        payment_type: 'recurring',
        method: 'square',
        reference_id: payment?.id,
        status: 'completed',
        paid_at: new Date().toISOString(),
        notes: `Recurring rental — ${charge.period_start}`,
      });
    }

    await supabase.from('recurring_rentals').update({
      next_charge_date: nextDate, status: 'active', updated_at: new Date().toISOString(),
    }).eq('id', plan.id);

    return { id: plan.id, status: 'charged', payment_id: payment?.id };
  } catch (err) {
    const code = err?.errors?.[0]?.code || err?.code || 'UNKNOWN';
    const retriable = RETRIABLE_DECLINE_CODES.has(code);
    const exhausted = attempts >= plan.max_charge_attempts || !retriable;
    await failCharge(plan, charge, code, exhausted ? 'past_due' : 'failed');
    return { id: plan.id, status: 'failed', reason: code, exhausted };
  }
}

async function failCharge(plan, charge, reason, chargeStatus = 'failed') {
  await supabase.from('recurring_charges').update({
    status: chargeStatus, failure_reason: String(reason || 'unknown').slice(0, 500),
  }).eq('id', charge.id);
  await supabase.from('recurring_rentals').update({
    status: 'past_due', updated_at: new Date().toISOString(),
  }).eq('id', plan.id);
  await notifyAdminPastDue(plan, charge, reason);
}

async function notifyAdminPastDue(plan, charge, reason) {
  try {
    const { data: customer } = await supabase
      .from('customers').select('first_name, last_name, email').eq('id', plan.customer_id).single();
    const who = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email : 'a customer';
    const text = [
      'A recurring rental charge could not be collected.',
      '',
      `Customer: ${who}`,
      `Amount: $${Number(charge.amount).toFixed(2)}`,
      `Cycle: ${charge.period_start}`,
      `Reason: ${reason}`,
      '',
      'The plan is now past-due. Review it in the dashboard to update the card or retry.',
    ].join('\n');
    await sendBrandedEmail({
      to: brand.ownerEmail,
      subject: `⚠️ Recurring charge failed — ${who} ($${Number(charge.amount).toFixed(2)})`,
      html: wrapInBrandedHTML('Recurring Charge Failed', text),
    });
  } catch (err) {
    console.warn('[recurring] admin alert failed:', err.message);
  }
}

async function notifyLinkDue(plan, charge) {
  try {
    const { data: customer } = await supabase
      .from('customers').select('first_name, email').eq('id', plan.customer_id).single();
    if (!customer?.email || !plan.square_payment_link_url) return;
    const text = [
      `Hi ${customer.first_name || 'there'},`,
      '',
      `Your ${brand.name} rental payment of $${Number(charge.amount).toFixed(2)} is ready.`,
      'You can pay securely here anytime:',
      '',
      plan.square_payment_link_url,
      '',
      'Thank you!',
    ].join('\n');
    await sendBrandedEmail({
      to: customer.email,
      subject: `${brand.name} — your rental payment is ready`,
      html: wrapInBrandedHTML('Rental Payment', text),
    });
  } catch (err) {
    console.warn('[recurring] link reminder failed:', err.message);
  }
}
