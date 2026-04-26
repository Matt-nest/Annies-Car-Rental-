/**
 * Loyalty tier config — tiers ordered highest to lowest.
 * discountPct applies to the rental subtotal (post-seasonal, pre-tax).
 */
export const LOYALTY_TIERS = [
  { key: 'vip',    label: 'VIP',    minBookings: 10, discountPct: 15, color: '#D4AF37' },
  { key: 'gold',   label: 'Gold',   minBookings: 5,  discountPct: 10, color: '#F59E0B' },
  { key: 'silver', label: 'Silver', minBookings: 3,  discountPct: 8,  color: '#94A3B8' },
  { key: 'bronze', label: 'Bronze', minBookings: 1,  discountPct: 5,  color: '#CD7F32' },
];

export function tierForCount(count) {
  return LOYALTY_TIERS.find(t => count >= t.minBookings) || null;
}

/**
 * Resolve a customer's loyalty tier based on their completed bookings.
 * Returns { tier, discountPct, completedCount } — tier is null for first-time customers.
 */
export async function resolveCustomerLoyalty(supabase, customerId) {
  if (!customerId) return { tier: null, discountPct: 0, completedCount: 0 };

  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'completed');

  if (error) {
    console.error('[Loyalty] Failed to resolve tier:', error.message);
    return { tier: null, discountPct: 0, completedCount: 0 };
  }

  const completedCount = count || 0;
  const tier = tierForCount(completedCount);
  return {
    tier: tier?.key || null,
    discountPct: tier?.discountPct || 0,
    completedCount,
  };
}
