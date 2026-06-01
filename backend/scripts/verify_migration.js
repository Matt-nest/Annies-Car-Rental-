import { supabase } from '../db/supabase.js';

// Verify new tables exist by querying them
const tables = ['vehicle_deposits', 'booking_addons', 'booking_deposits', 'incidentals', 'invoices', 'customer_disputes', 'toll_charges', 'checkin_records'];

for (const table of tables) {
  const { data, error } = await supabase.from(table).select('id').limit(1);
  console.log(`${table}: ${error ? '❌ ' + error.message : '✅ exists' + (data.length ? ` (${data.length} rows)` : ' (empty)')}`);
}

// Verify vehicle_deposits seed data
const { data: deposits, error: depErr } = await supabase
  .from('vehicle_deposits')
  .select('amount, vehicle_id')
  .order('amount', { ascending: false });

if (depErr) {
  console.log('\n❌ vehicle_deposits query failed:', depErr.message);
} else {
  console.log(`\n✅ vehicle_deposits: ${deposits.length} vehicles seeded`);
  const amounts = {};
  deposits.forEach(d => {
    const dollars = d.amount / 100;
    amounts[dollars] = (amounts[dollars] || 0) + 1;
  });
  Object.entries(amounts).forEach(([amt, count]) => console.log(`   $${amt} deposit: ${count} vehicles`));
}

// Verify new columns on bookings
const { data: booking, error: bErr } = await supabase
  .from('bookings')
  .select('has_unlimited_miles, has_unlimited_tolls, has_delivery, checkin_odometer, checkout_odometer, inspection_completed_at')
  .limit(1);

console.log(`\nbookings new columns: ${bErr ? '❌ ' + bErr.message : '✅ all present'}`);

// Verify lockbox_code on vehicles
const { data: vehicle, error: vErr } = await supabase
  .from('vehicles')
  .select('lockbox_code')
  .limit(1);

console.log(`vehicles.lockbox_code: ${vErr ? '❌ ' + vErr.message : '✅ present'}`);
