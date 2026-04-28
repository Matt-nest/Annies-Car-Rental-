import { supabase } from '../db/supabase.js';

/**
 * Fee schedule for mileage, late returns, and incidentals.
 */
export const FEE_SCHEDULE = {
  mileage_per_day: 200,         // free miles per day
  overage_per_mile: 34,         // cents per mile over
  smoking_fee: 15000,           // cents ($150)
  toll_violation_fee: 3500,     // cents ($35)
};

/**
 * Pure helper — calculate mileage overage from explicit inputs (no booking shape coupling).
 * 200 free miles per rental day; overage rate $0.34/mile; skip entirely when unlimited.
 *
 * Example: 2-day rental, check-in 100 mi, free allowance = 400 mi → return cap = 500 mi.
 * Returned at 600 mi → 100 mi × $0.34 = $34.00 overage fee.
 *
 * Returns:
 *   - totalMiles  number   miles driven (checkout - checkin)
 *   - freeMiles   number   rentalDays × 200 (or Infinity for unlimited)
 *   - overageMiles number  max(0, totalMiles - freeMiles); always 0 for unlimited
 *   - overageFee  number   overage cost in CENTS (consistent with rest of fee schedule)
 *   - overageFeeDollars number  same value as a USD float (matches admin UI display)
 *   - unlimitedMiles boolean  true if hasUnlimitedMiles=true
 */
export function calculateMileageOverageFromInputs({
  checkInOdometer,
  checkOutOdometer,
  rentalDays,
  hasUnlimitedMiles,
}) {
  const inOdo = Number(checkInOdometer);
  const outOdo = Number(checkOutOdometer);
  const days = Math.max(1, Number(rentalDays) || 1);

  if (!Number.isFinite(inOdo) || !Number.isFinite(outOdo)) {
    return { totalMiles: 0, freeMiles: 0, overageMiles: 0, overageFee: 0, overageFeeDollars: 0, noData: true };
  }

  const totalMiles = Math.max(0, outOdo - inOdo);
  const freeMiles = days * FEE_SCHEDULE.mileage_per_day;

  if (hasUnlimitedMiles) {
    return {
      totalMiles,
      freeMiles: Infinity,
      overageMiles: 0,
      overageFee: 0,
      overageFeeDollars: 0,
      unlimitedMiles: true,
    };
  }

  const overageMiles = Math.max(0, totalMiles - freeMiles);
  const overageFee = overageMiles * FEE_SCHEDULE.overage_per_mile;
  return {
    totalMiles,
    freeMiles,
    overageMiles,
    overageFee,
    overageFeeDollars: overageFee / 100,
  };
}

/**
 * Calculate mileage overage for a booking.
 * Wraps the pure helper so existing callers continue to work.
 * Returns { totalMiles, freeMiles, allowedMiles (alias), overageMiles, overageFee } (fee in cents).
 */
export function calculateMileageOverage(booking) {
  const result = calculateMileageOverageFromInputs({
    checkInOdometer: booking.checkin_odometer || booking.pickup_mileage,
    checkOutOdometer: booking.checkout_odometer || booking.return_mileage,
    rentalDays: booking.rental_days || 1,
    hasUnlimitedMiles: booking.has_unlimited_miles || booking.unlimited_miles,
  });
  // Backward-compat alias: existing callers use `allowedMiles`
  return { ...result, allowedMiles: result.freeMiles };
}

/**
 * Calculate late return fee.
 * 1-4 hours late = half daily rate, 4+ hours = full daily rate.
 * Returns { hoursLate, fee } (fee in cents).
 */
export function calculateLateFee(booking) {
  const scheduledReturn = new Date(`${booking.return_date}T${booking.return_time || '10:00'}`);
  const actualReturn = booking.actual_return_at ? new Date(booking.actual_return_at) : null;

  if (!actualReturn) {
    return { hoursLate: 0, fee: 0, noData: true };
  }

  const diffMs = actualReturn - scheduledReturn;
  if (diffMs <= 0) {
    return { hoursLate: 0, fee: 0 };
  }

  const hoursLate = diffMs / (1000 * 60 * 60);
  const dailyRateCents = Math.round(Number(booking.daily_rate) * 100);

  let fee;
  if (hoursLate < 1) {
    fee = 0; // Grace period within 1 hour
  } else if (hoursLate <= 4) {
    fee = Math.round(dailyRateCents / 2);
  } else {
    fee = dailyRateCents;
  }

  return { hoursLate: Math.round(hoursLate * 10) / 10, fee };
}

