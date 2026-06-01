/**
 * Public Bouncie endpoints — no admin JWT required.
 *
 *   GET  /oauth/callback   — Bouncie's redirect target after user grants access.
 *                            Verifies state, exchanges code, persists tokens,
 *                            then redirects the admin's browser to the dashboard.
 *
 *   POST /webhook          — Bouncie POSTs telematics events here. Auth is a
 *                            shared static secret in the `Authorization` header
 *                            (Bouncie does NOT sign payloads). Constant-time
 *                            comparison + Authorization-OR-X-Bouncie-Authorization
 *                            fallback per Bouncie's docs.
 *
 * Both endpoints log the incoming request to bouncie_events for debugging.
 */

import express from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';
import {
  verifyState,
  exchangeCodeForTokens,
  saveCredentials,
  bouncieApi,
  lookupAnnieVehicleByImei,
  webhookSecret,
} from '../services/bouncieService.js';

const router = express.Router();

// ────────────────────────────────────────────────────────────
// OAuth callback — Bouncie -> our backend -> dashboard
// ────────────────────────────────────────────────────────────
router.get('/oauth/callback', asyncHandler(async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const dashboardBase = process.env.DASHBOARD_URL || process.env.SITE_URL || '';

  if (oauthError) {
    return res.redirect(`${dashboardBase}/telematics?connect_error=${encodeURIComponent(String(oauthError))}`);
  }
  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  let adminUserId = null;
  try {
    const verified = verifyState(String(state));
    adminUserId = verified.uid || null;
  } catch (e) {
    return res.redirect(`${dashboardBase}/telematics?connect_error=${encodeURIComponent('Invalid state — please retry from the Telematics page')}`);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(String(code));
  } catch (e) {
    return res.redirect(`${dashboardBase}/telematics?connect_error=${encodeURIComponent(e.message || 'Token exchange failed')}`);
  }

  // Best-effort fetch of the Bouncie user's email for display (uses the
  // brand-new access token directly so getAccessToken doesn't reload nothing).
  let bouncieEmail = null;
  try {
    const userRes = await fetch('https://api.bouncie.dev/v1/user', {
      headers: { 'Authorization': tokens.access_token },
    });
    if (userRes.ok) {
      const userJson = await userRes.json();
      bouncieEmail = userJson?.email || userJson?.data?.email || null;
    }
  } catch { /* non-fatal */ }

  try {
    await saveCredentials({ tokens, adminUserId, bouncieUserEmail: bouncieEmail });
  } catch (e) {
    return res.redirect(`${dashboardBase}/telematics?connect_error=${encodeURIComponent(e.message || 'Failed to save credentials')}`);
  }

  return res.redirect(`${dashboardBase}/telematics?connected=1`);
}));

// ────────────────────────────────────────────────────────────
// Webhook receiver — ingests 11 event types from Bouncie
// ────────────────────────────────────────────────────────────

function checkWebhookAuth(req) {
  const expected = webhookSecret();
  if (!expected) return false; // no secret set ⇒ refuse all
  const got = req.headers['authorization'] || req.headers['x-bouncie-authorization'] || '';
  if (!got || got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(String(got)), Buffer.from(expected));
  } catch {
    return false;
  }
}

function tripCoords(body, key) {
  const o = body[key];
  if (!o) return { lat: null, lng: null, address: null, timestamp: null };
  return {
    lat: o.latitude ?? o.lat ?? null,
    lng: o.longitude ?? o.lon ?? o.lng ?? null,
    address: o.address ?? null,
    timestamp: o.timestamp ?? null,
  };
}

