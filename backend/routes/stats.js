import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/** GET /stats/overview — dashboard KPIs */
router.get('/overview', requireAuth, asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const [
    { count: pendingCount },
    { count: activeCount },
    { data: pickupsToday },
    { data: returnsToday },
    { data: confirmedPayments },
    { data: avgRating },
    { count: pendingReviewsCount },
    { count: monthBookings },
    { count: pendingAgreements },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('bookings').select('id, booking_code, pickup_time, customers(first_name, last_name), vehicles(year, make, model)')
      .eq('pickup_date', todayStr).in('status', ['approved', 'confirmed']),
    supabase.from('bookings').select('id, booking_code, return_time, customers(first_name, last_name), vehicles(year, make, model)')
      .eq('return_date', todayStr).eq('status', 'active'),
    // Revenue from CONFIRMED payments only (not booking estimates)
    supabase.from('payments').select('amount, payment_type')
      .gte('created_at', `${startOfMonth}T00:00:00`)
      .in('payment_type', ['rental', 'refund']),
    supabase.from('reviews').select('rating').eq('approved', true),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('approved', false),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', `${startOfMonth}T00:00:00`),
    supabase.from('rental_agreements').select('*', { count: 'exact', head: true })
      .not('customer_signed_at', 'is', null)
      .is('owner_signed_at', null),
  ]);

  // Net revenue = rental payments minus refunds (deposits excluded)
  const revenueThisMonth = (confirmedPayments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
  const avgRatingVal = avgRating?.length
    ? (avgRating.reduce((s, r) => s + r.rating, 0) / avgRating.length).toFixed(1)
    : null;

  res.json({
    pending_approvals: pendingCount || 0,
    active_rentals: activeCount || 0,
    pickups_today: pickupsToday || [],
    returns_today: returnsToday || [],
    revenue_this_month: revenueThisMonth.toFixed(2),
    bookings_this_month: monthBookings || 0,
    average_rating: avgRatingVal,
    pending_agreements: pendingAgreements || 0,
    pending_reviews: pendingReviewsCount || 0,
  });
}));

/** GET /stats/revenue — revenue breakdown (confirmed payments only) */
router.get('/revenue', requireAuth, asyncHandler(async (req, res) => {
  const { from, to, period = 'month' } = req.query;

  // Fetch confirmed payments joined with their booking + vehicle data
  let query = supabase
    .from('payments')
    .select('amount, payment_type, method, reference_id, created_at, paid_at, booking_id, bookings(booking_code, pickup_date, total_cost, tax_amount, source, vehicle_id, rate_type, rental_days, weekly_discount_applied, vehicles(year, make, model, category))')
    .in('payment_type', ['rental', 'refund']);

  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to)   query = query.lte('created_at', `${to}T23:59:59`);

  const { data: payments, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  // Group by month (using the booking's pickup_date for consistency)
  const byMonth = {};
  for (const p of payments || []) {
    const pickupDate = p.bookings?.pickup_date;
    if (!pickupDate) continue;
    const key = pickupDate.slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + parseFloat(p.amount);
  }

  // Group by source
  const bySource = {};
  for (const p of payments || []) {
    const src = p.bookings?.source || 'website';
    bySource[src] = (bySource[src] || 0) + parseFloat(p.amount);
  }

  // Group by vehicle
  const byVehicle = {};
  for (const p of payments || []) {
    const v = p.bookings?.vehicles;
    const key = v ? `${v.year} ${v.make} ${v.model}` : (p.bookings?.vehicle_id || 'unknown');
    byVehicle[key] = (byVehicle[key] || 0) + parseFloat(p.amount);
  }

  // Group by vehicle category
  const byCategory = {};
  for (const p of payments || []) {
    const cat = p.bookings?.vehicles?.category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(p.amount);
  }

  // Group by day
  const byDay = {};
  for (const p of payments || []) {
    const day = (p.paid_at || p.created_at).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + parseFloat(p.amount);
  }

  // Group by rate type (daily / weekly / weekly_mixed)
  const byRateType = { daily: 0, weekly: 0, weekly_mixed: 0 };
  for (const p of payments || []) {
    const rt = p.bookings?.rate_type || 'daily';
    const key = byRateType.hasOwnProperty(rt) ? rt : 'daily';
    byRateType[key] += parseFloat(p.amount);
  }

  // Booking length distribution (de-duped by booking_id, rental payments only)
  const daysDistribution = {};
  const seenDaysBkIds = new Set();
  const allRentalDays = [];
  let weeklyDiscountTotal = 0;
  const seenDiscountBkIds = new Set();
  for (const p of payments || []) {
    if (p.payment_type !== 'rental' || seenDaysBkIds.has(p.booking_id)) continue;
    seenDaysBkIds.add(p.booking_id);
    const days = p.bookings?.rental_days;
    if (days) {
      const bucket = days <= 14 ? String(days) : '15+';
      daysDistribution[bucket] = (daysDistribution[bucket] || 0) + 1;
      allRentalDays.push(days);
    }
    if (!seenDiscountBkIds.has(p.booking_id) && p.bookings?.weekly_discount_applied) {
      weeklyDiscountTotal += parseFloat(p.bookings.weekly_discount_applied);
      seenDiscountBkIds.add(p.booking_id);
    }
  }
  const avgRentalDays = allRentalDays.length
    ? (allRentalDays.reduce((s, d) => s + d, 0) / allRentalDays.length).toFixed(1)
    : null;

  // Monthly inquiry funnel
  const { data: inquiries } = await supabase.from('monthly_inquiries').select('status');
  const inquiryFunnel = { new: 0, contacted: 0, converted: 0, closed: 0 };
  for (const i of inquiries || []) {
    if (inquiryFunnel.hasOwnProperty(i.status)) inquiryFunnel[i.status]++;
  }

  const total = (payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);

  // Estimate tax from linked bookings (for reporting only)
  const seenBookings = new Set();
  let totalTax = 0;
  for (const p of payments || []) {
    if (p.payment_type === 'rental' && p.bookings?.tax_amount && !seenBookings.has(p.booking_id)) {
      totalTax += parseFloat(p.bookings.tax_amount || 0);
      seenBookings.add(p.booking_id);
    }
  }

  // Current month stats
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthRevenue = byMonth[currentMonthKey] || 0;
  const thisMonthBookings = (payments || []).filter(p => p.payment_type === 'rental' && p.bookings?.pickup_date?.startsWith(currentMonthKey)).length;

  const transactions = (payments || []).map(p => ({
    booking_code: p.bookings?.booking_code,
    pickup_date: p.bookings?.pickup_date,
    total_cost: p.amount,
    tax_amount: p.bookings?.tax_amount || 0,
    source: p.bookings?.source,
    vehicle_id: p.bookings?.vehicle_id,
    rate_type: p.bookings?.rate_type || 'daily',
    rental_days: p.bookings?.rental_days || null,
    created_at: p.created_at,
    payment_type: p.payment_type,
    vehicles: p.bookings?.vehicles,
  }));

  res.json({
    total: total.toFixed(2),
    total_tax: totalTax.toFixed(2),
    this_month_revenue: thisMonthRevenue.toFixed(2),
    this_month_bookings: thisMonthBookings,
    by_month: byMonth,
    by_source: bySource,
    by_vehicle: byVehicle,
    by_category: byCategory,
    by_day: byDay,
    by_rate_type: byRateType,
    days_distribution: daysDistribution,
    avg_rental_days: avgRentalDays,
    weekly_discount_total: weeklyDiscountTotal.toFixed(2),
    inquiry_funnel: inquiryFunnel,
    transactions,
  });
}));

