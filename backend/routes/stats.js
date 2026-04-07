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
    { data: monthRevenue },
    { data: avgRating },
    { count: monthBookings },
    { count: pendingAgreements },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('bookings').select('id, booking_code, pickup_time, customers(first_name, last_name), vehicles(year, make, model)')
      .eq('pickup_date', todayStr).in('status', ['approved', 'confirmed']),
    supabase.from('bookings').select('id, booking_code, return_time, customers(first_name, last_name), vehicles(year, make, model)')
      .eq('return_date', todayStr).eq('status', 'active'),
    supabase.from('bookings').select('total_cost').gte('created_at', `${startOfMonth}T00:00:00`).in('status', ['approved', 'confirmed', 'active', 'returned', 'completed']),
    supabase.from('reviews').select('rating'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', `${startOfMonth}T00:00:00`),
    supabase.from('rental_agreements').select('*', { count: 'exact', head: true })
      .not('customer_signed_at', 'is', null)
      .is('owner_signed_at', null),
  ]);

  const revenueThisMonth = (monthRevenue || []).reduce((s, b) => s + parseFloat(b.total_cost), 0);
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
  });
}));

/** GET /stats/revenue — revenue breakdown */
router.get('/revenue', requireAuth, asyncHandler(async (req, res) => {
  const { from, to, period = 'month' } = req.query;

  const { data, error } = await supabase
    .from('bookings')
    .select('booking_code, pickup_date, total_cost, tax_amount, source, vehicle_id, created_at, deposit_status, vehicles(year, make, model, category)')
    .in('status', ['approved', 'confirmed', 'active', 'returned', 'completed'])
    .gte('created_at', (from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) + 'T00:00:00')
    .lte('created_at', (to || new Date().toISOString().slice(0, 10)) + 'T23:59:59')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group by month
  const byMonth = {};
  for (const b of data || []) {
    const key = b.pickup_date.slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + parseFloat(b.total_cost);
  }

  // Group by source
  const bySource = {};
  for (const b of data || []) {
    bySource[b.source || 'website'] = (bySource[b.source || 'website'] || 0) + parseFloat(b.total_cost);
  }

  // Group by vehicle
  const byVehicle = {};
  for (const b of data || []) {
    const key = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : b.vehicle_id;
    byVehicle[key] = (byVehicle[key] || 0) + parseFloat(b.total_cost);
  }

  // Group by vehicle category
  const byCategory = {};
  for (const b of data || []) {
    const cat = b.vehicles?.category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(b.total_cost);
  }

  // Group by day (for heatmap and daily trend)
  const byDay = {};
  for (const b of data || []) {
    byDay[b.pickup_date] = (byDay[b.pickup_date] || 0) + parseFloat(b.total_cost);
  }

  const total = (data || []).reduce((s, b) => s + parseFloat(b.total_cost), 0);
  const totalTax = (data || []).reduce((s, b) => s + parseFloat(b.tax_amount || 0), 0);

  // Current month stats
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthRevenue = byMonth[currentMonthKey] || 0;
  const thisMonthBookings = (data || []).filter(b => b.pickup_date.startsWith(currentMonthKey)).length;

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
    transactions: data,
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
    const { data: bookings } = await supabase
      .from('bookings')
      .select('pickup_date, return_date, total_cost')
      .eq('vehicle_id', v.id)
      .in('status', ['confirmed', 'active', 'returned', 'completed'])
      .gte('pickup_date', since);

    let totalDays = 0;
    let totalRevenue = 0;
    for (const b of bookings || []) {
      const days = Math.ceil((new Date(b.return_date) - new Date(b.pickup_date)) / (1000 * 60 * 60 * 24));
      totalDays += days;
      totalRevenue += parseFloat(b.total_cost);
    }

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

/** GET /stats/webhook-failures — failed GHL webhook attempts */
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
