const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.07'); // 7% default Florida sales tax
const DELIVERY_FEE = parseFloat(process.env.DELIVERY_FEE || '50.00');

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

// Fee schedule for delivery options
export const DELIVERY_FEES = {
  pickup:               0,
  psl_delivery:         39,
  surrounding_delivery: 49,
};

/**
 * Calculate the full pricing breakdown for a booking.
 * Supports weekly rate discounts: full weeks at weeklyRate, remaining days at dailyRate.
 * deliveryFeeAmount: pass the exact fee (use DELIVERY_FEES map to look up from delivery_type).
 */
export function calcPricing({ dailyRate, weeklyRate, rentalDays, deliveryFeeAmount = 0, discountAmount = 0 }) {
  let subtotal;
  if (rentalDays >= 7 && weeklyRate) {
    const fullWeeks = Math.floor(rentalDays / 7);
    const remainingDays = rentalDays % 7;
    subtotal = parseFloat(((fullWeeks * weeklyRate) + (remainingDays * dailyRate)).toFixed(2));
  } else {
    subtotal = parseFloat((dailyRate * rentalDays).toFixed(2));
  }

  const taxableAmount = subtotal - discountAmount + deliveryFeeAmount;
  const taxAmount = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
  const totalCost = parseFloat((taxableAmount + taxAmount).toFixed(2));

  return {
    daily_rate: dailyRate,
    rental_days: rentalDays,
    subtotal,
    discount_amount: discountAmount,
    delivery_fee: deliveryFeeAmount,
    tax_amount: taxAmount,
    total_cost: totalCost,
  };
}
