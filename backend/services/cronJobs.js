import cron from 'node-cron';
import { supabase } from '../db/supabase.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';

const TZ = process.env.CRON_TIMEZONE || 'America/New_York';

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Send pickup reminders for bookings with pickup_date = tomorrow */
async function sendPickupReminders() {
  console.log('[CRON] Running sendPickupReminders');
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('pickup_date', tomorrow())
    .in('status', ['approved', 'confirmed']);

  if (error) { console.error('[CRON] pickupReminders error:', error); return; }

  for (const b of data || []) {
    sendBookingNotification('pickup_reminder', buildBookingPayload(b));
  }
  console.log(`[CRON] Sent ${data?.length || 0} pickup reminders`);
}

/** Send return reminders for active bookings with return_date = tomorrow */
async function sendReturnReminders() {
  console.log('[CRON] Running sendReturnReminders');
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('return_date', tomorrow())
    .eq('status', 'active');

  if (error) { console.error('[CRON] returnReminders error:', error); return; }

  for (const b of data || []) {
    sendBookingNotification('return_reminder', buildBookingPayload(b));
  }
  console.log(`[CRON] Sent ${data?.length || 0} return reminders`);
}

/** Flag overdue returns (return_date < today, status = active) */
async function flagOverdueReturns() {
  console.log('[CRON] Running flagOverdueReturns');
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .lt('return_date', today())
    .eq('status', 'active');

  if (error) { console.error('[CRON] overdueReturns error:', error); return; }

  for (const b of data || []) {
    console.warn(`[CRON] OVERDUE: ${b.booking_code} — ${b.customers?.first_name} ${b.customers?.last_name}`);
    sendBookingNotification('late_return_warning', buildBookingPayload(b));
  }
  console.log(`[CRON] Flagged ${data?.length || 0} overdue returns`);
}

/** Auto-expire unapproved bookings > 48 hours old */
async function autoExpireUnapproved() {
  console.log('[CRON] Running autoExpireUnapproved');
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 48h+ → auto-decline
  const { data: toDecline } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('status', 'pending_approval')
    .lt('created_at', cutoff48h);

  for (const b of toDecline || []) {
    await supabase.from('bookings').update({
      status: 'declined',
      decline_reason: 'No response — booking expired after 48 hours',
      owner_declined_at: new Date().toISOString(),
    }).eq('id', b.id);

    await supabase.from('booking_status_log').insert({
      booking_id: b.id,
      from_status: 'pending_approval',
      to_status: 'declined',
      changed_by: 'system',
      reason: 'Auto-expired after 48 hours with no owner response',
    });

    sendBookingNotification('booking_declined', buildBookingPayload({ ...b, status: 'declined' }));
    console.log(`[CRON] Auto-declined: ${b.booking_code}`);
  }

  // 24-48h → remind Annie
  const { data: toRemind } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('status', 'pending_approval')
    .lt('created_at', cutoff24h)
    .gte('created_at', cutoff48h);

  for (const b of toRemind || []) {
    console.log(`[CRON] Approval reminder for ${b.booking_code} — no template configured yet`);
  }
}

/** Send day-of-pickup SMS for bookings with pickup_date = today */
async function sendDayOfPickupReminders() {
  console.log('[CRON] Running sendDayOfPickupReminders');
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('pickup_date', today())
    .in('status', ['approved', 'confirmed']);

  if (error) { console.error('[CRON] dayOfPickup error:', error); return; }

  for (const b of data || []) {
    sendBookingNotification('day_of_pickup', buildBookingPayload(b));
  }
  console.log(`[CRON] Sent ${data?.length || 0} day-of-pickup reminders`);
}

export function startCronJobs() {
  // Daily at 7am ET — day-of-pickup reminders
  cron.schedule('0 7 * * *', sendDayOfPickupReminders, { timezone: TZ });

  // Daily at 9am ET — pickup and return reminders
  cron.schedule('0 9 * * *', sendPickupReminders, { timezone: TZ });
  cron.schedule('0 9 * * *', sendReturnReminders, { timezone: TZ });

  // Daily at 10am ET — flag overdue returns
  cron.schedule('0 10 * * *', flagOverdueReturns, { timezone: TZ });

  // Every 6 hours — check unapproved bookings
  cron.schedule('0 */6 * * *', autoExpireUnapproved, { timezone: TZ });

  console.log('[CRON] All jobs scheduled');
}