/** GET /stats/vehicles — per-vehicle utilization */
router.get('/vehicles', requireAuth, asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, vehicle_code, year, make, model, daily_rate, status');

  if (error) throw error;

  const stats = await Promise.all((vehicles || []).map(async (v) => {
    // Get bookings for utilization (days rented)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('pickup_date, return_date')
      .eq('vehicle_id', v.id)
      .in('status', ['confirmed', 'active', 'returned', 'completed'])
      .gte('pickup_date', since);

    // Get confirmed payments for this vehicle's bookings (actual revenue)
    const { data: vehiclePayments } = await supabase
      .from('payments')
      .select('amount, booking_id, bookings!inner(vehicle_id)')
      .eq('bookings.vehicle_id', v.id)
      .in('payment_type', ['rental', 'refund'])
      .gte('created_at', `${since}T00:00:00`);

    let totalDays = 0;
    for (const b of bookings || []) {
      const days = Math.ceil((new Date(b.return_date) - new Date(b.pickup_date)) / (1000 * 60 * 60 * 24));
      totalDays += days;
    }

    const totalRevenue = (vehiclePayments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
    const utilizationRate = ((totalDays / 90) * 100).toFixed(1);
    return { ...v, rentals_last_90d: (bookings || []).length, days_rented_90d: totalDays, revenue_90d: totalRevenue.toFixed(2), utilization_rate: utilizationRate };
  }));

  res.json(stats);
}));

/** GET /stats/upcoming — next 7 days pickups and returns */
router.get('/upcoming', requireAuth, asyncHandler(async (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: pickups }, { data: returns }] = await Promise.all([
    supabase.from('bookings')
      .select('*, customers(first_name, last_name, phone), vehicles(year, make, model)')
      .gte('pickup_date', todayStr).lte('pickup_date', in7Days)
      .in('status', ['approved', 'confirmed'])
      .order('pickup_date'),
    supabase.from('bookings')
      .select('*, customers(first_name, last_name, phone), vehicles(year, make, model)')
      .gte('return_date', todayStr).lte('return_date', in7Days)
      .eq('status', 'active')
      .order('return_date'),
  ]);

  res.json({ pickups: pickups || [], returns: returns || [] });
}));

/** GET /stats/webhook-failures — failed notification/webhook attempts */
router.get('/webhook-failures', requireAuth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { data, error } = await supabase
    .from('webhook_failures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json(data || []);
}));

/** GET /stats/activity — recent status changes */
router.get('/activity', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('booking_status_log')
    .select('*, bookings(booking_code, customers(first_name, last_name), vehicles(year, make, model))')
    .order('created_at', { ascending: false })
    .limit(parseInt(req.query.limit) || 20);

  if (error) throw error;
  res.json(data);
}));

export default router;
