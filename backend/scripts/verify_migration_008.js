/**
 * Verify Migration 008 results.
 * Run: node backend/scripts/verify_migration_008.js
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function execSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  console.log('Verification: Migration 008\n');

  // Query 1: Check vehicle columns exist by reading a vehicle row
  console.log('Query 1: New vehicle columns');
  const { data: v1 } = await supabase
    .from('vehicles')
    .select('weekly_discount_percent, weekly_unlimited_mileage_enabled, monthly_display_price')
    .limit(1)
    .single();
  console.log('  Sample vehicle:', v1);
  console.log(`  weekly_discount_percent: ${v1?.weekly_discount_percent} (expect 15)`);
  console.log(`  weekly_unlimited_mileage_enabled: ${v1?.weekly_unlimited_mileage_enabled} (expect true)`);
  console.log(`  monthly_display_price: ${v1?.monthly_display_price} (expect null)\n`);

  // Query 2: Weekly rate re-derived
  console.log('Query 2: Weekly rate re-derived correctly (sample 5)');
  const { data: v2 } = await supabase
    .from('vehicles')
    .select('make, model, daily_rate, weekly_discount_percent, weekly_rate')
    .limit(5);
  for (const v of v2 || []) {
    const expected = Math.round((v.daily_rate * 7) * (1 - v.weekly_discount_percent / 100.0) * 100) / 100;
    const match = Math.abs(v.weekly_rate - expected) < 0.01;
    console.log(`  ${v.make} ${v.model}: daily=$${v.daily_rate}, discount=${v.weekly_discount_percent}%, weekly=$${v.weekly_rate}, expected=$${expected} ${match ? '✓' : '✗ MISMATCH'}`);
  }

  // Query 3: Check booking columns
  console.log('\nQuery 3: New booking columns');
  const { data: b1 } = await supabase
    .from('bookings')
    .select('rate_type, weekly_discount_applied, mileage_allowance, line_items')
    .limit(1)
    .single();
  console.log('  Sample booking:', b1);
  console.log(`  rate_type: '${b1?.rate_type}' (expect 'daily')`);
  console.log(`  weekly_discount_applied: ${b1?.weekly_discount_applied} (expect null)`);
  console.log(`  mileage_allowance: ${b1?.mileage_allowance} (expect null)`);
  console.log(`  line_items: ${b1?.line_items} (expect null)\n`);

  // Query 4: monthly_inquiries table exists
  console.log('Query 4: monthly_inquiries table exists');
  const { data: m1, error: m1err } = await supabase
    .from('monthly_inquiries')
    .select('*')
    .limit(0);
  if (m1err) {
    console.log(`  ✗ Table not found: ${m1err.message}`);
  } else {
    console.log('  ✓ Table exists and is queryable');
  }

  // Query 5: Rogue columns gone
  console.log('\nQuery 5: Rogue columns removed');
  const { data: b2, error: b2err } = await supabase
    .from('bookings')
    .select('weekly_rate_at_booking')
    .limit(1);
  if (b2err) {
    console.log('  ✓ weekly_rate_at_booking column does NOT exist (correct)');
  } else {
    console.log('  ✗ weekly_rate_at_booking still exists — cleanup failed');
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
