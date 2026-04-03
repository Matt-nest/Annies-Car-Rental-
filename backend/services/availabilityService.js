import { supabase } from '../db/supabase.js';

/**
 * Check if a vehicle is available for the given date range.
 * Returns { available: boolean, conflicts: [] }
 */
export async function checkAvailability(vehicleId, startDate, endDate, excludeBookingId = null) {
  const conflicts = [];

  // 1. Check for conflicting bookings
  let bookingQuery = supabase
    .from('bookings')
    .select('id, booking_code, pickup_date, return_date, status')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("declined","cancelled")')
    .lte('pickup_date', endDate)
    .gte('return_date', startDate);

  if (excludeBookingId) {
    bookingQuery = bookingQuery.neq('id', excludeBookingId);
  }

  const { data: bookingConflicts, error: bookingError } = await bookingQuery;
  if (bookingError) throw bookingError;

  for (const b of bookingConflicts || []) {
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
  // Get all non-retired vehicles
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .neq('status', 'retired')
    .eq('status', 'available');

  if (error) throw error;

  const available = [];
  for (const v of vehicles || []) {
    const { available: isAvail } = await checkAvailability(v.id, startDate, endDate);
    if (isAvail) available.push(v);
  }

  return available;
}
