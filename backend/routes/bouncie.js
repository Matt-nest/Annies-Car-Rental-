/**
 * Admin Bouncie routes — mounted at /api/v1/admin/bouncie.
 *
 * All endpoints require an authenticated admin/owner. Public OAuth callback
 * and webhook receiver live in routes/bouncieWebhooks.js (separate mount so
 * no JWT is required for those endpoints).
 */

import express from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  signState,
  buildAuthorizeUrl,
  getActiveCredentials,
  disconnect as disconnectBouncie,
  syncVehicles,
  bouncieApi,
  BouncieError,
} from '../services/bouncieService.js';

const router = express.Router();
router.use(requireAuth, requireRole('owner', 'admin'));

// ────────────────────────────────────────────────────────────
// Connection status + lifecycle
// ────────────────────────────────────────────────────────────

router.get('/status', asyncHandler(async (req, res) => {
  const creds = await getActiveCredentials();
  if (!creds) return res.json({ connected: false });

  const expiresMs = new Date(creds.token_expires_at).getTime();
  return res.json({
    connected: true,
    bouncie_user_email: creds.bouncie_user_email,
    connected_at: creds.connected_at,
    token_expires_at: creds.token_expires_at,
    token_expired: expiresMs < Date.now(),
  });
}));

router.get('/oauth/start', asyncHandler(async (req, res) => {
  const state = signState(req.user.id);
  return res.json({ authorize_url: buildAuthorizeUrl(state) });
}));

router.post('/disconnect', asyncHandler(async (req, res) => {
  await disconnectBouncie();
  return res.json({ success: true });
}));

// ────────────────────────────────────────────────────────────
// Vehicle sync + mapping
// ────────────────────────────────────────────────────────────

router.post('/sync', asyncHandler(async (req, res) => {
  try {
    const result = await syncVehicles();
    return res.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof BouncieError) return res.status(502).json({ error: e.message });
    throw e;
  }
}));

router.get('/vehicles', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('bouncie_vehicles')
    .select('*, vehicles(id, year, make, model, license_plate, vehicle_code)')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ vehicles: data || [] });
}));

router.patch('/vehicles/:id/mapping', asyncHandler(async (req, res) => {
  const { annie_vehicle_id } = req.body || {};
  // null is allowed — un-map
  const { error } = await supabase
    .from('bouncie_vehicles')
    .update({ annie_vehicle_id: annie_vehicle_id || null, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}));

// ────────────────────────────────────────────────────────────
// Trips
// ────────────────────────────────────────────────────────────

router.get('/trips', asyncHandler(async (req, res) => {
  const { vehicle_id, booking_id, since, limit = 50 } = req.query;
  let q = supabase
    .from('bouncie_trips')
    .select('*, vehicles(id, year, make, model, vehicle_code), bookings(id, booking_code)')
    .order('start_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (vehicle_id) q = q.eq('annie_vehicle_id', vehicle_id);
  if (booking_id) q = q.eq('annie_booking_id', booking_id);
  if (since) q = q.gte('start_at', since);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ trips: data || [] });
}));

router.post('/trips/refresh', asyncHandler(async (req, res) => {
  // Pull fresh trips from Bouncie /trips REST endpoint for a date window
  const { starts_after, starts_before } = req.body || {};
  const params = {};
  if (starts_after) params['starts-after'] = starts_after;
  if (starts_before) params['starts-before'] = starts_before;
  params['gps-format'] = 'polyline';

  let bouncieTrips;
  try {
    bouncieTrips = await bouncieApi.getTrips(params);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  const trips = Array.isArray(bouncieTrips) ? bouncieTrips : (bouncieTrips?.trips || []);

  let upserted = 0;
  for (const t of trips) {
    const txnId = t.transactionId || t.id;
    if (!txnId) continue;
    // Resolve annie_vehicle_id via imei lookup
    const imei = t.imei || null;
    let annieVehicleId = null;
    if (imei) {
      const { data: bv } = await supabase
        .from('bouncie_vehicles')
        .select('annie_vehicle_id')
        .eq('imei', imei)
        .maybeSingle();
      annieVehicleId = bv?.annie_vehicle_id || null;
    }

    await supabase.from('bouncie_trips').upsert({
      bouncie_transaction_id: txnId,
      imei: imei || '',
      annie_vehicle_id: annieVehicleId,
      start_at: t.startTime || t.start || null,
      end_at: t.endTime || t.end || null,
      duration_seconds: t.durationSeconds ?? null,
      distance_miles: t.distance ?? null,
      avg_speed_mph: t.averageSpeed ?? null,
      max_speed_mph: t.maxSpeed ?? null,
      fuel_consumed_gallons: t.fuelConsumed ?? null,
      hard_brake_count: t.hardBrakingCount ?? 0,
      hard_accel_count: t.hardAccelerationCount ?? 0,
      start_lat: t.startLocation?.lat ?? null,
      start_lng: t.startLocation?.lon ?? t.startLocation?.lng ?? null,
      end_lat: t.endLocation?.lat ?? null,
      end_lng: t.endLocation?.lon ?? t.endLocation?.lng ?? null,
      start_address: t.startLocation?.address ?? null,
      end_address: t.endLocation?.address ?? null,
      gps_polyline: typeof t.gps === 'string' ? t.gps : (t.gps?.polyline ?? null),
      gps_geojson: typeof t.gps === 'object' ? t.gps : null,
      raw_json: t,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bouncie_transaction_id' });
    upserted += 1;
  }
  return res.json({ success: true, fetched: trips.length, upserted });
}));

// ────────────────────────────────────────────────────────────
// Events / alerts feed
// ────────────────────────────────────────────────────────────

router.get('/events', asyncHandler(async (req, res) => {
  const { limit = 50, type, source, imei, errors_only } = req.query;
  let q = supabase
    .from('bouncie_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (type) q = q.eq('event_type', type);
  if (source) q = q.eq('source', source);
  if (imei) q = q.eq('imei', imei);
  if (errors_only === 'true') q = q.not('error_text', 'is', null);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ events: data || [] });
}));

// ────────────────────────────────────────────────────────────
// Geo-zones — local CRUD; mirrors to Bouncie via 3-step create
// ────────────────────────────────────────────────────────────

router.get('/geozones', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('bouncie_geozones')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ geozones: data || [] });
}));

