import { supabase } from '../db/supabase.js';

const TABLE = 'money_action_audit';

function isMissingAuditTable(error) {
  return error?.code === '42P01' || /money_action_audit/i.test(error?.message || '');
}

function actorFromReq(req) {
  const user = req?.user || {};
  return {
    actor_id: user.id || user.sub || null,
    actor_email: user.email || null,
  };
}

function normalizeAmountCents(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function toMoneyActionEntry(row) {
  return {
    id: row.id,
    actionKey: row.action_key,
    title: row.title,
    detail: row.detail || '',
    status: row.status,
    subject: row.metadata?.subject || row.metadata?.booking_code || '',
    amount: row.amount_cents == null ? null : row.amount_cents / 100,
    amountCents: row.amount_cents,
    currency: row.currency || 'USD',
    actorEmail: row.actor_email,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    paymentId: row.payment_id,
    depositId: row.deposit_id,
    invoiceId: row.invoice_id,
    planId: row.plan_id,
    installmentId: row.installment_id,
    metadata: row.metadata || {},
    at: row.created_at,
  };
}

export async function recordMoneyAction({
  req,
  actionKey,
  title,
  detail,
  status = 'completed',
  bookingId,
  customerId,
  paymentId,
  depositId,
  invoiceId,
  planId,
  installmentId,
  amountCents,
  currency = 'USD',
  metadata = {},
} = {}) {
  if (!actionKey || !title) return null;

  const payload = {
    action_key: actionKey,
    title,
    detail: detail || null,
    status,
    ...actorFromReq(req),
    booking_id: bookingId || null,
    customer_id: customerId || null,
    payment_id: paymentId || null,
    deposit_id: depositId || null,
    invoice_id: invoiceId || null,
    plan_id: planId || null,
    installment_id: installmentId || null,
    amount_cents: normalizeAmountCents(amountCents),
    currency,
    metadata: metadata || {},
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (isMissingAuditTable(error)) {
      console.warn('[MoneyAudit] money_action_audit table is missing; action was not persisted.');
      return null;
    }
    throw error;
  }

  return data ? toMoneyActionEntry(data) : null;
}

export async function safeRecordMoneyAction(args) {
  try {
    return await recordMoneyAction(args);
  } catch (error) {
    console.warn('[MoneyAudit] Failed to persist action:', error?.message || error);
    return null;
  }
}

export async function listMoneyActions({
  bookingId,
  customerId,
  actionKey,
  limit = 25,
} = {}) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 100));

  if (bookingId) query = query.eq('booking_id', bookingId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (actionKey) query = query.eq('action_key', actionKey);

  const { data, error } = await query;
  if (error) {
    if (isMissingAuditTable(error)) return { data: [], missingTable: true };
    throw error;
  }

  return { data: (data || []).map(toMoneyActionEntry), missingTable: false };
}
