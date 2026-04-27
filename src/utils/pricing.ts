/**
 * Client-side pricing utilities — mirrors backend pricingService.js logic.
 * Display-only: server-side pricing is always authoritative.
 */

/** Round price for display only — never use for payment calculations. */
export function displayPrice(amount: number): number {
  return Math.round(amount);
}

/** Inclusive day count matching backend calcRentalDays (pickup day = day 1). */
export function calcRentalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1);
}

/** Derive weekly rate from daily rate and discount %. Mirrors backend formula. */
export function calcWeeklyRate(dailyRate: number, discountPct: number): number {
  return parseFloat(((dailyRate * 7) * (1 - discountPct / 100)).toFixed(2));
}

export interface PriceBreakdown {
  rentalDays: number;
  rateType: 'daily' | 'weekly' | 'weekly_mixed';
  fullWeeks: number;
  remainderDays: number;
  weeklyRate: number;
  subtotal: number;
  discountPct: number;
  deliveryFee: number;
  mileageFee: number;
  tollFee: number;
  tax: number;
  total: number;
  savingsVsDaily: number;
  mileageIncluded: boolean;
}

export function calcPriceBreakdown({
  dailyRate,
  discountPct = 15,
  unlimitedMileageEnabled = true,
  startDate,
  endDate,
  deliveryFee = 0,
  mileageFee = 0,
  tollFee = 0,
  taxRate = 0.07,
}: {
  dailyRate: number;
  discountPct?: number;
  unlimitedMileageEnabled?: boolean;
  startDate: string;
  endDate: string;
  deliveryFee?: number;
  mileageFee?: number;
  tollFee?: number;
  taxRate?: number;
}): PriceBreakdown | null {
  const rentalDays = calcRentalDays(startDate, endDate);
  if (rentalDays <= 0) return null;

  const weeklyRate = calcWeeklyRate(dailyRate, discountPct);
  let rateType: 'daily' | 'weekly' | 'weekly_mixed';
  let fullWeeks: number;
  let remainderDays: number;
  let subtotal: number;
  let mileageIncluded = false;

  if (rentalDays >= 7) {
    fullWeeks = Math.floor(rentalDays / 7);
    remainderDays = rentalDays % 7;
    rateType = remainderDays === 0 ? 'weekly' : 'weekly_mixed';
    subtotal = parseFloat(((fullWeeks * weeklyRate) + (remainderDays * dailyRate)).toFixed(2));
    mileageIncluded = unlimitedMileageEnabled;
    mileageFee = 0; // included — not sold
  } else {
    fullWeeks = 0;
    remainderDays = rentalDays;
    rateType = 'daily';
    subtotal = parseFloat((dailyRate * rentalDays).toFixed(2));
    if (mileageFee > 0) mileageIncluded = true;
  }

  const savingsVsDaily = rateType !== 'daily'
    ? parseFloat(((dailyRate * rentalDays) - subtotal).toFixed(2))
    : 0;

  const taxable = subtotal + deliveryFee;
  const tax = parseFloat((taxable * taxRate).toFixed(2));
  const total = parseFloat((taxable + tax + mileageFee + tollFee).toFixed(2));

  return {
    rentalDays, rateType, fullWeeks, remainderDays,
    weeklyRate, subtotal, discountPct,
    deliveryFee, mileageFee, tollFee, tax, total,
    savingsVsDaily, mileageIncluded,
  };
}
