import { supabase } from '../db/supabase.js';
import { computeRentalPricing, DELIVERY_FEES, hasPricingDateDrift, pricingDriftSummary, isBookingPricingLocked } from './pricingService.js';
import { getBookingDetail } from './bookingService.js';

/** Pricing columns that must stay in sync with pickup/return dates. */
export const PRICING_SNAPSHOT_FIELDS = [
  'rental_days',
  'rate_type',
  'weekly_discount_applied',
  'subtotal',
  'tax_amount',
  'total_cost',
  'mileage_allowance',
  'line_items',
  'daily_rate',
  'discount_amount',
  'delivery_fee',
  'mileage_addon_fee',
  'toll_addon_fee',
];

export { hasPricingDateDrift, pricingDriftSummary, isBookingPricingLocked } from './pricingService.js';

/** Rental payment captured — pricing is locked to what was charged. */
export async function isBookingRentalPaid(bookingId) {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('payment_type', 'rental')
    .eq('status', 'completed')
    .maybeSingle();
  return !!data;
}

function vehicleForRepricing(booking) {
  const v = booking.vehicles;
  if (v?.daily_rate != null) return v;
  return {
    daily_rate: Number(booking.daily_rate),
    weekly_discount_percent: booking.weekly_discount_applied ?? 15,
    weekly_unlimited_mileage_enabled: true,
  };
}

function buildPricingUpdate(booking, pickupDate, returnDate) {
  const vehicle = vehicleForRepricing(booking);
  const deliveryType = booking.delivery_type || 'pickup';
  const deliveryFee = Number(booking.delivery_fee) || DELIVERY_FEES[deliveryType] || 0;

  return computeRentalPricing({
    vehicle,
    pickupDate,
    returnDate,
    deliveryFeeAmount: deliveryFee,
    discountAmount: Number(booking.discount_amount || 0),
    mileageAddonFee: Number(booking.mileage_addon_fee || 0),
    tollAddonFee: Number(booking.toll_addon_fee || 0),
    weeklyDiscountPercentOverride: booking.weekly_discount_applied,
  });
}

/**
 * Recompute and persist pricing from dates. Only allowed before rental payment.
 */
export async function repriceBookingFromDates(bookingId, { pickupDate, returnDate } = {}) {
  const booking = await getBookingDetail(bookingId);
  const pickup = String(pickupDate || booking.pickup_date).split('T')[0];
  const ret = String(returnDate || booking.return_date).split('T')[0];

  if (ret <= pickup) {
    const err = new Error('Return date must be after pickup date');
    err.status = 400;
    throw err;
  }

  const rentalPaid = await isBookingRentalPaid(bookingId);
  if (isBookingPricingLocked(booking, rentalPaid)) {
    const err = new Error('Cannot change dates or repricing after rental payment or vehicle pickup');
    err.status = 409;
    throw err;
  }

  const pricing = buildPricingUpdate(booking, pickup, ret);
  const dateChanged = pickup !== String(booking.pickup_date).split('T')[0]
    || ret !== String(booking.return_date).split('T')[0];

  const { data, error } = await supabase
    .from('bookings')
    .update({
      pickup_date: pickup,
      return_date: ret,
      daily_rate: pricing.daily_rate,
      rental_days: pricing.rental_days,
      rate_type: pricing.rate_type,
      weekly_discount_applied: pricing.weekly_discount_applied,
      subtotal: pricing.subtotal,
      discount_amount: pricing.discount_amount,
      delivery_fee: pricing.delivery_fee,
      mileage_addon_fee: pricing.mileage_addon_fee,
      toll_addon_fee: pricing.toll_addon_fee,
      tax_amount: pricing.tax_amount,
      total_cost: pricing.total_cost,
      mileage_allowance: pricing.mileage_allowance,
      line_items: pricing.line_items,
      has_unlimited_miles: pricing.mileage_allowance === 'unlimited' || !!booking.unlimited_miles,
    })
    .eq('id', bookingId)
    .select('*, customers(*), vehicles(*)')
    .single();

  if (error) throw error;

  if (dateChanged || hasPricingDateDrift(booking)) {
    await supabase.from('booking_status_log').insert({
      booking_id: bookingId,
      from_status: booking.status,
      to_status: booking.status,
      changed_by: 'system',
      reason: `Pricing synced to dates (${pickup} → ${ret}, ${pricing.rental_days} day${pricing.rental_days === 1 ? '' : 's'}, $${pricing.total_cost})`,
    });
  }

  return data;
}

/**
 * Auto-reprice unpaid bookings when stored rental_days drift from dates.
 * Returns the (possibly updated) booking row with joins when provided.
 */
export async function ensureBookingPricingSynced(booking) {
  if (!booking?.id || !hasPricingDateDrift(booking)) return booking;

  const rentalPaid = await isBookingRentalPaid(booking.id);
  if (isBookingPricingLocked(booking, rentalPaid)) {
    const drift = pricingDriftSummary(booking);
    const err = new Error(
      `Rental pricing (${drift.storedDays} days) does not match dates (${drift.pickupDate} → ${drift.returnDate}, ${drift.expectedDays} days). Contact the office to fix this booking before checkout.`,
    );
    err.status = 409;
    err.code = 'PRICING_DATE_MISMATCH';
    err.drift = drift;
    throw err;
  }

  return repriceBookingFromDates(booking.id);
}
