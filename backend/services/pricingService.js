const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.07'); // 7% default Florida sales tax
const DELIVERY_FEE = parseFloat(process.env.DELIVERY_FEE || '50.00');

/**
 * Calculate rental days (inclusive of both pickup and return date).
 */
export function calcRentalDays(pickupDate, returnDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const pickup = new Date(pickupDate);
  const ret = new Date(returnDate);
  return Math.max(1, Math.ceil((ret - pickup) / msPerDay));
}

/**
 * Calculate the full pricing breakdown for a booking.
 * Supports weekly rate discounts: full weeks at weeklyRate, remaining days at dailyRate.
 */
export function calcPricing({ dailyRate, weeklyRate, rentalDays, deliveryRequested = false, discountAmount = 0 }) {
  let subtotal;
  if (rentalDays >= 7 && weeklyRate) {
    const fullWeeks = Math.floor(rentalDays / 7);
    const remainingDays = rentalDays % 7;
    subtotal = parseFloat(((fullWeeks * weeklyRate) + (remainingDays * dailyRate)).toFixed(2));
  } else {
    subtotal = parseFloat((dailyRate * rentalDays).toFixed(2));
  }

  const deliveryFee = deliveryRequested ? DELIVERY_FEE : 0;
  const taxableAmount = subtotal - discountAmount + deliveryFee;
  const taxAmount = parseFloat((taxableAmount * TAX_RATE).toFixed(2));
  const totalCost = parseFloat((taxableAmount + taxAmount).toFixed(2));

  return {
    daily_rate: dailyRate,
    rental_days: rentalDays,
    subtotal,
    discount_amount: discountAmount,
    delivery_fee: deliveryFee,
    tax_amount: taxAmount,
    total_cost: totalCost,
  };
}
