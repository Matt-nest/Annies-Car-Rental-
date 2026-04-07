import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/** GET /search?q=term — global search across bookings, customers, vehicles, payments */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.json({ bookings: [], customers: [], vehicles: [], payments: [] });
  }

  const pattern = `%${q}%`;

  const [bookingsRes, customersRes, vehiclesRes, paymentsRes] = await Promise.all([
    // Bookings — search by booking_code, customer name, vehicle name
    supabase
      .from('bookings')
      .select('id, booking_code, status, pickup_date, return_date, total_cost, customers(first_name, last_name), vehicles(year, make, model)')
      .or(`booking_code.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),

    // Customers — search by name, email, phone
    supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, total_rentals')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),

    // Vehicles — search by make, model, code, plate
    supabase
      .from('vehicles')
      .select('id, vehicle_code, year, make, model, license_plate, status, thumbnail_url')
      .or(`make.ilike.${pattern},model.ilike.${pattern},vehicle_code.ilike.${pattern},license_plate.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),

    // Payments — search by reference_id, join to booking_code
    supabase
      .from('payments')
      .select('id, booking_id, amount, payment_type, method, status, reference_id, paid_at, bookings(booking_code, customers(first_name, last_name))')
      .or(`reference_id.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // For bookings, also search by customer name (second query since Supabase can't do ilike on joined columns)
  let extraBookings = [];
  if (bookingsRes.data?.length < 5) {
    // Find customer IDs matching the query
    const { data: matchingCustomers } = await supabase
      .from('customers')
      .select('id')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
      .limit(10);

    if (matchingCustomers?.length) {
      const customerIds = matchingCustomers.map(c => c.id);
      const { data: customerBookings } = await supabase
        .from('bookings')
        .select('id, booking_code, status, pickup_date, return_date, total_cost, customers(first_name, last_name), vehicles(year, make, model)')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(5);

      extraBookings = customerBookings || [];
    }
  }

  // Merge and dedupe bookings
  const allBookings = [...(bookingsRes.data || [])];
  const seenIds = new Set(allBookings.map(b => b.id));
  for (const b of extraBookings) {
    if (!seenIds.has(b.id)) {
      allBookings.push(b);
      seenIds.add(b.id);
    }
  }

  res.json({
    bookings: allBookings.slice(0, 5),
    customers: customersRes.data || [],
    vehicles: vehiclesRes.data || [],
    payments: paymentsRes.data || [],
  });
}));

export default router;
