import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { tierForCount, LOYALTY_TIERS } from '../services/loyaltyService.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /loyalty/customers
 * Returns all customers who have at least 1 completed booking,
 * with computed tier, total spend, and last rental date.
 */
router.get('/customers', asyncHandler(async (_req, res) => {
  // Aggregate completed bookings per customer
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('customer_id, total_cost, return_date, customers(id, first_name, last_name, email, phone)')
    .eq('status', 'completed')
    .not('customer_id', 'is', null);

  if (error) throw error;

  // Group by customer
  const map = new Map();
  for (const b of bookings || []) {
    const c = b.customers;
    if (!c) continue;
    if (!map.has(c.id)) {
      map.set(c.id, { customer: c, count: 0, totalSpent: 0, lastRental: null });
    }
    const entry = map.get(c.id);
    entry.count++;
    entry.totalSpent += parseFloat(b.total_cost || 0);
    if (!entry.lastRental || b.return_date > entry.lastRental) {
      entry.lastRental = b.return_date;
    }
  }

  const rows = [...map.values()]
    .map(({ customer, count, totalSpent, lastRental }) => {
      const tier = tierForCount(count);
      return {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        completed_count: count,
        total_spent: parseFloat(totalSpent.toFixed(2)),
        last_rental: lastRental,
        tier: tier?.key || null,
        tier_label: tier?.label || null,
        discount_pct: tier?.discountPct || 0,
      };
    })
    .sort((a, b) => b.completed_count - a.completed_count || b.total_spent - a.total_spent);

  // Tier breakdown counts for header stats
  const breakdown = {};
  for (const t of LOYALTY_TIERS) breakdown[t.key] = 0;
  for (const r of rows) if (r.tier) breakdown[r.tier]++;

  res.json({ customers: rows, breakdown });
}));

export default router;
