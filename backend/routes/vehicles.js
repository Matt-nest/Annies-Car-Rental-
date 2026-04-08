import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { checkAvailability, getAvailableVehicles } from '../services/availabilityService.js';
import { enrichVehicle } from '../services/autoDevService.js';

const router = Router();

/** GET /vehicles — list all (admin) */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase.from('vehicles').select('*').neq('status', 'deleted').order('make');

  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.category) query = query.eq('category', req.query.category);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/** GET /vehicles/catalog — public fleet listing for customer site (no auth) */
router.get('/catalog', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vehicle_code, vin, make, model, year, trim, category, daily_rate, weekly_rate, seats, fuel_type, transmission, thumbnail_url, photo_urls, features, notes, mileage_limit_per_day')
    .neq('status', 'retired')
    .neq('status', 'turo')
    .eq('status', 'available')
    .order('daily_rate', { ascending: false });

  if (error) throw error;

  // Map to frontend-friendly format
  const catalog = (data || []).map(v => {
    // Build multi-angle image paths from VIN
    const vin = v.vin;
    const heroImage = vin ? `/fleet/${vin}/hero.png` : v.thumbnail_url;
    const sideImage = vin ? `/fleet/${vin}/side.png` : null;
    const rearImage = vin ? `/fleet/${vin}/rear.png` : null;

    return {
      id: v.vehicle_code,
      vin: vin || '',
      make: v.make,
      model: v.model,
      year: v.year,
      trim: v.trim || '',
      category: v.category === 'suv' ? 'SUV' : v.category === 'luxury' ? 'Premium' : v.category.charAt(0).toUpperCase() + v.category.slice(1),
      dailyRate: parseFloat(v.daily_rate),
      weeklyRate: v.weekly_rate ? parseFloat(v.weekly_rate) : undefined,
      seats: v.seats,
      fuel: v.fuel_type === 'gasoline' ? 'Gas' : v.fuel_type,
      mpg: 30,
      transmission: v.transmission ? v.transmission.charAt(0).toUpperCase() + v.transmission.slice(1) : 'Automatic',
      image: heroImage,
      images: [heroImage, sideImage, rearImage].filter(Boolean),
      heroImage,
      sideImage,
      rearImage,
      description: v.notes || '',
      features: v.features || [],
      included: [`${v.mileage_limit_per_day || 150} miles per day included`, 'Professionally cleaned before each rental', '24/7 roadside assistance'],
    };
  });

  res.json(catalog);
}));

/** GET /vehicles/available — public availability check for date range */
router.get('/available', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });

  const vehicles = await getAvailableVehicles(start, end);
  res.json(vehicles);
}));

/** POST /vehicles/enrich-vin — auto-fill vehicle data from VIN (admin) */
router.post('/enrich-vin', requireAuth, asyncHandler(async (req, res) => {
  const { vin } = req.body;
  if (!vin || vin.length !== 17) {
    return res.status(400).json({ error: 'Valid 17-character VIN required' });
  }

  const enriched = await enrichVehicle(vin);
  if (!enriched) {
    return res.status(404).json({ error: 'Could not decode VIN — check the number and try again' });
  }

  res.json(enriched);
}));

/** GET /vehicles/:id — single vehicle (admin) */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, bookings(id, booking_code, pickup_date, return_date, status, customers(first_name, last_name))')
    .eq('id', req.params.id)
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
}));

/** GET /vehicles/:id/availability — public date range check */
router.get('/:id/availability', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });

  const result = await checkAvailability(req.params.id, start, end);
  res.json(result);
}));

/** GET /vehicles/:id/blocked-dates — admin */
router.get('/:id/blocked-dates', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('vehicle_id', req.params.id)
    .order('start_date');

  if (error) throw error;
  res.json(data);
}));

/** POST /vehicles/:id/blocked-dates — admin */
router.post('/:id/blocked-dates', requireAuth, asyncHandler(async (req, res) => {
  const { start_date, end_date, reason, notes } = req.body;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });

  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({ vehicle_id: req.params.id, start_date, end_date, reason, notes, created_by: req.user?.email })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/** POST /vehicles — admin */
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(req.body)
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/** PUT /vehicles/:id — admin */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
}));

/** PATCH /vehicles/:id/status — quick status change (admin) */
router.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['available', 'maintenance', 'retired', 'rented', 'turo'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/** DELETE /vehicles/:id — remove vehicle (admin) */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  // Safety check: prevent deleting vehicles with active bookings
  const { data: activeBookings, error: bookingErr } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', req.params.id)
    .in('status', ['pending_approval', 'approved', 'rented'])
    .limit(1);

  if (bookingErr) throw bookingErr;

  if (activeBookings && activeBookings.length > 0) {
    return res.status(409).json({
      error: 'Cannot delete a vehicle with active bookings. Set status to "retired" instead.',
    });
  }

  // Check if vehicle has ANY bookings (including past) — FK constraint would block hard delete
  const { data: allBookings, error: allErr } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', req.params.id)
    .limit(1);

  if (allErr) throw allErr;

  if (allBookings && allBookings.length > 0) {
    // Soft delete — set status to 'deleted' so it's hidden from fleet but preserves booking history
    const { error } = await supabase
      .from('vehicles')
      .update({ status: 'deleted' })
      .eq('id', req.params.id);

    if (error) throw error;
    return res.json({ success: true, soft_deleted: true });
  }

  // Hard delete — no bookings reference this vehicle
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true });
}));

export default router;
