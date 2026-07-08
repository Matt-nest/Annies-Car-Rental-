import { supabase } from '../db/supabase.js';
import { squareRequest } from '../utils/square.js';
import { getStripe } from '../utils/stripe.js';

const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || 'square').toLowerCase();

function isMissingTable(error) {
  return !!error?.message?.includes('Could not find the table');
}

async function countForCustomer(customerId) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_code')
    .eq('customer_id', customerId);

  const bookingIds = (bookings || []).map(b => b.id);
  const bookingCodes = (bookings || []).map(b => b.booking_code);

  const countTable = async (table, filter) => {
    try {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      q = filter(q, bookingIds, bookingCodes);
      const { count, error } = await q;
      if (error) {
        if (isMissingTable(error)) return 0;
        throw error;
      }
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [
    messages,
    reviews,
    payments,
    agreements,
    deposits,
    monthly_inquiries,
  ] = await Promise.all([
    countTable('messages', (q) => q.eq('customer_id', customerId)),
    countTable('reviews', (q) => q.eq('customer_id', customerId)),
    countTable('payments', (q, ids) => ids.length ? q.in('booking_id', ids) : q.eq('booking_id', '00000000-0000-0000-0000-000000000000')),
    countTable('rental_agreements', (q, ids) => ids.length ? q.in('booking_id', ids) : q.eq('booking_id', '00000000-0000-0000-0000-000000000000')),
    countTable('booking_deposits', (q, ids) => ids.length ? q.in('booking_id', ids) : q.eq('booking_id', '00000000-0000-0000-0000-000000000000')),
    supabase.from('customers').select('email').eq('id', customerId).single().then(async ({ data }) => {
      if (!data?.email) return 0;
      const { count, error } = await supabase
        .from('monthly_inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('email', data.email);
      if (error && isMissingTable(error)) return 0;
      if (error) throw error;
      return count ?? 0;
    }),
  ]);

  return {
    bookings: bookingIds.length,
    booking_codes: bookingCodes,
    messages,
    reviews,
    payments,
    agreements,
    deposits,
    monthly_inquiries,
  };
}

async function deleteByBookingIds(table, bookingIds) {
  if (!bookingIds.length) return 0;
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in('booking_id', bookingIds);
  if (error) {
    if (isMissingTable(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

async function deletePendingOverageForBookings(bookingIds) {
  if (!bookingIds.length) return 0;
  const { data: charges, error } = await supabase
    .from('pending_overage_charges')
    .select('id')
    .in('booking_id', bookingIds);
  if (error) {
    if (isMissingTable(error)) return 0;
    throw error;
  }
  const chargeIds = (charges || []).map(c => c.id);
  if (chargeIds.length) {
    const { error: logErr } = await supabase.from('pending_overage_charge_log').delete().in('charge_id', chargeIds);
    if (logErr && !isMissingTable(logErr)) throw logErr;
  }
  return deleteByBookingIds('pending_overage_charges', bookingIds);
}

async function collectStoragePaths(customer, bookingIds) {
  const paths = new Set();
  if (customer.id_photo_url && !String(customer.id_photo_url).startsWith('http')) {
    paths.add(customer.id_photo_url);
  }
  if (!bookingIds.length) return paths;

  const { data: agreements } = await supabase
    .from('rental_agreements')
    .select('license_photo_paths')
    .in('booking_id', bookingIds);

  for (const ag of agreements || []) {
    for (const p of ag.license_photo_paths || []) {
      if (p && !String(p).startsWith('http')) paths.add(p);
    }
  }
  return paths;
}

async function deleteExternalPaymentCustomer(customer) {
  if (!customer.stripe_customer_id) return false;
  try {
    if (PAYMENT_PROVIDER === 'square') {
      await squareRequest(`/v2/customers/${customer.stripe_customer_id}`, { method: 'DELETE' });
      return true;
    }
    if (PAYMENT_PROVIDER === 'stripe') {
      const stripe = getStripe();
      if (stripe) {
        await stripe.customers.del(customer.stripe_customer_id);
        return true;
      }
    }
  } catch (err) {
    console.warn(`[deleteCustomer] External payment customer cleanup failed for ${customer.id}:`, err.message);
  }
  return false;
}

/** Preview what will be removed when deleting a customer profile. */
export async function getCustomerDeletionPreview(customerId) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, created_at')
    .eq('id', customerId)
    .single();

  if (error) throw error;
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const counts = await countForCustomer(customerId);
  return { customer, counts };
}

/**
 * Permanently delete a customer and every related record (bookings, payments,
 * messages, reviews, agreements, deposits, storage files, etc.).
 */
export async function deleteCustomerCompletely(customerId, { actorEmail } = {}) {
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (cErr) throw cErr;
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_code')
    .eq('customer_id', customerId);

  const bookingIds = (bookings || []).map(b => b.id);
  const bookingCodes = (bookings || []).map(b => b.booking_code);
  const storagePaths = await collectStoragePaths(customer, bookingIds);

  const deleted = {
    bookings: 0,
    messages: 0,
    reviews: 0,
    monthly_inquiries: 0,
    storage_files: 0,
    external_customer: false,
  };

  if (bookingIds.length) {
    await deletePendingOverageForBookings(bookingIds);

    const bookingChildTables = [
      'payment_installments',
      'payment_plans',
      'customer_disputes',
      'checkin_records',
      'incidentals',
      'invoices',
      'toll_charges',
      'damage_reports',
      'booking_addons',
      'booking_deposits',
      'rental_agreements',
      'rental_extensions',
      'booking_status_log',
      'payments',
      'bonzah_events',
      'webhook_failures',
    ];

    for (const table of bookingChildTables) {
      await deleteByBookingIds(table, bookingIds);
    }

    // Bouncie trips linked to these bookings (column may not exist in all envs)
    try {
      await supabase.from('bouncie_trips').delete().in('annie_booking_id', bookingIds);
    } catch { /* non-fatal */ }

    if (bookingCodes.length) {
      const { error: nlErr } = await supabase.from('notification_log').delete().in('booking_code', bookingCodes);
      if (nlErr && !isMissingTable(nlErr)) throw nlErr;
    }

    const { count: bookingCount, error: bDelErr } = await supabase
      .from('bookings')
      .delete({ count: 'exact' })
      .eq('customer_id', customerId);
    if (bDelErr) throw bDelErr;
    deleted.bookings = bookingCount ?? bookingIds.length;
  }

  const { count: msgCount, error: msgErr } = await supabase
    .from('messages')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId);
  if (msgErr) throw msgErr;
  deleted.messages = msgCount ?? 0;

  const { count: revCount, error: revErr } = await supabase
    .from('reviews')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId);
  if (revErr && !isMissingTable(revErr)) throw revErr;
  deleted.reviews = revCount ?? 0;

  if (customer.email) {
    const { count: inqCount, error: inqErr } = await supabase
      .from('monthly_inquiries')
      .delete({ count: 'exact' })
      .eq('email', customer.email);
    if (inqErr && !isMissingTable(inqErr)) throw inqErr;
    deleted.monthly_inquiries = inqCount ?? 0;
  }

  deleted.external_customer = await deleteExternalPaymentCustomer(customer);

  if (storagePaths.size) {
    const paths = [...storagePaths];
    const { error: stErr } = await supabase.storage.from('id-photos').remove(paths);
    if (!stErr) deleted.storage_files = paths.length;
    else console.warn(`[deleteCustomer] Storage cleanup failed for ${customerId}:`, stErr.message);
  }

  const { error: delErr } = await supabase.from('customers').delete().eq('id', customerId);
  if (delErr) throw delErr;

  console.log(`[deleteCustomer] ${customerId} deleted by ${actorEmail || 'unknown'}:`, deleted);
  return { success: true, customer_id: customerId, deleted };
}
