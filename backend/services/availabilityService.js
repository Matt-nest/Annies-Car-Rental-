import { supabase } from '../db/supabase.js';

/**
 * Check if a vehicle is available for the given date range.
 * Returns { available: boolean, conflicts: [] }
 */
export async function checkAvailability(vehicleId, startDate, endDate, excludeBookingId = null) {
  const conflicts = [];

  // 1. Check for conflicting bookings
  // Exclude terminal off-the-road statuses — those bookings are no longer holding
  // the vehicle, and the bookings_terminal_return_date_not_future check constraint
  // guarantees their return_date already reflects reality. Belt-and-suspenders so a
  // terminal row can never ghost-block the calendar regardless of return_date.
  let bookingQuery = supabase
    .from('bookings')
    .select('id, booking_code, pickup_date, return_date, status, actual_pickup_at')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("declined","cancelled","returned","completed","no_show")')
    .lte('pickup_date', endDate)
    .gte('return_date', startDate);

  if (excludeBookingId) {
    bookingQuery = bookingQuery.neq('id', excludeBookingId);
  }

  const { data: bookingConflicts, error: bookingError } = await bookingQuery;
  if (bookingError) throw bookingError;

  // Belt-and-suspenders: ignore "stale unstarted" rows — approved/confirmed/
  // ready_for_pickup bookings whose pickup_date is already in the past with no
  // actual_pickup_at recorded. The customer never showed; the cron auto-no-show
  // job is the primary fix, but if it lags or fails these rows would otherwise
  // ghost-block the calendar. PRE_PICKUP_STATUSES is exactly the set that has
  // not yet held the vehicle.
  const todayStr = new Date().toISOString().slice(0, 10);
  const PRE_PICKUP_STATUSES = ['pending_approval', 'approved', 'confirmed', 'ready_for_pickup'];

  for (const b of bookingConflicts || []) {
    const isStaleUnstarted =
      PRE_PICKUP_STATUSES.includes(b.status) &&
      !b.actual_pickup_at &&
      b.pickup_date < todayStr;
    if (isStaleUnstarted) continue;

    conflicts.push({
      type: 'booking',
      booking_code: b.booking_code,
      pickup_date: b.pickup_date,
      return_date: b.return_date,
      status: b.status,
    });
  }

  // 2. Check for blocked dates
  const { data: blocked, error: blockedError } = await supabase
    .from('blocked_dates')
    .select('id, start_date, end_date, reason')
    .eq('vehicle_id', vehicleId)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (blockedError) throw blockedError;

  for (const b of blocked || []) {
    conflicts.push({
      type: 'blocked',
      reason: b.reason,
      start_date: b.start_date,
      end_date: b.end_date,
    });
  }

  return { available: conflicts.length === 0, conflicts };
}

/**
 * Get all available vehicles for a date range.
 */
export async function getAvailableVehicles(startDate, endDate) {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .neq('status', 'retired')
    .eq('status', 'available');

  if (error) throw error;

  // Batch: get ALL conflicting bookings for ANY vehicle in this range
  const { data: conflicts } = await supabase
    .from('bookings').select('vehicle_id, status, pickup_date, actual_pickup_at')
    .not('status', 'in', '("declined","cancelled","returned","completed","no_show")')
    .lte('pickup_date', endDate).gte('return_date', startDate);

  const { data: blocked } = await supabase
    .from('blocked_dates').select('vehicle_id')
    .lte('start_date', endDate).gte('end_date', startDate);

  // Same stale-unstarted exclusion as checkAvailability().
  const todayStr = new Date().toISOString().slice(0, 10);
  const PRE_PICKUP_STATUSES = ['pending_approval', 'approved', 'confirmed', 'ready_for_pickup'];
  const liveConflicts = (conflicts || []).filter(c => !(
    PRE_PICKUP_STATUSES.includes(c.status) && !c.actual_pickup_at && c.pickup_date < todayStr
  ));

  const conflictIds = new Set([
    ...liveConflicts.map(c => c.vehicle_id),
    ...(blocked || []).map(b => b.vehicle_id),
  ]);

  return (vehicles || []).filter(v => !conflictIds.has(v.id));
}
