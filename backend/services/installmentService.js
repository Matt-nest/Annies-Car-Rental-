/**
 * installmentService — recurring / installment billing for long-term rentals.
 *
 * A payment plan splits a booking's outstanding rental balance into scheduled
 * installments that are charged off-session against the card on file. Each paid
 * installment is recorded as a 'rental' payment so it counts toward the booking
 * total and pays down the portal balance.
 *
 * The scheduling tables (migration 024) are optional at runtime: every read
 * degrades to null/[] if the tables aren't applied yet.
 */

import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';
import { createNotification } from './notificationService.js';
import { computeBalance } from './balanceService.js';

const stripe = getStripe();

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const VALID_INTERVALS = ['weekly', 'biweekly', 'monthly'];

/** Add `k` intervals to a 'YYYY-MM-DD' date. */
function addInterval(dateStr, interval, k) {
  const d = new Date(String(dateStr).split('T')[0] + 'T12:00:00Z');
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * k);
  else if (interval === 'biweekly') d.setUTCDate(d.getUTCDate() + 14 * k);
  else d.setUTCMonth(d.getUTCMonth() + k); // monthly
  return d.toISOString().slice(0, 10);
}

/**
 * Create an installment plan splitting the current outstanding rental balance
 * into `installmentCount` charges on the given cadence.
 */
export async function createPlan(bookingId, { interval, installmentCount, startDate, actor = 'admin' } = {}) {
  if (!VALID_INTERVALS.includes(interval)) throw bad(`interval must be one of: ${VALID_INTERVALS.join(', ')}`);
  const count = parseInt(installmentCount, 10);
  if (!Number.isInteger(count) || count < 1 || count > 60) throw bad('installmentCount must be between 1 and 60');
  const start = String(startDate || '').split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw bad('startDate must be a valid date (YYYY-MM-DD)');

  // Only one active plan per booking.
  const existing = await getActivePlan(bookingId);
  if (existing) throw bad('This booking already has an active payment plan. Cancel it first.', 409);

  const balance = await computeBalance(bookingId);
  const totalCents = balance.amountDueCents;
  if (totalCents <= 0) throw bad('This booking has no outstanding balance to schedule');

  // Even split; the final installment absorbs the rounding remainder.
  const baseCents = Math.floor(totalCents / count);
  const amounts = Array.from({ length: count }, (_, i) =>
    i === count - 1 ? totalCents - baseCents * (count - 1) : baseCents
  );

  const { data: plan, error: planErr } = await supabase
    .from('payment_plans')
    .insert({
      booking_id: bookingId,
      interval,
      installment_count: count,
      total_cents: totalCents,
      status: 'active',
      created_by: actor,
    })
    .select('*')
    .single();
  if (planErr) throw planErr;

  const rows = amounts.map((amount_cents, i) => ({
    plan_id: plan.id,
    booking_id: bookingId,
    sequence: i + 1,
    due_date: addInterval(start, interval, i),
    amount_cents,
    status: 'scheduled',
  }));

  const { error: instErr } = await supabase.from('payment_installments').insert(rows);
  if (instErr) throw instErr;

  createNotification(
    'payment_plan_created',
    `Payment plan created: ${balance.bookingCode}`,
    `${count} ${interval} installments totaling $${(totalCents / 100).toFixed(2)}`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, plan_id: plan.id }
  ).catch(() => {});

  return getPlan(bookingId);
}

async function getActivePlan(bookingId) {
  const { data } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

/**
 * Return the most recent plan for a booking with its installments, or null.
 * Degrades to null if the tables aren't migrated.
 */
export async function getPlan(bookingId) {
  const { data: plan, error } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !plan) return null;

  const { data: installments } = await supabase
    .from('payment_installments')
    .select('id, sequence, due_date, amount_cents, status, paid_at, attempts, last_error, payment_intent_id')
    .eq('plan_id', plan.id)
    .order('sequence', { ascending: true });

  const list = installments || [];
  const paidCents = list.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_cents, 0);
  const next = list.find(i => ['scheduled', 'failed'].includes(i.status));

  return {
    plan,
    installments: list,
    summary: {
      totalCents: plan.total_cents,
      paidCents,
      remainingCents: Math.max(0, plan.total_cents - paidCents),
      paidCount: list.filter(i => i.status === 'paid').length,
      count: list.length,
      nextDueDate: next?.due_date || null,
      nextAmountCents: next?.amount_cents || null,
    },
  };
}

/** Re-derive plan.status from its installments. */
async function rollUpPlanStatus(planId) {
  const { data: rows } = await supabase
    .from('payment_installments')
    .select('status')
    .eq('plan_id', planId);
  if (!rows?.length) return;
  const outstanding = rows.some(r => ['scheduled', 'processing', 'failed'].includes(r.status));
  if (!outstanding) {
    await supabase
      .from('payment_plans')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', planId)
      .neq('status', 'cancelled');
  }
}

/**
 * Record a succeeded installment PaymentIntent — writes a 'rental' payment and
 * marks the installment paid. Idempotent (keyed on payments.reference_id).
 */
