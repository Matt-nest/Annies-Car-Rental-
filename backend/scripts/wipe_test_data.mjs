// One-shot pre-launch wipe. Preserves three named bookings + their dependents.
// Run from /Applications/Annies/backend with: node scripts/wipe_test_data.mjs
import { supabase } from '../db/supabase.js';

const PRESERVE_CODES = [
  'BK-20260412-4MZB',
  'BK-20260415-5WHS',
  'BK-20260423-BU6L',
];

async function count(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    if (error.message?.includes('Could not find the table')) return null;
    throw new Error(`${table} count failed: ${error.message}`);
  }
  return count ?? 0;
}

function isMissingTable(error) {
  return !!error?.message?.includes('Could not find the table');
}

async function main() {
  console.log('Resolving preserved bookings…');
  const { data: preserved, error: pErr } = await supabase
    .from('bookings')
    .select('id, customer_id, booking_code')
    .in('booking_code', PRESERVE_CODES);
  if (pErr) throw pErr;
  if (!preserved || preserved.length !== 3) {
    throw new Error(`Expected 3 preserved bookings, found ${preserved?.length ?? 0}: ${JSON.stringify(preserved)}`);
  }
  const preservedIds = preserved.map(b => b.id);
  const preservedCustomerIds = [...new Set(preserved.map(b => b.customer_id).filter(Boolean))];
  console.log('Preserved booking ids:', preservedIds);
  console.log('Preserved customer ids:', preservedCustomerIds);

  const tables = [
    'bookings', 'customers', 'payments', 'rental_agreements', 'booking_status_log',
    'booking_deposits', 'booking_addons', 'checkin_records', 'incidentals', 'invoices',
    'toll_charges', 'customer_disputes', 'damage_reports', 'messages', 'notifications',
    'monthly_inquiries', 'webhook_failures', 'blocked_dates', 'reviews',
  ];

  console.log('\n=== BEFORE ===');
  for (const t of tables) console.log(`  ${t.padEnd(22)} ${await count(t)}`);

  // Child tables — delete where booking_id NOT IN preserved
  const bookingChildren = [
    'checkin_records', 'customer_disputes', 'invoices', 'incidentals',
    'toll_charges', 'damage_reports', 'booking_addons', 'booking_deposits',
    'rental_agreements', 'booking_status_log', 'payments',
  ];
  for (const t of bookingChildren) {
    const { error } = await supabase.from(t).delete().not('booking_id', 'in', `(${preservedIds.map(id => `"${id}"`).join(',')})`);
    if (error) throw new Error(`${t} delete failed: ${error.message}`);
    console.log(`  ${t}: cleaned`);
  }

  // Bookings — delete those NOT in preserved
  {
    const { error } = await supabase.from('bookings').delete().not('id', 'in', `(${preservedIds.map(id => `"${id}"`).join(',')})`);
    if (error) throw new Error(`bookings delete failed: ${error.message}`);
    console.log('  bookings: cleaned');
  }

  // Wholesale wipes (nothing keyed to specific bookings)
  for (const t of ['messages', 'notifications', 'monthly_inquiries', 'webhook_failures']) {
    const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      if (isMissingTable(error)) { console.log(`  ${t}: (skipped — not a table)`); continue; }
      throw new Error(`${t} delete failed: ${error.message}`);
    }
    console.log(`  ${t}: wiped`);
  }

  // Customers — delete those not attached to a preserved booking
  if (preservedCustomerIds.length > 0) {
    const { error } = await supabase.from('customers').delete().not('id', 'in', `(${preservedCustomerIds.map(id => `"${id}"`).join(',')})`);
    if (error) throw new Error(`customers delete failed: ${error.message}`);
  } else {
    const { error } = await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`customers delete failed: ${error.message}`);
  }
  console.log('  customers: cleaned');

  console.log('\n=== AFTER ===');
  for (const t of tables) console.log(`  ${t.padEnd(22)} ${await count(t)}`);

  const { data: remaining } = await supabase
    .from('bookings')
    .select('booking_code, status, pickup_date, return_date')
    .order('pickup_date');
  console.log('\nRemaining bookings:');
  console.table(remaining);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
