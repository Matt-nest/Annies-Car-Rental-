import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { tierForCount, LOYALTY_TIERS } from '../services/loyaltyService.js';

const router = Router();
router.use(requireAuth);

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'closed'];

function countByStatus(rows, statuses) {
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));
  for (const row of rows || []) {
    const key = statuses.includes(row.status) ? row.status : statuses[0];
    counts[key] += 1;
  }
  counts.total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return counts;
}

/**
 * GET /growth/summary
 * Lightweight counts for the Growth workspace tabs. This avoids each tab
 * needing to fully load leads, reviews, pricing rules, and loyalty just to
 * render high-level badges.
 */
router.get('/summary', asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: monthlyInquiries, error: monthlyErr },
    { data: approvedReviews, error: approvedReviewsErr },
    { count: pendingReviews, error: pendingReviewsErr },
    { data: pricingRules, error: pricingRulesErr },
    { data: completedBookings, error: loyaltyErr },
  ] = await Promise.all([
    supabase.from('monthly_inquiries').select('status'),
    supabase.from('reviews').select('rating').eq('approved', true),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('approved', false),
    supabase.from('pricing_rules').select('active, start_date, end_date, multiplier'),
    supabase.from('bookings').select('customer_id, total_cost').eq('status', 'completed').not('customer_id', 'is', null),
  ]);

  const firstError = monthlyErr || approvedReviewsErr || pendingReviewsErr || pricingRulesErr || loyaltyErr;
  if (firstError) throw firstError;

  const reviewCount = approvedReviews?.length || 0;
  const averageRating = reviewCount
    ? (approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount).toFixed(1)
    : null;

  const pricing = { live: 0, upcoming: 0, inactive: 0, total: pricingRules?.length || 0 };
  let adjustmentTotal = 0;
  for (const rule of pricingRules || []) {
    adjustmentTotal += ((Number(rule.multiplier || 1) - 1) * 100);
    if (rule.active && rule.start_date <= today && rule.end_date >= today) pricing.live += 1;
    else if (rule.active && rule.start_date > today) pricing.upcoming += 1;
    else pricing.inactive += 1;
  }
  pricing.average_adjustment = pricing.total ? Math.round(adjustmentTotal / pricing.total) : 0;

  const loyaltyMap = new Map();
  let loyaltyRevenue = 0;
  for (const booking of completedBookings || []) {
    loyaltyMap.set(booking.customer_id, (loyaltyMap.get(booking.customer_id) || 0) + 1);
    loyaltyRevenue += Number(booking.total_cost || 0);
  }
  const loyaltyBreakdown = {};
  for (const tier of LOYALTY_TIERS) loyaltyBreakdown[tier.key] = 0;
  for (const completedCount of loyaltyMap.values()) {
    const tier = tierForCount(completedCount);
    if (tier?.key) loyaltyBreakdown[tier.key] += 1;
  }

  res.json({
    leads: countByStatus(monthlyInquiries, LEAD_STATUSES),
    reviews: {
      pending: pendingReviews || 0,
      live: reviewCount,
      average_rating: averageRating,
    },
    pricing,
    loyalty: {
      total: loyaltyMap.size,
      completed_bookings: completedBookings?.length || 0,
      total_spent: Number(loyaltyRevenue.toFixed(2)),
      breakdown: loyaltyBreakdown,
    },
  });
}));

export default router;
