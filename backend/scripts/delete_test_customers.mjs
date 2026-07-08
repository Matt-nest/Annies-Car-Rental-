#!/usr/bin/env node
/**
 * Delete test customers/bookings from ANNIE'S Supabase project only.
 *
 * Usage (from backend/ with Annie's service key in env):
 *   SUPABASE_URL=https://yrerxvuyeglrypeufjpy.supabase.co \
 *   SUPABASE_SERVICE_KEY=... \
 *   node scripts/delete_test_customers.mjs
 */
import 'dotenv/config';
import { purgeTestCustomers, getSupabaseProjectRef, ANNIES_PROJECT_REF } from '../services/testDataPurgeService.js';

async function main() {
  const ref = getSupabaseProjectRef();
  console.log(`Supabase project: ${ref || '(unset)'}`);
  console.log(`Expected Annie project: ${ANNIES_PROJECT_REF}`);

  const result = await purgeTestCustomers();

  console.log('\nDeleted customers:');
  console.table(result.deleted_customers);
  console.log('\nDeleted bookings:');
  console.table(result.deleted_bookings);
  console.log('\nRemoval counts:', result.counts);
  console.log('\nRemaining customers:');
  console.table(result.remaining_customers);
  console.log('\nRemaining bookings:');
  console.table((result.remaining_bookings || []).map(b => ({
    booking_code: b.booking_code,
    status: b.status,
    customer: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : '—',
    vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : '—',
  })));
}

main().catch((err) => {
  console.error('\nPurge failed:', err.message);
  process.exit(1);
});
