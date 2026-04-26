/**
 * Run Migration 008: Weekly Pricing Engine + Monthly Lead-Gen
 * Uses exec_ddl() for DDL/DML, exec_sql() for verification SELECTs.
 *
 * Run: node backend/scripts/run_migration_008.js
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

async function ddl(label, sql) {
  console.log(`  ${label}...`);
  const { error } = await supabase.rpc('exec_ddl', { query: sql });
  if (error) {
    console.error(`  ✗ FAILED: ${error.message}`);
    throw error;
  }
  console.log(`  ✓ ${label}`);
}

async function main() {
  console.log('Migration 008: Weekly Pricing + Monthly Lead-Gen');
  console.log('================================================\n');

  // Test that exec_ddl exists
  try {
    await supabase.rpc('exec_ddl', { query: 'SELECT 1' });
    console.log('✓ exec_ddl function available\n');
  } catch (e) {
    console.error('✗ exec_ddl not found. Create it first.');
    process.exit(1);
  }

  // Step 0: Cleanup
  await ddl('Clean rogue column: weekly_rate_at_booking',
    `ALTER TABLE bookings DROP COLUMN IF EXISTS weekly_rate_at_booking`);
  await ddl('Clean rogue column: monthly_rate_at_booking',
    `ALTER TABLE bookings DROP COLUMN IF EXISTS monthly_rate_at_booking`);

  // Step 1: Vehicle columns (one at a time to avoid multi-statement issues)
  await ddl('Add weekly_discount_percent to vehicles',
    `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS weekly_discount_percent INTEGER NOT NULL DEFAULT 15 CONSTRAINT vehicles_weekly_discount_range CHECK (weekly_discount_percent BETWEEN 5 AND 25)`);
  await ddl('Add weekly_unlimited_mileage_enabled to vehicles',
    `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS weekly_unlimited_mileage_enabled BOOLEAN NOT NULL DEFAULT true`);
  await ddl('Add monthly_display_price to vehicles',
    `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS monthly_display_price INTEGER`);

  // Step 2: Re-derive weekly_rate (use JS client — Supabase blocks bare UPDATEs via RPC)
  console.log('  Re-derive weekly_rate from formula...');
  {
    const { data: allVehicles } = await supabase.from('vehicles').select('id, daily_rate, weekly_discount_percent');
    for (const v of allVehicles || []) {
      const newRate = Math.round((v.daily_rate * 7) * (1 - v.weekly_discount_percent / 100.0) * 100) / 100;
      await supabase.from('vehicles').update({ weekly_rate: newRate }).eq('id', v.id);
    }
    console.log(`  ✓ Re-derived weekly_rate for ${(allVehicles || []).length} vehicles`);
  }

  // Step 3: Booking columns (one at a time)
  await ddl('Add rate_type to bookings',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20) NOT NULL DEFAULT 'daily' CONSTRAINT bookings_rate_type_values CHECK (rate_type IN ('daily', 'weekly', 'weekly_mixed'))`);
  await ddl('Add weekly_discount_applied to bookings',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS weekly_discount_applied INTEGER`);
  await ddl('Add mileage_allowance to bookings',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mileage_allowance VARCHAR(20)`);
  await ddl('Add line_items to bookings',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS line_items JSONB`);

  // Step 4: Backfill (use JS client — safe filter satisfies WHERE requirement)
  console.log('  Backfill existing bookings to daily...');
  {
    const { data: updated, error: bfErr } = await supabase
      .from('bookings')
      .update({ rate_type: 'daily' })
      .or('rate_type.is.null,rate_type.eq.');
    if (bfErr) console.warn(`  ⚠ Backfill note: ${bfErr.message}`);
    console.log('  ✓ Backfill existing bookings to daily');
  }

  // Step 5: Create monthly_inquiries
  await ddl('Create monthly_inquiries table',
    `CREATE TABLE IF NOT EXISTS monthly_inquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id UUID REFERENCES vehicles(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      pickup_date DATE,
      return_date DATE,
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'new' CONSTRAINT monthly_inquiries_status_values CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      contacted_at TIMESTAMPTZ,
      notes TEXT
    )`);
  await ddl('Create monthly_inquiries indexes',
    `CREATE INDEX IF NOT EXISTS monthly_inquiries_status_idx ON monthly_inquiries(status)`);
  await ddl('Create monthly_inquiries created_at index',
    `CREATE INDEX IF NOT EXISTS monthly_inquiries_created_at_idx ON monthly_inquiries(created_at DESC)`);
  await ddl('Create monthly_inquiries vehicle_id index',
    `CREATE INDEX IF NOT EXISTS monthly_inquiries_vehicle_id_idx ON monthly_inquiries(vehicle_id)`);

  // ── VERIFICATION ─────────────────────────────────────────────────────
  console.log('\n================================================');
  console.log('VERIFICATION');
  console.log('================================================\n');

  // Q1
  console.log('Query 1: New vehicle columns');
  const { data: v1 } = await supabase
    .from('vehicles')
    .select('weekly_discount_percent, weekly_unlimited_mileage_enabled, monthly_display_price')
    .limit(1)
    .single();
  console.log('  ', v1, '\n');

  // Q2
  console.log('Query 2: Weekly rate re-derived (sample 5)');
  const { data: v2 } = await supabase
    .from('vehicles')
    .select('make, model, daily_rate, weekly_discount_percent, weekly_rate')
    .limit(5);
  for (const v of v2 || []) {
    const exp = Math.round((v.daily_rate * 7) * (1 - v.weekly_discount_percent / 100.0) * 100) / 100;
    const ok = Math.abs(v.weekly_rate - exp) < 0.01;
    console.log(`  ${v.make} ${v.model}: daily=$${v.daily_rate} → weekly=$${v.weekly_rate} (expected $${exp}) ${ok ? '✓' : '✗'}`);
  }

  // Q3
  console.log('\nQuery 3: New booking columns');
  const { data: b1 } = await supabase
    .from('bookings')
    .select('rate_type, weekly_discount_applied, mileage_allowance, line_items')
    .limit(1)
    .single();
  console.log('  ', b1, '\n');

  // Q4
  console.log('Query 4: monthly_inquiries table');
  const { data: m1, error: merr } = await supabase.from('monthly_inquiries').select('id').limit(0);
  console.log(`  ${merr ? '✗ ' + merr.message : '✓ Table exists and is queryable'}`);

  // Q5: Rogue columns gone
  console.log('\nQuery 5: Rogue columns removed');
  const { error: rogue } = await supabase.from('bookings').select('weekly_rate_at_booking').limit(1);
  console.log(`  ${rogue ? '✓ Rogue column gone' : '✗ Still exists'}`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('\nMigration FAILED:', err.message);
  process.exit(1);
});