router.post('/webhook', asyncHandler(async (req, res) => {
  // ── Auth ──
  if (!checkWebhookAuth(req)) {
    // Log the rejected attempt for debugging
    supabase.from('bouncie_events').insert({
      event_type: 'webhook_rejected',
      source: 'webhook',
      payload: { headers: { authorization: req.headers['authorization'] ? '<redacted>' : null } },
      error_text: 'Invalid or missing webhook secret',
    }).then(() => {});
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const body = req.body || {};
  const eventType = body.eventType || 'unknown';
  const imei = body.imei || null;
  const vin = body.vin || null;
  const annieVehicleId = await lookupAnnieVehicleByImei(imei);

  // Audit log — always
  const eventRow = {
    event_type: eventType,
    source: 'webhook',
    imei,
    vin,
    annie_vehicle_id: annieVehicleId,
    payload: body,
    received_at: new Date().toISOString(),
  };

  // ── Process by event type ──
  try {
    switch (eventType) {
      case 'connect': {
        const ev = body.connect || {};
        await supabase.from('bouncie_vehicles').update({
          last_lat: ev.latitude ?? null,
          last_lng: ev.longitude ?? null,
          last_engine_running: true,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('imei', imei);
        break;
      }
      case 'disconnect': {
        const ev = body.disconnect || {};
        await supabase.from('bouncie_vehicles').update({
          last_lat: ev.latitude ?? null,
          last_lng: ev.longitude ?? null,
          last_engine_running: false,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('imei', imei);
        // Admin alert: device unplugged or tampered with
        await createNotification(
          'bouncie_disconnect',
          `Bouncie device disconnected${vin ? ` — VIN ${vin.slice(-6)}` : ''}`,
          `IMEI ${imei || '?'} reported a disconnect (unplug or power loss). Verify the vehicle physically.`,
          annieVehicleId ? `/fleet/${annieVehicleId}` : '/telematics',
          { imei, vin, annie_vehicle_id: annieVehicleId }
        );
        break;
      }
      case 'vinChange': {
        // VIN of the vehicle on this dongle changed — re-attempt VIN match
        const newVin = body.vinChange?.vin || vin;
        if (newVin) {
          const { data: match } = await supabase.from('vehicles').select('id').ilike('vin', newVin).maybeSingle();
          await supabase.from('bouncie_vehicles').update({
            vin: newVin,
            annie_vehicle_id: match?.id || null,
            updated_at: new Date().toISOString(),
          }).eq('imei', imei);
        }
        break;
      }
      case 'mil': {
        const ev = body.mil || {};
        const codes = ev.codes || '';
        await supabase.from('bouncie_vehicles').update({
          last_mil_status: ev.value || 'ON',
          last_dtc_codes: codes,
          updated_at: new Date().toISOString(),
        }).eq('imei', imei);
        await createNotification(
          'bouncie_mil',
          `Check-engine light ON${vin ? ` — VIN ${vin.slice(-6)}` : ''}`,
          `Diagnostic codes: ${codes || 'unknown'}. Investigate before the next rental.`,
          annieVehicleId ? `/fleet/${annieVehicleId}` : '/telematics',
          { imei, vin, codes, annie_vehicle_id: annieVehicleId }
        );
        break;
      }
      case 'battery': {
        const ev = body.battery || {};
        await supabase.from('bouncie_vehicles').update({
          last_battery_status: ev.value || null,
          updated_at: new Date().toISOString(),
        }).eq('imei', imei);
        if (ev.value === 'low' || ev.value === 'critical') {
          await createNotification(
            'bouncie_battery_low',
            `Vehicle battery ${ev.value}${vin ? ` — VIN ${vin.slice(-6)}` : ''}`,
            `The Bouncie dongle is reporting ${ev.value} battery voltage. Charge or replace soon.`,
            annieVehicleId ? `/fleet/${annieVehicleId}` : '/telematics',
            { imei, vin, status: ev.value, annie_vehicle_id: annieVehicleId }
          );
        }
        break;
      }
      case 'tripStart': {
        const ev = body.tripStart || {};
        await supabase.from('bouncie_trips').upsert({
          bouncie_transaction_id: ev.transactionId || `${imei}-${ev.timestamp}`,
          imei: imei || '',
          annie_vehicle_id: annieVehicleId,
          start_at: ev.timestamp || null,
          start_lat: ev.latitude ?? null,
          start_lng: ev.longitude ?? null,
          start_address: ev.address ?? null,
          raw_json: body,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bouncie_transaction_id' });
        break;
      }
      case 'tripEnd': {
        const ev = body.tripEnd || {};
        await supabase.from('bouncie_trips').upsert({
          bouncie_transaction_id: ev.transactionId || `${imei}-${ev.timestamp}`,
          imei: imei || '',
          annie_vehicle_id: annieVehicleId,
          end_at: ev.timestamp || null,
          end_lat: ev.latitude ?? null,
          end_lng: ev.longitude ?? null,
          end_address: ev.address ?? null,
          raw_json: body,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bouncie_transaction_id' });
        break;
      }
      case 'tripMetrics': {
        const ev = body.tripMetrics || {};
        const start = tripCoords(ev, 'startLocation');
        const end = tripCoords(ev, 'endLocation');
        await supabase.from('bouncie_trips').upsert({
          bouncie_transaction_id: ev.transactionId || `${imei}-${ev.startTime || ev.timestamp}`,
          imei: imei || '',
          annie_vehicle_id: annieVehicleId,
          start_at: ev.startTime || null,
          end_at: ev.endTime || null,
          duration_seconds: ev.durationSeconds ?? null,
          distance_miles: ev.distance ?? null,
          avg_speed_mph: ev.averageSpeed ?? null,
          max_speed_mph: ev.maxSpeed ?? null,
          fuel_consumed_gallons: ev.fuelConsumed ?? null,
          hard_brake_count: ev.hardBrakingCount ?? 0,
          hard_accel_count: ev.hardAccelerationCount ?? 0,
          start_lat: start.lat,
          start_lng: start.lng,
          start_address: start.address,
          end_lat: end.lat,
          end_lng: end.lng,
          end_address: end.address,
          raw_json: body,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bouncie_transaction_id' });
        break;
      }
      case 'tripData': {
        // Continuous GPS pings during a trip. We don't store every ping (would be
        // millions of rows); just update the vehicle's last-known location.
        const points = body.tripData?.gps || body.tripData?.points || [];
        const latest = Array.isArray(points) && points.length ? points[points.length - 1] : null;
        if (latest) {
          await supabase.from('bouncie_vehicles').update({
            last_lat: latest.lat ?? latest.latitude ?? null,
            last_lng: latest.lon ?? latest.lng ?? latest.longitude ?? null,
            last_heading: latest.heading ?? null,
            last_speed_mph: latest.speed ?? null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('imei', imei);
        }
        break;
      }
      case 'applicationGeozone':
      case 'userGeozone': {
        const ev = body[eventType] || {};
        const direction = ev.direction || ev.action; // 'enter' | 'exit'
        await createNotification(
          'bouncie_geozone',
          `Geo-zone ${direction || 'event'} — ${ev.name || 'unnamed zone'}`,
          `${vin ? `VIN ${vin.slice(-6)}` : `IMEI ${imei}`} ${direction === 'exit' ? 'left' : 'entered'} ${ev.name || 'a zone'}.`,
          annieVehicleId ? `/fleet/${annieVehicleId}` : '/telematics',
          { imei, vin, direction, zone_name: ev.name, annie_vehicle_id: annieVehicleId }
        );
        break;
      }
      default:
        // unknown event types are still audit-logged
        break;
    }
    eventRow.processed_at = new Date().toISOString();
  } catch (e) {
    eventRow.error_text = e.message;
    console.error('[Bouncie webhook] processing error:', e);
  }

  await supabase.from('bouncie_events').insert(eventRow);

  // Always 2xx so Bouncie doesn't retry — we've already persisted to bouncie_events
  return res.json({ ok: true });
}));

export default router;