/**
 * Calculate full deposit settlement.
 * Sums all incidentals, compares against deposit.
 * Returns breakdown for admin review.
 */
export async function calculateDepositSettlement(bookingId) {
  // Fetch incidentals for this booking
  const { data: incidentals, error } = await supabase
    .from('incidentals')
    .select('*')
    .eq('booking_id', bookingId);

  if (error) throw error;

  // Fetch deposit
  const { data: deposit } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const depositAmount = deposit?.amount || 0;

  // Calculate totals (skip waived items)
  const activeIncidentals = (incidentals || []).filter(i => !i.waived);
  const incidentalTotal = activeIncidentals.reduce((sum, i) => sum + i.amount, 0);

  const netRefund = Math.max(0, depositAmount - incidentalTotal);
  const amountOwed = Math.max(0, incidentalTotal - depositAmount);

  return {
    depositAmount,
    incidentals: incidentals || [],
    activeIncidentals,
    incidentalTotal,
    netRefund,
    amountOwed,
    hasCharges: incidentalTotal > 0,
    customerOwes: amountOwed > 0,
    lineItems: activeIncidentals.map(i => ({
      type: i.type,
      description: i.description || i.type.replace(/_/g, ' '),
      amount: i.amount,
    })),
  };
}

/**
 * Perform inspection and finalize all post-return charges.
 * Admin submits odometer, photos, and selected incidentals.
 * This creates incidental records and calculates the settlement.
 */
export async function performInspection(bookingId, {
  checkoutOdometer,
  fuelLevel,
  conditionNotes,
  photoUrls = [],
  incidentals = [],
  inspectedBy,
} = {}) {
  // Save the inspection as a checkin_record
  await supabase.from('checkin_records').insert({
    booking_id: bookingId,
    record_type: 'admin_inspection',
    odometer: checkoutOdometer,
    fuel_level: fuelLevel,
    condition_notes: conditionNotes,
    photo_urls: photoUrls,
    created_by: inspectedBy || 'admin',
  });

  // Update booking with inspection data
  const updateFields = {
    inspection_completed_at: new Date().toISOString(),
    inspection_completed_by: inspectedBy,
  };
  if (checkoutOdometer) updateFields.checkout_odometer = checkoutOdometer;

  await supabase
    .from('bookings')
    .update(updateFields)
    .eq('id', bookingId);

  // Create incidental records in bulk
  if (incidentals?.length > 0) {
    const incidentalRecords = incidentals.map(item => ({
      booking_id: bookingId,
      type: item.type,
      amount: item.amount,
      description: item.description,
      photo_urls: item.photoUrls || [],
      waived: item.waived || false,
      created_by: inspectedBy || 'admin',
    }));
    await supabase.from('incidentals').insert(incidentalRecords);
  }

  // Auto-calculate mileage and late fees if not already included
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('id', bookingId)
    .single();

  if (booking) {
    const hasType = (type) => incidentals.some(i => i.type === type);

    if (!hasType('mileage_overage') && checkoutOdometer) {
      const { overageFee, overageMiles } = calculateMileageOverage({
        ...booking,
        checkout_odometer: checkoutOdometer,
      });
      if (overageFee > 0) {
        await supabase.from('incidentals').insert({
          booking_id: bookingId,
          type: 'mileage_overage',
          amount: overageFee,
          description: `${overageMiles} miles over limit @ $${(FEE_SCHEDULE.overage_per_mile / 100).toFixed(2)}/mi`,
          created_by: inspectedBy || 'system',
        });
      }
    }

    if (!hasType('late_return')) {
      const { fee, hoursLate } = calculateLateFee(booking);
      if (fee > 0) {
        await supabase.from('incidentals').insert({
          booking_id: bookingId,
          type: 'late_return',
          amount: fee,
          description: `${hoursLate} hours late — ${fee >= Math.round(Number(booking.daily_rate) * 100) ? 'full' : 'half'} day rate`,
          created_by: inspectedBy || 'system',
        });
      }
    }
  }

  // Calculate the final settlement
  return calculateDepositSettlement(bookingId);
}
