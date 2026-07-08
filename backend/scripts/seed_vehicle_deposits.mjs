// Seed vehicle_deposits for all active fleet vehicles.
// Run: node scripts/seed_vehicle_deposits.mjs
import { supabase } from '../db/supabase.js';

const DEFAULT_CENTS = 15000; // $150

async function main() {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, make, model, year, vehicle_code, status')
    .neq('status', 'retired');

  if (error) throw error;
  console.log(`Found ${vehicles.length} vehicles`);

  let seeded = 0;
  for (const v of vehicles) {
    const amount = DEFAULT_CENTS;
    const { error: upsertErr } = await supabase
      .from('vehicle_deposits')
      .upsert({ vehicle_id: v.id, amount }, { onConflict: 'vehicle_id' });
    if (upsertErr) throw upsertErr;

    await supabase
      .from('vehicles')
      .update({ deposit_amount: amount / 100 })
      .eq('id', v.id);

    console.log(`  ${v.vehicle_code} ${v.year} ${v.make} ${v.model} → $${(amount / 100).toFixed(2)}`);
    seeded++;
  }

  // Backfill deposit_amount on active bookings that have $0 snapshot
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_code, vehicle_id, deposit_amount, status')
    .in('status', ['approved', 'confirmed', 'ready_for_pickup', 'active', 'returned'])
    .or('deposit_amount.is.null,deposit_amount.eq.0');

  for (const b of bookings || []) {
    const { data: vd } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', b.vehicle_id)
      .maybeSingle();
    const cents = vd?.amount || DEFAULT_CENTS;
    await supabase
      .from('bookings')
      .update({ deposit_amount: cents / 100 })
      .eq('id', b.id);
    console.log(`  booking ${b.booking_code} deposit_amount → $${(cents / 100).toFixed(2)}`);
  }

  console.log(`\nDone. Seeded ${seeded} vehicle deposits.`);
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
