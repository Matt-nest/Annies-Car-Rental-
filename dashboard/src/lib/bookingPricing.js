/**
 * Client-side booking quote calculator — mirrors backend pricingService.js.
 * Display and admin-quote planning only; server pricing is authoritative at create time.
 */

const DEFAULT_TAX_RATE = 0.07;
const MILEAGE_ADDON_FEE = 100;
const TOLL_ADDON_FEE = 20;

/** Inclusive day count (pickup day = day 1), matching backend calcRentalDays. */
export function calcRentalDays(startDate, endDate) {
  if (!startDate || !endDate || endDate <= startDate) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  return Math.max(1, Math.ceil((end - start) / msPerDay) + 1);
}

export function calcWeeklyRate(dailyRate, discountPct) {
  return parseFloat(((dailyRate * 7) * (1 - discountPct / 100)).toFixed(2));
}

/**
 * Build an admin quote breakdown for the New Booking modal.
 */
export function calcAdminQuote({
  dailyRate,
  pickupDate,
  returnDate,
  applyWeeklyDiscount = false,
  weeklyDiscountPct = 15,
  unlimitedMileageEnabled = true,
  unlimitedMiles = false,
  unlimitedTolls = false,
  taxRate = DEFAULT_TAX_RATE,
}) {
  const rentalDays = calcRentalDays(pickupDate, returnDate);
  const rate = Number(dailyRate);
  if (!Number.isFinite(rate) || rate <= 0 || rentalDays <= 0) return null;

  const discountPct = applyWeeklyDiscount && rentalDays >= 7
    ? Math.min(50, Math.max(0, Number(weeklyDiscountPct) || 0))
    : 0;

  const weeklyRate = calcWeeklyRate(rate, discountPct);
  let rateType;
  let fullWeeks;
  let remainderDays;
  let subtotal;
  let mileageFee = unlimitedMiles ? MILEAGE_ADDON_FEE : 0;
  let mileageIncluded = false;

  if (rentalDays >= 7 && applyWeeklyDiscount) {
    fullWeeks = Math.floor(rentalDays / 7);
    remainderDays = rentalDays % 7;
    rateType = remainderDays === 0 ? 'weekly' : 'weekly_mixed';
    subtotal = parseFloat(((fullWeeks * weeklyRate) + (remainderDays * rate)).toFixed(2));
    if (unlimitedMileageEnabled) {
      mileageIncluded = true;
      mileageFee = 0;
    }
  } else {
    fullWeeks = 0;
    remainderDays = rentalDays;
    rateType = 'daily';
    subtotal = parseFloat((rate * rentalDays).toFixed(2));
    if (unlimitedMiles) {
      mileageIncluded = true;
      mileageFee = MILEAGE_ADDON_FEE;
    }
  }

  const tollFee = unlimitedTolls ? TOLL_ADDON_FEE : 0;
  const flatDailyTotal = parseFloat((rate * rentalDays).toFixed(2));
  const savingsVsDaily = applyWeeklyDiscount && rentalDays >= 7
    ? parseFloat((flatDailyTotal - subtotal).toFixed(2))
    : 0;

  const taxable = subtotal;
  const tax = parseFloat((taxable * taxRate).toFixed(2));
  const rentalTotal = parseFloat((taxable + tax + mileageFee + tollFee).toFixed(2));

  return {
    rentalDays,
    rateType,
    fullWeeks,
    remainderDays,
    dailyRate: rate,
    weeklyRate,
    weeklyDiscountPct: discountPct,
    subtotal,
    flatDailyTotal,
    savingsVsDaily,
    mileageFee,
    tollFee,
    mileageIncluded,
    tax,
    rentalTotal,
    taxRate,
  };
}

export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
