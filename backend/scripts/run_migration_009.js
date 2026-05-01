/**
 * Run Migration 009: Bonzah Insurance Integration — Phase 1 Foundation
 * Uses exec_ddl() for DDL/DML statements.
 *
 * Run: node backend/scripts/run_migration_009.js
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
  console.log('Migration 009: Bonzah Insurance Integration');
  console.log('============================================\n');

  // Test that exec_ddl exists
  try {
    await supabase.rpc('exec_ddl', { query: 'SELECT 1' });
    console.log('✓ exec_ddl function available\n');
  } catch (e) {
    console.error('✗ exec_ddl not found. Create it first.');
    process.exit(1);
  }

  // ── 1. Bonzah-specific booking columns (one at a time) ──
  console.log('Step 1: Add Bonzah columns to bookings');
  await ddl('Add bonzah_tier_id',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_tier_id TEXT`);
  await ddl('Add bonzah_quote_id',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_quote_id TEXT`);
  await ddl('Add bonzah_policy_no',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_policy_no TEXT`);
  await ddl('Add bonzah_premium_cents',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_premium_cents INTEGER`);
  await ddl('Add bonzah_markup_cents',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_markup_cents INTEGER`);
  await ddl('Add bonzah_total_charged_cents',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_total_charged_cents INTEGER`);
  await ddl('Add bonzah_coverage_json',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_coverage_json JSONB`);
  await ddl('Add bonzah_quote_expires_at',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_quote_expires_at TIMESTAMPTZ`);
  await ddl('Add bonzah_last_synced_at',
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonzah_last_synced_at TIMESTAMPTZ`);

  // Index for polling job
  await ddl('Create idx_bookings_bonzah_policy_active',
    `CREATE INDEX IF NOT EXISTS idx_bookings_bonzah_policy_active ON bookings (insurance_status, return_date) WHERE bonzah_policy_id IS NOT NULL`);

  // ── 2. bonzah_events audit table ──
  console.log('\nStep 2: Create bonzah_events table');
  await ddl('Create bonzah_events table',
    `CREATE TABLE IF NOT EXISTS bonzah_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      request_json JSONB,
      response_json JSONB,
      status_code INTEGER,
      duration_ms INTEGER,
      error_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await ddl('Create idx_bonzah_events_booking',
    `CREATE INDEX IF NOT EXISTS idx_bonzah_events_booking ON bonzah_events (booking_id, created_at DESC)`);
  await ddl('Create idx_bonzah_events_recent',
    `CREATE INDEX IF NOT EXISTS idx_bonzah_events_recent ON bonzah_events (created_at DESC)`);
  await ddl('Create idx_bonzah_events_errors',
    `CREATE INDEX IF NOT EXISTS idx_bonzah_events_errors ON bonzah_events (created_at DESC) WHERE error_text IS NOT NULL`);

  // ── 3. settings k/v table ──
  console.log('\nStep 3: Create settings table');
  await ddl('Create settings table',
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by UUID
    )`);

  await ddl('Create settings_set_updated_at function',
    `CREATE OR REPLACE FUNCTION settings_set_updated_at()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = now();
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql`);

  await ddl('Drop old settings trigger',
    `DROP TRIGGER IF EXISTS settings_updated_at ON settings`);

  await ddl('Create settings_updated_at trigger',
    `CREATE TRIGGER settings_updated_at
     BEFORE UPDATE ON settings
     FOR EACH ROW EXECUTE FUNCTION settings_set_updated_at()`);

  // ── 4. Seed defaults ──
  console.log('\nStep 4: Seed Bonzah default settings');

  // Use supabase client for INSERTs (exec_ddl may block DML)
  const seeds = [
    { key: 'bonzah_enabled', value: false },
    { key: 'bonzah_markup_percent', value: 10 },
    { key: 'bonzah_tiers', value: [
      { id: 'essential', label: 'Essential', coverages: ['cdw'], default: false, recommended: false },
      { id: 'standard', label: 'Standard', coverages: ['cdw', 'rcli', 'sli'], default: true, recommended: true },
      { id: 'complete', label: 'Complete', coverages: ['cdw', 'rcli', 'sli', 'pai'], default: false, recommended: false }
    ]},
    { key: 'bonzah_pai_excluded_states', value: [] },
    { key: 'bonzah_excluded_states', value: ['Michigan', 'New York', 'Pennsylvania'] }
  ];

  for (const seed of seeds) {
    const { error } = await supabase.from('settings').upsert(
      { key: seed.key, value: seed.value },
      { onConflict: 'key', ignoreDuplicates: true }
    );
    if (error) {
      console.log(`  ⚠ Seed ${seed.key}: ${error.message}`);
    } else {
      console.log(`  ✓ Seeded ${seed.key}`);
    }
  }

  // ── VERIFICATION ──
  console.log('\n============================================');
  console.log('VERIFICATION');
  console.log('============================================\n');

  // V1: Check bonzah columns on bookings
  console.log('V1: Bonzah columns on bookings');
  const { data: b1, error: be1 } = await supabase
    .from('bookings')
    .select('bonzah_tier_id, bonzah_quote_id, bonzah_premium_cents, bonzah_coverage_json')
    .limit(1);
  console.log(`  ${be1 ? '✗ ' + be1.message : '✓ All bonzah columns exist'}`);

  // V2: Check bonzah_events table
  console.log('V2: bonzah_events table');
  const { error: be2 } = await supabase.from('bonzah_events').select('id').limit(0);
  console.log(`  ${be2 ? '✗ ' + be2.message : '✓ Table exists and is queryable'}`);

  // V3: Check settings table + seeds
  console.log('V3: settings table');
  const { data: s1, error: se1 } = await supabase.from('settings').select('key, value');
  if (se1) {
    console.log(`  ✗ ${se1.message}`);
  } else {
    console.log(`  ✓ ${s1.length} settings rows:`);
    for (const r of s1) {
      console.log(`    ${r.key} = ${JSON.stringify(r.value)}`);
    }
  }

  console.log('\n✅ Migration 009 complete.');
}

main().catch(err => {
  console.error('\nMigration FAILED:', err.message);
  process.exit(1);
});
