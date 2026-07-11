import brand from '../config/brand.js';
import { supabase } from '../db/supabase.js';

const isJd = brand.name.toLowerCase().includes('jd coastal');
const codePrefix = isJd ? 'JDSTAGE' : 'ANNSTAGE';
const emailDomain = isJd ? 'jdcoastal.test' : 'annies.test';

const expectedBookings = [
  [`${codePrefix}-PENDING`, 'pending_approval'],
  [`${codePrefix}-PAYDUE`, 'approved'],
  [`${codePrefix}-ACTIVE`, 'active'],
  [`${codePrefix}-RETURN`, 'returned'],
  [`${codePrefix}-DONE`, 'completed'],
];

async function requireRows(label, query, minCount) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  if ((data || []).length < minCount) {
    throw new Error(`${label}: expected at least ${minCount}, found ${(data || []).length}`);
  }
  console.log(`OK ${label}: ${(data || []).length}`);
  return data || [];
}

async function main() {
  console.log(`Verifying ${brand.name} staging seed fixtures (${codePrefix})`);

  await requireRows(
    'vehicles',
    supabase.from('vehicles').select('id, vehicle_code, status').like('vehicle_code', `${codePrefix}-%`),
    3,
  );

  await requireRows(
    'customers',
    supabase.from('customers').select('id, email').like('email', `%@${emailDomain}`),
    4,
  );

  const bookings = await requireRows(
    'bookings',
    supabase
      .from('bookings')
      .select('id, booking_code, status, total_cost, payments(id), booking_deposits(id)')
      .like('booking_code', `${codePrefix}-%`),
    5,
  );

  const byCode = new Map(bookings.map((booking) => [booking.booking_code, booking]));
  for (const [code, status] of expectedBookings) {
    const booking = byCode.get(code);
    if (!booking) throw new Error(`bookings: missing ${code}`);
    if (booking.status !== status) {
      throw new Error(`bookings: ${code} expected status ${status}, found ${booking.status}`);
    }
    if (!booking.payments?.length) throw new Error(`bookings: ${code} missing payment ledger row`);
    if (!booking.booking_deposits?.length) throw new Error(`bookings: ${code} missing booking deposit row`);
    console.log(`OK booking ${code}: ${status}`);
  }

  await requireRows(
    'rental agreements',
    supabase
      .from('rental_agreements')
      .select('id, booking_id, bookings!inner(booking_code)')
      .like('bookings.booking_code', `${codePrefix}-%`),
    1,
  );

  await requireRows(
    'check-in records',
    supabase
      .from('checkin_records')
      .select('id, booking_id, bookings!inner(booking_code)')
      .like('bookings.booking_code', `${codePrefix}-%`),
    3,
  );

  await requireRows(
    'notification log',
    supabase.from('notification_log').select('id, booking_code, stage').like('booking_code', `${codePrefix}-%`),
    5,
  );

  console.log('\nStaging seed verification passed.');
}

main().catch((error) => {
  console.error(`Staging seed verification failed: ${error.message}`);
  process.exit(1);
});