export async function confirmInstallmentPayment(paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') throw bad(`Payment has not succeeded (status: ${pi.status})`);
  if (pi.metadata?.kind !== 'installment') throw bad('This payment is not an installment');

  const { booking_id: bookingId, installment_id: installmentId, plan_id: planId } = pi.metadata;

  const { data: existing } = await supabase
    .from('payments').select('id').eq('reference_id', pi.id).maybeSingle();
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
    notes: `Installment payment (plan ${planId || ''})`,
  });

  if (installmentId) {
    await supabase
      .from('payment_installments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_intent_id: pi.id, last_error: null })
      .eq('id', installmentId);
    if (planId) await rollUpPlanStatus(planId);
  }

  createNotification(
    'installment_paid',
    `Installment paid: $${amountDollars.toFixed(2)}`,
    `Booking ${pi.metadata.booking_code || ''} — installment charged to card on file`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: amountDollars, plan_id: planId }
  ).catch(() => {});

  return { success: true, amount: amountDollars };
}

/**
 * Charge a single installment off-session against the card on file.
 * Safe to call repeatedly — claims the row via a conditional status update.
 */
export async function chargeInstallment(installmentId, { actor = 'system' } = {}) {
  const { data: inst } = await supabase
    .from('payment_installments')
    .select('id, plan_id, booking_id, sequence, amount_cents, status, attempts')
    .eq('id', installmentId)
    .single();
  if (!inst) throw bad('Installment not found', 404);
  if (!['scheduled', 'failed'].includes(inst.status)) {
    throw bad(`This installment is not chargeable (status: ${inst.status})`);
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_code, stripe_payment_method_id, customers(stripe_customer_id, email)')
    .eq('id', inst.booking_id)
    .single();

  if (!booking?.stripe_payment_method_id || !booking.customers?.stripe_customer_id) {
    await supabase.from('payment_installments')
      .update({ status: 'failed', last_error: 'no_card_on_file', attempts: inst.attempts + 1 })
      .eq('id', installmentId);
    throw bad('No card on file — ask the customer to add a payment method in the portal.', 409);
  }

  // Claim to prevent a double charge if the cron overlaps a manual "charge now".
  const { data: claimed, error: claimErr } = await supabase
    .from('payment_installments')
    .update({ status: 'processing', attempts: inst.attempts + 1 })
    .eq('id', installmentId)
    .in('status', ['scheduled', 'failed'])
    .select('id');
  if (claimErr || !claimed?.length) throw bad('Installment is already being processed');

  try {
    const pi = await stripe.paymentIntents.create({
      amount: inst.amount_cents,
      currency: 'usd',
      customer: booking.customers.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `${brand.stripeDescriptionPrefix} — ${booking.booking_code} installment ${inst.sequence}`,
      metadata: {
        kind: 'installment',
        booking_id: booking.id,
        booking_code: booking.booking_code,
        plan_id: inst.plan_id,
        installment_id: inst.id,
        amount_cents: String(inst.amount_cents),
      },
    });

    if (pi.status === 'succeeded') {
      await confirmInstallmentPayment(pi.id);
      return { id: inst.id, status: 'paid', pi_id: pi.id };
    }

    // requires_action / processing (e.g. 3DS on an off-session card) — can't
    // complete without the customer. Flag for follow-up.
    await supabase.from('payment_installments')
      .update({ status: 'failed', payment_intent_id: pi.id, last_error: `requires_action:${pi.status}` })
      .eq('id', inst.id);
    return { id: inst.id, status: 'failed', reason: pi.status };
  } catch (err) {
    const reason = err?.code || err?.raw?.code || err.message;
    await supabase.from('payment_installments')
      .update({ status: 'failed', last_error: String(reason).slice(0, 500) })
      .eq('id', inst.id);
    createNotification(
      'installment_failed',
      `Installment charge failed: ${booking.booking_code}`,
      `Installment ${inst.sequence} ($${(inst.amount_cents / 100).toFixed(2)}) could not be charged: ${reason}`,
      `/bookings/${booking.id}`,
      { booking_id: booking.id, installment_id: inst.id, error: String(reason) }
    ).catch(() => {});
    return { id: inst.id, status: 'failed', reason: String(reason) };
  }
}

/**
 * Charge all installments that are due (scheduled + due_date <= today).
 * Called from cron. Returns a summary for observability.
 */
export async function processDueInstallments() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabase
    .from('payment_installments')
    .select('id')
    .eq('status', 'scheduled')
    .lte('due_date', today)
    .limit(100);
  if (error) return { error: error.message };
  if (!due?.length) return { processed: 0 };

  const results = [];
  for (const row of due) {
    try {
      results.push(await chargeInstallment(row.id, { actor: 'system' }));
    } catch (e) {
      results.push({ id: row.id, status: 'failed', reason: e.message });
    }
  }
  return { processed: results.length, results };
}

/** Cancel a plan and all of its remaining (unpaid) installments. */
export async function cancelPlan(planId, actor = 'admin') {
  const { data: plan } = await supabase.from('payment_plans').select('id, booking_id, status').eq('id', planId).single();
  if (!plan) throw bad('Plan not found', 404);
  if (plan.status === 'cancelled') return { ok: true, status: 'cancelled' };

  await supabase
    .from('payment_installments')
    .update({ status: 'cancelled' })
    .eq('plan_id', planId)
    .in('status', ['scheduled', 'failed']);

  await supabase
    .from('payment_plans')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', planId);

  createNotification(
    'payment_plan_cancelled',
    `Payment plan cancelled`,
    `Remaining installments were cancelled.`,
    `/bookings/${plan.booking_id}`,
    { booking_id: plan.booking_id, plan_id: planId, actor }
  ).catch(() => {});

  return { ok: true, status: 'cancelled' };
}
