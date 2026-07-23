import { countDynamicPricingDays, getWeekendRateForVehicle } from './dynamicPricingService.js';

const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.07');

/**
 * Calculate rental days (inclusive of both pickup and return date).
 */
export function calcRentalDays(pickupDate, returnDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const pDateStr = String(pickupDate).split('T')[0];
  const rDateStr = String(returnDate).split('T')[0];
  const pickup = new Date(pDateStr + 'T12:00:00Z');
  const ret = new Date(rDateStr + 'T12:00:00Z');
  // +1 makes it inclusive: pickup day counts as day 1
  return Math.max(1, Math.ceil((ret - pickup) / msPerDay) + 1);
}

/** True when stored rental_days does not match inclusive day count for the dates. */
export function hasPricingDateDrift(booking) {
  if (!booking?.pickup_date || !booking?.return_date) return false;
  const expected = calcRentalDays(booking.pickup_date, booking.return_date);
  const stored = Number(booking.rental_days);
  return Number.isFinite(stored) && stored !== expected;
}

export function pricingDriftSummary(booking) {
  const expectedDays = calcRentalDays(booking.pickup_date, booking.return_date);
  const storedDays = Number(booking.rental_days);
  return {
    hasDrift: hasPricingDateDrift(booking),
    expectedDays,
    storedDays,
    pickupDate: String(booking.pickup_date).split('T')[0],
    returnDate: String(booking.return_date).split('T')[0],
  };
}

const TERMINAL_PRICING_LOCKED_STATUSES = new Set(['active', 'returned', 'completed', 'cancelled', 'declined', 'no_show']);

/** True when dates/pricing must not change (paid, picked up, or terminal). */
export function isBookingPricingLocked(booking, rentalPaid = false) {
  if (rentalPaid) return true;
  if (TERMINAL_PRICING_LOCKED_STATUSES.has(booking?.status)) return true;
  return false;
}

// Fee schedule for delivery options
export const DELIVERY_FEES = {
  pickup:               0,
  psl_delivery:         39,
  surrounding_delivery: 49,
};

/**
 * Calculate insurance cost from a booking record.
 *
 * Bonzah replaced Annie's-branded tiers (basic/standard/premium) — pricing now
 * comes from a live Bonzah quote stored on the booking as
 *   bonzah_premium_cents + bonzah_markup_cents
 * (set by POST /bookings/:code/insurance/quote when the customer picks a tier).
 *
 * Returns the customer-facing dollar amount (Bonzah's premium + Annie's markup).
 * For 'own' insurance or no provider, returns 0.
 */
export function calcInsuranceCost(booking) {
  if (!booking || booking.insurance_provider !== 'bonzah') return 0;
  const premium = Number(booking.bonzah_premium_cents) || 0;
  const markup = Number(booking.bonzah_markup_cents) || 0;
  return parseFloat(((premium + markup) / 100).toFixed(2));
}

/**
 * Compute full rental pricing with weekly block math.
 *
 * vehicle must have: daily_rate, weekly_discount_percent, weekly_unlimited_mileage_enabled
 *
 * Weekly rate is derived at runtime — NOT read from vehicles.weekly_rate.
 * Formula: weekly_rate = ROUND((daily_rate × 7) × (1 - discount% / 100), 2)
 *
 * For 7+ day rentals: full_weeks at weekly_rate + remainder days at daily_rate.
 * Mileage add-on is zeroed out server-side for weekly/weekly_mixed bookings
 * because unlimited mileage is included when weekly_unlimited_mileage_enabled.
 *
 * Returns fields split into two groups:
 *   DB_FIELDS — safe to spread into bookings table insert
 *   _display  — helpers for agreements/UI (weekly_rate, full_weeks, etc.) — NOT in bookings table
 */
/**
 * Fetch the highest applicable seasonal pricing multiplier for a date range.
 * Returns { multiplier: number, name: string|null }.
 * Pass your supabase client so this stays pure and testable.
 */
export async function resolveMultiplier(supabaseClient, pickupDate, returnDate, vehicleId) {
  const { data } = await supabaseClient
    .from('pricing_rules')
    .select('name, multiplier, vehicle_ids')
    .eq('active', true)
    .lte('start_date', returnDate)
    .gte('end_date', pickupDate);

  if (!data?.length) return { multiplier: 1.0, name: null };

  const applicable = data.filter(r => !r.vehicle_ids || r.vehicle_ids.includes(vehicleId));
  if (!applicable.length) return { multiplier: 1.0, name: null };

  const top = applicable.reduce((a, b) => parseFloat(b.multiplier) > parseFloat(a.multiplier) ? b : a);
  return { multiplier: parseFloat(top.multiplier), name: top.name };
}

