import 'dotenv/config';
import { supabase } from './supabase.js';

/**
 * Run database migrations and clear old data.
 * Uses the Supabase service role client (bypasses RLS).
 */
async function migrate() {
  console.log('══════════════════════════════════════════════');
  console.log('  Running database migrations');
  console.log('══════════════════════════════════════════════\n');

  // Step 1: Clear old data (order matters for FK constraints)
  console.log('  [1/3] Clearing old data...');
  const tables = ['booking_status_log', 'payments', 'damage_reports', 'bookings', 'customers', 'vehicles'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`    ⚠ ${table}: ${error.message}`);
    } else {
      console.log(`    ✓ Cleared ${table}`);
    }
  }

  // Step 2: Verify the tables exist (just check we can query them)
  console.log('\n  [2/3] Verifying table structure...');
  
  // Check vehicles table
  const { error: vErr } = await supabase.from('vehicles').select('id').limit(1);
  console.log(`    vehicles: ${vErr ? '✗ ' + vErr.message : '✓ exists'}`);

  // Check customers table for id_photo_url column
  const { error: cErr } = await supabase.from('customers').select('id, id_photo_url').limit(1);
  if (cErr && cErr.message.includes('id_photo_url')) {
    console.log('    customers.id_photo_url: ✗ MISSING — run migration 003 in SQL Editor');
  } else {
    console.log(`    customers.id_photo_url: ${cErr ? '⚠ ' + cErr.message : '✓ exists'}`);
  }

  // Check rental_agreements table
  const { error: aErr } = await supabase.from('rental_agreements').select('id').limit(1);
  if (aErr && (aErr.message.includes('does not exist') || aErr.code === '42P01')) {
    console.log('    rental_agreements: ✗ MISSING — run migration 004 in SQL Editor');
  } else {
    console.log(`    rental_agreements: ${aErr ? '⚠ ' + aErr.message : '✓ exists'}`);
  }

  console.log('\n  [3/3] Summary');
  console.log('    Old data cleared. Ready to seed with real fleet data.');
  console.log('══════════════════════════════════════════════\n');
}

migrate().catch(err => { console.error(err); process.exit(1); });