router.post('/geozones', asyncHandler(async (req, res) => {
  const { name, geometry_type, center_lat, center_lng, radius_meters, polygon_geojson, alert_on_enter, alert_on_exit } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!geometry_type || !['circle', 'polygon'].includes(geometry_type)) {
    return res.status(400).json({ error: 'geometry_type must be circle or polygon' });
  }
  if (geometry_type === 'circle' && (center_lat == null || center_lng == null || !radius_meters)) {
    return res.status(400).json({ error: 'Circle geozone requires center_lat, center_lng, radius_meters' });
  }

  // Three-step create against Bouncie
  let bouncieLocationId = null;
  let bouncieGeozoneId = null;
  try {
    const locationBody = geometry_type === 'circle'
      ? { name, type: 'circle', center: { lat: center_lat, lon: center_lng }, radius: radius_meters }
      : { name, type: 'polygon', polygon: polygon_geojson };
    const locRes = await bouncieApi.createLocation(locationBody);
    bouncieLocationId = locRes?.id || locRes?.data?.id || null;

    const gzRes = await bouncieApi.createGeozone({
      name,
      locationId: bouncieLocationId,
      alertOnEnter: !!alert_on_enter,
      alertOnExit: alert_on_exit !== false,
    });
    bouncieGeozoneId = gzRes?.id || gzRes?.data?.id || null;
  } catch (e) {
    return res.status(502).json({ error: `Bouncie geozone create failed: ${e.message}` });
  }

  const { data, error } = await supabase
    .from('bouncie_geozones')
    .insert({
      name,
      bouncie_location_id: bouncieLocationId,
      bouncie_geozone_id: bouncieGeozoneId,
      geometry_type,
      center_lat: center_lat || null,
      center_lng: center_lng || null,
      radius_meters: radius_meters || null,
      polygon_geojson: polygon_geojson || null,
      alert_on_enter: !!alert_on_enter,
      alert_on_exit: alert_on_exit !== false,
      created_by: req.user.id,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ geozone: data });
}));

router.delete('/geozones/:id', asyncHandler(async (req, res) => {
  const { data: row } = await supabase
    .from('bouncie_geozones')
    .select('bouncie_geozone_id, bouncie_location_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!row) return res.status(404).json({ error: 'Geozone not found' });

  // Best-effort delete on Bouncie side first; if it 404s, still delete locally.
  try {
    if (row.bouncie_geozone_id) await bouncieApi.deleteGeozone(row.bouncie_geozone_id);
    if (row.bouncie_location_id) await bouncieApi.deleteLocation(row.bouncie_location_id);
  } catch (e) {
    console.warn('[Bouncie] Remote geozone delete failed (continuing with local delete):', e.message);
  }

  const { error } = await supabase.from('bouncie_geozones').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}));

// ────────────────────────────────────────────────────────────
// Stats — quick numbers for the Overview tab
// ────────────────────────────────────────────────────────────

router.get('/stats', asyncHandler(async (req, res) => {
  const [{ count: vehicleCount }, { count: tripsCount }, { count: alertCount }] = await Promise.all([
    supabase.from('bouncie_vehicles').select('id', { count: 'exact', head: true }),
    supabase.from('bouncie_trips').select('id', { count: 'exact', head: true }),
    supabase.from('bouncie_events').select('id', { count: 'exact', head: true }).in('event_type', ['mil', 'battery', 'disconnect']),
  ]);

  // Last sync = newest last_synced_at among bouncie_vehicles
  const { data: latest } = await supabase
    .from('bouncie_vehicles')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return res.json({
    vehicles: vehicleCount || 0,
    trips: tripsCount || 0,
    alerts: alertCount || 0,
    last_synced_at: latest?.last_synced_at || null,
  });
}));

export default router;