export function computeRentalPricing({
  vehicle,
  pickupDate,
  returnDate,
  deliveryFeeAmount = 0,
  discountAmount = 0,
  mileageAddonFee = 0,
  tollAddonFee = 0,
  taxRate = TAX_RATE,
  priceMultiplier = 1.0,
  seasonalRuleName = null,
  loyaltyDiscountPct = 0,
  loyaltyTierLabel = null,
  weeklyDiscountPercentOverride = null,
  totalCostOverride = null,
  totalCostOverrideLabel = 'Admin price override',
  dynamicPricing = null,
}) {
  const rentalDays = calcRentalDays(pickupDate, returnDate);
  const dailyRate = parseFloat(vehicle.daily_rate);
  const requestedDiscountPct = weeklyDiscountPercentOverride ?? vehicle.weekly_discount_percent ?? 15;
  const discountPct = Math.min(50, Math.max(0, Number(requestedDiscountPct)));
  const weeklyRate = parseFloat(((dailyRate * 7) * (1 - discountPct / 100)).toFixed(2));
  const unlimitedMileageIncluded = vehicle.weekly_unlimited_mileage_enabled !== false;

  let rate_type, full_weeks, remainder_days, subtotal;
  let dynamicPricingAdjustment = 0;
  let dynamicPricingDays = 0;
  let dynamicPricingRate = null;
  let dynamicPricingLabel = null;

  if (rentalDays >= 7) {
    full_weeks = Math.floor(rentalDays / 7);
    remainder_days = rentalDays % 7;
    rate_type = remainder_days === 0 ? 'weekly' : 'weekly_mixed';
    subtotal = parseFloat(((full_weeks * weeklyRate) + (remainder_days * dailyRate)).toFixed(2));
    // Mileage add-on is not sold on weekly bookings — unlimited mileage is included
    mileageAddonFee = 0;
  } else {
    full_weeks = 0;
    remainder_days = rentalDays;
    rate_type = 'daily';
    subtotal = parseFloat((dailyRate * rentalDays).toFixed(2));
    if (dynamicPricing?.enabled) {
      const weekendRate = getWeekendRateForVehicle(vehicle, dynamicPricing);
      dynamicPricingDays = countDynamicPricingDays(pickupDate, returnDate, dynamicPricing);
      if (weekendRate && dynamicPricingDays > 0) {
        dynamicPricingRate = weekendRate.rate;
        dynamicPricingLabel = weekendRate.label;
        dynamicPricingAdjustment = parseFloat(((dynamicPricingRate - dailyRate) * dynamicPricingDays).toFixed(2));
        subtotal = parseFloat((subtotal + dynamicPricingAdjustment).toFixed(2));
      }
    }
  }

  // Apply seasonal pricing multiplier (e.g. 1.25 for spring break, 0.90 for off-season)
  let seasonalAdjustment = 0;
  if (priceMultiplier !== 1.0) {
    const adjusted = parseFloat((subtotal * priceMultiplier).toFixed(2));
    seasonalAdjustment = parseFloat((adjusted - subtotal).toFixed(2));
    subtotal = adjusted;
  }

  // mileage_allowance: VARCHAR — 'unlimited' or a total-miles string like '1050'
  let mileage_allowance;
  if (rate_type !== 'daily' && unlimitedMileageIncluded) {
    mileage_allowance = 'unlimited';
  } else if (mileageAddonFee > 0) {
    mileage_allowance = 'unlimited';
  } else {
    mileage_allowance = String(rentalDays * 150);
  }

  // Loyalty discount on post-seasonal subtotal
  let loyaltyDiscountAmount = 0;
  if (loyaltyDiscountPct > 0) {
    loyaltyDiscountAmount = parseFloat((subtotal * loyaltyDiscountPct / 100).toFixed(2));
  }

  const taxableAmount = subtotal - discountAmount - loyaltyDiscountAmount + deliveryFeeAmount;
  const taxAmount = parseFloat((taxableAmount * taxRate).toFixed(2));
  // insurance_cost intentionally excluded — no bookings column; added to PI separately
  let totalCost = parseFloat((taxableAmount + taxAmount + mileageAddonFee + tollAddonFee).toFixed(2));

  // line_items: financial ledger stored at booking creation, never recomputed
  const line_items = [];
  if (rate_type === 'weekly') {
    line_items.push({ label: full_weeks === 1 ? '1 week' : `${full_weeks} weeks`, amount: parseFloat((full_weeks * weeklyRate).toFixed(2)) });
  } else if (rate_type === 'weekly_mixed') {
    if (full_weeks > 0) {
      line_items.push({ label: full_weeks === 1 ? '1 week' : `${full_weeks} weeks`, amount: parseFloat((full_weeks * weeklyRate).toFixed(2)) });
    }
    if (remainder_days > 0) {
      line_items.push({ label: remainder_days === 1 ? '1 day' : `${remainder_days} days`, amount: parseFloat((remainder_days * dailyRate).toFixed(2)) });
    }
  } else {
    const baseDailySubtotal = parseFloat((dailyRate * rentalDays).toFixed(2));
    line_items.push({ label: rentalDays === 1 ? '1 day' : `${rentalDays} days`, amount: baseDailySubtotal });
  }
  if (dynamicPricingAdjustment !== 0) {
    line_items.push({
      label: `${dynamicPricingLabel || 'Weekend pricing'} (${dynamicPricingDays} day${dynamicPricingDays === 1 ? '' : 's'} @ $${dynamicPricingRate}/day)`,
      amount: dynamicPricingAdjustment,
    });
  }
  if (seasonalAdjustment !== 0 && seasonalRuleName) {
    const pct = Math.round((priceMultiplier - 1) * 100);
    line_items.push({ label: `${seasonalRuleName} (${pct > 0 ? '+' : ''}${pct}%)`, amount: seasonalAdjustment });
  }
  if (loyaltyDiscountAmount > 0) {
    const label = loyaltyTierLabel ? `${loyaltyTierLabel} loyalty (${loyaltyDiscountPct}% off)` : `Loyalty discount (${loyaltyDiscountPct}% off)`;
    line_items.push({ label, amount: -loyaltyDiscountAmount });
  }
  if (discountAmount > 0) {
    line_items.push({ label: 'Discount', amount: parseFloat((-discountAmount).toFixed(2)) });
  }
  if (deliveryFeeAmount > 0) {
    line_items.push({ label: 'Delivery', amount: parseFloat(deliveryFeeAmount.toFixed(2)) });
  }
  if (mileageAddonFee > 0) {
    line_items.push({ label: 'Unlimited mileage', amount: parseFloat(mileageAddonFee.toFixed(2)) });
  }
  if (tollAddonFee > 0) {
    line_items.push({ label: 'Toll pass', amount: parseFloat(tollAddonFee.toFixed(2)) });
  }
  line_items.push({ label: `Tax (${Math.round(taxRate * 100)}%)`, amount: taxAmount });

  if (totalCostOverride != null) {
    const overrideTotal = parseFloat(Number(totalCostOverride).toFixed(2));
    if (Number.isFinite(overrideTotal) && overrideTotal > 0) {
      const adjustment = parseFloat((overrideTotal - totalCost).toFixed(2));
      if (Math.abs(adjustment) >= 0.01) {
        line_items.push({ label: totalCostOverrideLabel, amount: adjustment });
      }
      totalCost = overrideTotal;
    }
  }

  return {
    // ── DB_FIELDS: spread directly into bookings table insert ─────────────────
    daily_rate:              dailyRate,
    rental_days:             rentalDays,
    rate_type,
    weekly_discount_applied: rate_type !== 'daily' ? discountPct : null,
    subtotal,
    discount_amount:         discountAmount,
    delivery_fee:            deliveryFeeAmount,
    mileage_addon_fee:       mileageAddonFee,
    toll_addon_fee:          tollAddonFee,
    tax_amount:              taxAmount,
    total_cost:              totalCost,
    mileage_allowance,
    line_items,
    // ── Display helpers: NOT in bookings table — use in agreements/UI ─────────
    weekly_rate:             weeklyRate,
    weekly_discount_percent: discountPct,
    full_weeks,
    remainder_days,
    dynamic_pricing_adjustment: dynamicPricingAdjustment,
    dynamic_pricing_days: dynamicPricingDays,
    dynamic_pricing_rate: dynamicPricingRate,
    savings_vs_daily:        rate_type !== 'daily'
      ? parseFloat(((dailyRate * rentalDays) - subtotal).toFixed(2))
      : 0,
  };
}
