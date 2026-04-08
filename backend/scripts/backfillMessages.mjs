/**
 * Backfill automated messages for all existing bookings.
 * 
 * This script looks at every booking's status_log history and creates
 * system messages for each status transition that would have triggered
 * a GHL webhook, so the messaging portal shows the full history.
 *
 * Usage: node backend/scripts/backfillMessages.mjs
 * 
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_MESSAGES = {
  pending_approval: 'New booking request submitted',
  approved: 'Booking approved — awaiting agreement & payment',
  confirmed: 'Booking confirmed — agreement signed & payment received',
  declined: 'Booking request declined',
  cancelled: 'Booking cancelled',
  active: 'Vehicle picked up — rental is active',
  returned: 'Vehicle returned — pending inspection',
  completed: 'Rental completed — thank you!',
};

async function main() {
  console.log('🔄 Backfilling messages for existing bookings...\n');

  // Get all bookings with their customers
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, status, created_at')
    .order('created_at', { ascending: true });

  if (bErr) { console.error('❌ Failed to fetch bookings:', bErr.message); process.exit(1); }
  console.log(`📋 Found ${bookings.length} bookings to process\n`);

  // Get all existing system messages to avoid duplicates
  const { data: existingMsgs } = await supabase
    .from('messages')
    .select('external_id')
    .like('external_id', 'backfill-%');

  const existingIds = new Set((existingMsgs || []).map(m => m.external_id));

  let created = 0;
  let skipped = 0;

  for (const booking of bookings) {
    // Get status log for this booking
    const { data: logs } = await supabase
      .from('booking_status_log')
      .select('to_status, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: true });

    if (!logs?.length) {
      // No status log — just create one for the current status
      const extId = `backfill-${booking.id}-${booking.status}`;
      if (existingIds.has(extId)) { skipped++; continue; }

      const msg = STATUS_MESSAGES[booking.status];
      if (!msg) continue;

      await supabase.from('messages').insert({
        customer_id: booking.customer_id,
        direction: 'outbound',
        channel: 'system',
        subject: msg,
        body: `[Auto] ${msg} — ${booking.booking_code}`,
        external_id: extId,
        metadata: { event: `booking.${booking.status}`, automated: true, backfilled: true },
        created_at: booking.created_at,
      });
      created++;
      continue;
    }

    // Create a message for each status transition
    for (const log of logs) {
      const msg = STATUS_MESSAGES[log.to_status];
      if (!msg) continue;

      const extId = `backfill-${booking.id}-${log.to_status}`;
      if (existingIds.has(extId)) { skipped++; continue; }

      await supabase.from('messages').insert({
        customer_id: booking.customer_id,
        direction: 'outbound',
        channel: 'system',
        subject: msg,
        body: `[Auto] ${msg} — ${booking.booking_code}`,
        external_id: extId,
        metadata: { event: `booking.${log.to_status}`, automated: true, backfilled: true },
        created_at: log.created_at,
      });
      created++;
    }
  }

  console.log(`\n✅ Done! Created: ${created} messages, Skipped: ${skipped} (already exist)`);
  
  // Summary
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });
  
  const { data: convos } = await supabase
    .from('messages')
    .select('customer_id')
    .then(({ data }) => {
      const uniqueIds = new Set((data || []).map(m => m.customer_id));
      return { data: uniqueIds };
    });

  console.log(`📊 Total messages in DB: ${count}`);
  console.log(`💬 Unique customer conversations: ${convos?.size || 'unknown'}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
