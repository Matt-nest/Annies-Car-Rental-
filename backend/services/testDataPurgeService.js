import { supabase } from '../db/supabase.js';

/** Annie's production Supabase project — refuse purge on any other project. */
export const ANNIES_PROJECT_REF = 'yrerxvuyeglrypeufjpy';

const PRESERVE_BOOKING_CODES = ['BK-20260703-YRK9'];

const TEST_NAME_PATTERNS = [
  { first: 'alain', last: 'lusma' },
  { first: 'matthew', last: 'nestor' },
  { first: 'aaron', last: 'daniel' },
  { first: 'john', last: 'damiani' },
  { first: 'cursor', last: 'testbooking' },
];

const TEST_EMAIL_FRAGMENTS = [
  'alain', 'lusma', 'matthewnestor', 'aaron', 'damiani', 'cursortest',
];

const BOOKING_CHILD_TABLES = [
  'checkin_records',
  'customer_disputes',
  'invoices',
  'incidentals',
  'toll_charges',
  'damage_reports',
  'booking_addons',
  'booking_deposits',
  'rental_agreements',
  'booking_status_log',
  'payments',
];

export function getSupabaseProjectRef() {
  return process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
}

export function assertAnnieProject() {
  const ref = getSupabaseProjectRef();
  if (ref !== ANNIES_PROJECT_REF) {
    throw Object.assign(
      new Error(`Refusing test-data purge on Supabase project "${ref || 'unknown'}". Expected Annie's project "${ANNIES_PROJECT_REF}".`),
      { status: 403 }
    );
  }
}

async function findTestCustomers() {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email');
  if (error) throw error;

  const hits = new Map();
  for (const c of customers || []) {
    const fn = (c.first_name || '').toLowerCase();
    const ln = (c.last_name || '').toLowerCase();
    const em = (c.email || '').toLowerCase();

    const nameHit = TEST_NAME_PATTERNS.some(p =>
      fn.includes(p.first) && ln.includes(p.last)
    );
    const emailHit = TEST_EMAIL_FRAGMENTS.some(f => em.includes(f));
    const cursorHit = fn.includes('cursor') && ln.includes('test');

    if (nameHit || emailHit || cursorHit) {
      hits.set(c.id, c);
    }
  }
  return [...hits.values()];
}

async function findBookingsToDelete(customerIds) {
  const ids = new Set(customerIds);

  const { data: byCustomer, error: cErr } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, status')
    .in('customer_id', [...ids]);
  if (cErr) throw cErr;

  const { data: allBookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, status');
  if (bErr) throw bErr;

  const bookings = new Map();
  for (const b of [...(byCustomer || []), ...(allBookings || [])]) {
    if (PRESERVE_BOOKING_CODES.includes(b.booking_code)) continue;
    if (ids.has(b.customer_id)) bookings.set(b.id, b);
  }
  return [...bookings.values()];
}

async function deleteByBookingIds(bookingIds) {
  if (!bookingIds.length) return {};
  const inList = `(${bookingIds.map(id => `"${id}"`).join(',')})`;
  const removed = {};

  for (const table of BOOKING_CHILD_TABLES) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in('booking_id', bookingIds);
    if (error && !error.message?.includes('Could not find the table')) {
      throw new Error(`${table} delete failed: ${error.message}`);
    }
    removed[table] = count ?? 0;
  }

  const { error: bErr, count: bookingCount } = await supabase
    .from('bookings')
    .delete({ count: 'exact' })
    .in('id', bookingIds);
  if (bErr) throw new Error(`bookings delete failed: ${bErr.message}`);
  removed.bookings = bookingCount ?? 0;
  return removed;
}

async function deleteCustomers(customerIds) {
  if (!customerIds.length) return 0;
  const { error, count } = await supabase
    .from('customers')
    .delete({ count: 'exact' })
    .in('id', customerIds);
  if (error) throw new Error(`customers delete failed: ${error.message}`);
  return count ?? 0;
}

async function deleteCustomerMessages(customerIds) {
  if (!customerIds.length) return 0;
  const { error, count } = await supabase
    .from('messages')
    .delete({ count: 'exact' })
    .in('customer_id', customerIds);
  if (error && !error.message?.includes('Could not find the table')) {
    throw new Error(`messages delete failed: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteOrphanNotifications(deletedBookingIds, deletedNames) {
  const { data: notes, error } = await supabase
    .from('notifications')
    .select('id, title, message, metadata');
  if (error) throw error;

  const nameNeedles = deletedNames.map(n => `${n.first_name} ${n.last_name}`.toLowerCase());
  const orphanIds = (notes || [])
    .filter(n => {
      const metaBookingId = n.metadata?.booking_id;
      if (metaBookingId && deletedBookingIds.includes(metaBookingId)) return true;
      const blob = `${n.title || ''} ${n.message || ''}`.toLowerCase();
      return nameNeedles.some(needle => blob.includes(needle));
    })
    .map(n => n.id);

  if (!orphanIds.length) return 0;
  const { error: dErr, count } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .in('id', orphanIds);
  if (dErr) throw new Error(`notifications delete failed: ${dErr.message}`);
  return count ?? 0;
}

/**
 * Remove test customers/bookings from Annie's production database.
 * Safe to call from CLI script or owner-only admin route after deploy.
 */
export async function purgeTestCustomers() {
  assertAnnieProject();

  const customers = await findTestCustomers();
  const customerIds = customers.map(c => c.id);
  const bookings = await findBookingsToDelete(customerIds);
  const bookingIds = bookings.map(b => b.id);

  const childRemoved = await deleteByBookingIds(bookingIds);
  const messagesRemoved = await deleteCustomerMessages(customerIds);
  const customersRemoved = await deleteCustomers(customerIds);
  const notificationsRemoved = await deleteOrphanNotifications(bookingIds, customers);

  const { data: remainingCustomers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email')
    .order('created_at', { ascending: false });
  const { data: remainingBookings } = await supabase
    .from('bookings')
    .select('id, booking_code, status, customers(first_name, last_name), vehicles(year, make, model)')
    .order('created_at', { ascending: false });

  return {
    project_ref: getSupabaseProjectRef(),
    deleted_customers: customers.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
    })),
    deleted_bookings: bookings.map(b => ({
      id: b.id,
      booking_code: b.booking_code,
      status: b.status,
    })),
    counts: {
      customers: customersRemoved,
      bookings: childRemoved.bookings || 0,
      messages: messagesRemoved,
      notifications: notificationsRemoved,
      ...childRemoved,
    },
    remaining_customers: remainingCustomers || [],
    remaining_bookings: remainingBookings || [],
  };
}
