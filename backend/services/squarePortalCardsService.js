/**
 * squarePortalCardsService — customer wallet (cards on file) for the account
 * portal. Independent of FEATURE_AUTO_OVERAGE_CHARGES (that flag governs the
 * automatic post-rental overage charges; the wallet should work whenever Square
 * is the active processor). All functions operate on an Annie's customer row and
 * map to a Square Customer + its saved cards.
 */
import crypto from 'crypto';
import { getSquare, getSquareLocationId } from '../utils/square.js';
import { IS_SQUARE } from '../utils/paymentProvider.js';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';

const square = getSquare();

function assertSquare() {
  if (!IS_SQUARE) {
    throw Object.assign(new Error('Card wallet is only available with Square'), { status: 400 });
  }
}

/** Get the customer row (id, name, contact, square_customer_id). */
async function getCustomerRow(customerId) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, square_customer_id')
    .eq('id', customerId)
    .single();
  if (error || !data) throw Object.assign(new Error('Customer not found'), { status: 404 });
  return data;
}

/** Get-or-create the Square Customer for this person; persists the id. */
export async function ensurePortalSquareCustomer(customerId) {
  assertSquare();
  const customer = await getCustomerRow(customerId);
  if (customer.square_customer_id) return customer.square_customer_id;

  const resp = await square.customers.create({
    idempotencyKey: crypto.randomUUID(),
    givenName: customer.first_name || undefined,
    familyName: customer.last_name || undefined,
    emailAddress: customer.email || undefined,
    phoneNumber: customer.phone || undefined,
    referenceId: customer.id,
  });
  const squareCustomerId = resp.customer?.id;
  if (!squareCustomerId) throw Object.assign(new Error('Could not create payment profile'), { status: 502 });

  await supabase.from('customers').update({ square_customer_id: squareCustomerId }).eq('id', customer.id);
  return squareCustomerId;
}

function toCardSummary(card) {
  return {
    id: card.id,
    brand: card.cardBrand || 'Card',
    last4: card.last4 || '••••',
    exp_month: card.expMonth != null ? Number(card.expMonth) : null,
    exp_year: card.expYear != null ? Number(card.expYear) : null,
    cardholder_name: card.cardholderName || null,
  };
}

/** List the customer's enabled saved cards. Returns [] if no Square customer. */
export async function listCards(customerId) {
  assertSquare();
  const customer = await getCustomerRow(customerId);
  if (!customer.square_customer_id) return [];

  const cards = [];
  try {
    const page = await square.cards.list({ customerId: customer.square_customer_id });
    for await (const card of page) {
      if (card.enabled !== false) cards.push(toCardSummary(card));
    }
  } catch (err) {
    console.warn('[squarePortalCards] list failed:', err?.errors?.[0]?.detail || err.message);
  }
  return cards;
}

/**
 * Save a new card from a Web Payments SDK token (sourceId). Returns the card
 * summary. Creates the Square Customer on first card.
 */
export async function addCard(customerId, sourceId) {
  assertSquare();
  if (!sourceId) throw Object.assign(new Error('Missing card token'), { status: 400 });
  const squareCustomerId = await ensurePortalSquareCustomer(customerId);

  const resp = await square.cards.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId,
    card: { customerId: squareCustomerId, referenceId: customerId },
  });
  const card = resp.card;
  if (!card?.id) throw Object.assign(new Error('Could not save card'), { status: 502 });
  return toCardSummary(card);
}

/**
 * Remove (disable) a saved card. Verifies the card belongs to this customer's
 * Square Customer before disabling so one account can't disable another's card.
 */
export async function removeCard(customerId, cardId) {
  assertSquare();
  const customer = await getCustomerRow(customerId);
  if (!customer.square_customer_id) {
    throw Object.assign(new Error('No saved cards'), { status: 404 });
  }

  // Ownership check
  const owned = await listCards(customerId);
  if (!owned.some((c) => c.id === cardId)) {
    throw Object.assign(new Error('Card not found on this account'), { status: 404 });
  }

  await square.cards.disable({ cardId });
  return { ok: true };
}

// ── Self-pay a trip balance ──────────────────────────────────────────────────
// Invoice statuses a customer is allowed to pay against (not draft, not paid).
const PAYABLE_INVOICE_STATUSES = new Set(['sent', 'overdue', 'disputed']);

/**
 * Server-authoritative outstanding balance for one of the customer's bookings.
 * Returns { has_balance, amount_cents, invoice_id, status }. The amount comes
 * from the invoice (never the client) so a tampered request can't change it.
 */
export async function getTripBalance(customerId, bookingId) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id')
    .eq('id', bookingId)
    .single();
  if (!booking || booking.customer_id !== customerId) {
    throw Object.assign(new Error('Trip not found'), { status: 404 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, amount_due, status')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const amount = invoice ? Number(invoice.amount_due || 0) : 0;
  const payable = invoice && PAYABLE_INVOICE_STATUSES.has(invoice.status) && amount > 0;

  return {
    has_balance: !!payable,
    amount_cents: payable ? amount : 0,
    invoice_id: invoice?.id || null,
    status: invoice?.status || null,
  };
}

/**
 * Charge a trip's outstanding invoice balance to a saved card or a one-time
 * Web Payments token. Amount is recomputed server-side. Records a `balance`
 * payment row and marks the invoice paid.
 */
export async function chargeTripBalance(customerId, bookingId, { savedCardId, sourceId } = {}) {
  assertSquare();

  const balance = await getTripBalance(customerId, bookingId);
  if (!balance.has_balance) {
    throw Object.assign(new Error('No balance is due on this trip'), { status: 400 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_code')
    .eq('id', bookingId)
    .single();

  const customer = await getCustomerRow(customerId);

  // Resolve the payment source.
  let chargeSource;
  let squareCustomerId;
  if (savedCardId) {
    const owned = await listCards(customerId);
    if (!owned.some((c) => c.id === savedCardId)) {
      throw Object.assign(new Error('Card not found on this account'), { status: 404 });
    }
    chargeSource = savedCardId;
    squareCustomerId = customer.square_customer_id; // required for saved-card charges
  } else if (sourceId) {
    chargeSource = sourceId;
  } else {
    throw Object.assign(new Error('Select a card to pay with'), { status: 400 });
  }

  const resp = await square.payments.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId: chargeSource,
    customerId: squareCustomerId || undefined,
    amountMoney: { amount: BigInt(balance.amount_cents), currency: 'USD' },
    autocomplete: true,
    locationId: getSquareLocationId() || undefined,
    referenceId: booking.booking_code,
    note: `${brand.stripeDescriptionPrefix || brand.name} — ${booking.booking_code} balance`.slice(0, 500),
  });
  const payment = resp.payment;
  if (!payment?.id) throw Object.assign(new Error('Payment did not complete'), { status: 502 });

  const cardBrand = payment.cardDetails?.card?.cardBrand || null;
  const last4 = payment.cardDetails?.card?.last4 || null;
  const methodLabel = cardBrand ? `${cardBrand} ••${last4}` : 'card';

  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: balance.amount_cents / 100,
    payment_type: 'balance',
    method: 'square',
    reference_id: payment.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: `Portal balance payment — ${methodLabel}`,
  });

  await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', balance.invoice_id);

  return { ok: true, payment_id: payment.id, amount_cents: balance.amount_cents };
}
