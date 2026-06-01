import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Satellite, Wifi, WifiOff, RefreshCw, MapPin, Car, AlertTriangle,
  Activity, Settings as SettingsIcon, MapPinned, ChevronRight,
  CheckCircle2, XCircle, Loader2, Battery, Fuel, Gauge, Zap,
  Plus, Trash2, Clock, Navigation,
} from 'lucide-react';
import { format } from 'date-fns';
import Map, { Marker, NavigationControl, Source, Layer, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { bouncieApi } from '../api/bouncie';
import { api } from '../api/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const TABS = [
  { key: 'overview',  label: 'Overview',  icon: Activity },
  { key: 'vehicles',  label: 'Vehicles',  icon: Car },
  { key: 'trips',     label: 'Trips',     icon: Navigation },
  { key: 'alerts',    label: 'Alerts',    icon: AlertTriangle },
  { key: 'geozones',  label: 'Geo-Zones', icon: MapPinned },
  { key: 'settings',  label: 'Settings',  icon: SettingsIcon },
];

/* ──────────────────────────────────────────────────────────
   Tiny encoded-polyline decoder so we can render trip GPS
   without pulling in @mapbox/polyline as another dep.
   Algorithm: Google's encoded-polyline format.
   Returns [[lng,lat], ...] for direct GeoJSON consumption.
   ────────────────────────────────────────────────────────── */
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const out = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1); lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1); lng += dlng;
    out.push([lng * 1e-5, lat * 1e-5]);
  }
  return out;
}

/* Use the page's actual theme — checks the same `dark` class everything else does. */
function useTheme() {
  const [dark, setDark] = useState(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark ? 'dark' : 'light';
}

/* ──────────────────────────────────────────────────────────
   Shared little components
   ────────────────────────────────────────────────────────── */
function StatTile({ icon: Icon, label, value, sublabel, accent = '#465FFF' }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}1A`, color: accent }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">{label}</p>
        <p className="text-2xl font-semibold mt-0.5 font-mono text-[var(--text-primary)]">{value}</p>
        {sublabel && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function Pill({ children, color = '#94a3b8' }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}26`, color }}>
      {children}
    </span>
  );
}

function VehicleMarkerDot({ engine }) {
  const color = engine === true ? '#22c55e' : engine === false ? '#94a3b8' : '#eab308';
  return (
    <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow"
      style={{ backgroundColor: color }} />
  );
}

/* ──────────────────────────────────────────────────────────
   FleetMap — used by Overview and Vehicles tabs
   ────────────────────────────────────────────────────────── */
function FleetMap({ vehicles, height = 360, polyline = null, theme }) {
  const [popup, setPopup] = useState(null);
  const styled = useMemo(() =>
    theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12'
  , [theme]);

  const points = vehicles.filter(v => v.last_lat != null && v.last_lng != null);

  const initialViewState = useMemo(() => {
    if (points.length === 0) {
      return { latitude: 27.27, longitude: -80.36, zoom: 9 }; // Port St. Lucie default
    }
    if (points.length === 1) {
      return { latitude: Number(points[0].last_lat), longitude: Number(points[0].last_lng), zoom: 12 };
    }
    const lats = points.map(p => Number(p.last_lat));
    const lngs = points.map(p => Number(p.last_lng));
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: 9,
    };
  }, [points]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="card flex flex-col items-center justify-center text-center p-8" style={{ height }}>
        <MapPin size={28} className="text-[var(--text-tertiary)] mb-2" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">Mapbox token missing</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-md">
          Set <code className="font-mono">VITE_MAPBOX_TOKEN</code> in Vercel → dashboard project env vars and redeploy. Free tier provides 50k loads/month.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden" style={{ height, padding: 0 }}>
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={styled}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {points.map(v => (
          <Marker
            key={v.id || v.imei}
            latitude={Number(v.last_lat)}
            longitude={Number(v.last_lng)}
            anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); setPopup(v); }}
          >
            <VehicleMarkerDot engine={v.last_engine_running} />
          </Marker>
        ))}
        {popup && (
          <Popup
            latitude={Number(popup.last_lat)}
            longitude={Number(popup.last_lng)}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeButton={true}
            closeOnClick={false}
            offset={14}
          >
            <div className="text-xs space-y-0.5" style={{ color: '#0f172a' }}>
              <p className="font-semibold">
                {popup.vehicles?.vehicle_code ? `#${popup.vehicles.vehicle_code} · ` : ''}
                {popup.bouncie_year} {popup.bouncie_make} {popup.bouncie_model}
              </p>
              {popup.last_address && <p className="opacity-70">{popup.last_address}</p>}
              <p className="opacity-70">
                {popup.last_engine_running ? 'Engine on' : 'Engine off'}
                {popup.last_speed_mph != null ? ` · ${Math.round(popup.last_speed_mph)} mph` : ''}
                {popup.last_fuel_pct != null ? ` · ${Math.round(popup.last_fuel_pct)}% fuel` : ''}
              </p>
            </div>
          </Popup>
        )}
        {polyline && polyline.length > 1 && (
          <Source id="trip" type="geojson" data={{
            type: 'Feature', geometry: { type: 'LineString', coordinates: polyline },
          }}>
            <Layer id="trip-line" type="line"
              paint={{ 'line-color': '#465FFF', 'line-width': 4, 'line-opacity': 0.85 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </Source>
        )}
      </Map>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Not-connected empty state
   ────────────────────────────────────────────────────────── */
function NotConnectedState({ onConnect, connecting, error }) {
  return (
    <div className="card flex flex-col items-center text-center p-10">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(70,95,255,0.12)', color: '#465FFF' }}>
        <Satellite size={28} />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Connect your Bouncie account</h3>
      <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-md">
        Pull live GPS, trip history, mileage, and engine diagnostics for every car in your fleet.
        Authentication is one click — Bouncie sends you to their login page and back.
      </p>
      <button onClick={onConnect} disabled={connecting}
        className="btn btn-primary mt-5 flex items-center gap-2"
        style={{ minWidth: 220, justifyContent: 'center' }}>
        {connecting ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
        {connecting ? 'Opening Bouncie…' : 'Connect Bouncie'}
      </button>
      {error && (
        <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Overview
   ══════════════════════════════════════════════════════════ */
function OverviewTab({ stats, vehicles, alerts, theme, onSync, syncing }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Car} label="Vehicles" value={stats?.vehicles ?? 0} accent="#465FFF" />
        <StatTile icon={Navigation} label="Trips logged" value={stats?.trips ?? 0} accent="#22c55e" />
        <StatTile icon={AlertTriangle} label="Health alerts" value={stats?.alerts ?? 0} accent="#ef4444" />
        <StatTile
          icon={Clock}
          label="Last sync"
          value={stats?.last_synced_at ? format(new Date(stats.last_synced_at), 'h:mm a') : '—'}
          sublabel={stats?.last_synced_at ? format(new Date(stats.last_synced_at), 'MMM d') : 'never'}
          accent="#eab308"
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Fleet map</h3>
        <button onClick={onSync} disabled={syncing}
          className="btn btn-secondary text-xs flex items-center gap-1.5">
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <FleetMap vehicles={vehicles} theme={theme} height={420} />

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Recent alerts</h3>
        {alerts.length === 0 ? (
          <div className="card p-4 text-xs text-[var(--text-tertiary)] text-center">
            No telematics alerts yet. You'll see disconnects, low battery, and check-engine codes here.
          </div>
        ) : (
          <div className="card divide-y divide-[var(--border-subtle)]">
            {alerts.slice(0, 8).map(e => <AlertRow key={e.id} ev={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Vehicles (with manual VIN mapping)
   ══════════════════════════════════════════════════════════ */
function VehiclesTab({ vehicles, annieVehicles, onMap, theme }) {
  return (
    <div className="space-y-5">
      <FleetMap vehicles={vehicles} theme={theme} height={340} />
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              <th className="text-left px-4 py-2">Bouncie vehicle</th>
              <th className="text-left px-4 py-2">VIN</th>
              <th className="text-left px-4 py-2">Mapped to fleet</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {vehicles.length === 0 && (
              <tr><td colSpan={5} className="text-center text-xs text-[var(--text-tertiary)] py-8">
                No Bouncie vehicles. Click <strong>Sync now</strong> on Overview after connecting.
              </td></tr>
            )}
            {vehicles.map(v => (
              <tr key={v.id} className="hover:bg-[var(--bg-elevated)]">
                <td className="px-4 py-2 text-[var(--text-primary)]">
                  <p className="font-medium">{v.bouncie_year} {v.bouncie_make} {v.bouncie_model}</p>
                  {v.bouncie_nickname && <p className="text-[10px] text-[var(--text-tertiary)]">{v.bouncie_nickname}</p>}
                  <p className="text-[10px] font-mono text-[var(--text-tertiary)]">IMEI {v.imei}</p>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">{v.vin || '—'}</td>
                <td className="px-4 py-2">
                  <select
                    className="input text-xs"
                    value={v.annie_vehicle_id || ''}
                    onChange={e => onMap(v.id, e.target.value || null)}
                  >
                    <option value="">Not mapped</option>
                    {annieVehicles.map(av => (
                      <option key={av.id} value={av.id}>
                        {av.vehicle_code ? `#${av.vehicle_code} — ` : ''}{av.year} {av.make} {av.model}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {v.last_engine_running === true && <Pill color="#22c55e">Engine on</Pill>}
                    {v.last_engine_running === false && <Pill color="#94a3b8">Engine off</Pill>}
                    {v.last_mil_status === 'ON' && <Pill color="#ef4444">MIL</Pill>}
                    {v.last_battery_status === 'low' && <Pill color="#eab308">Low batt</Pill>}
                    {v.last_battery_status === 'critical' && <Pill color="#ef4444">Crit batt</Pill>}
                    {v.last_fuel_pct != null && (
                      <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                        <Fuel size={10} /> {Math.round(v.last_fuel_pct)}%
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-[11px] text-[var(--text-tertiary)]">
                  {v.last_synced_at ? format(new Date(v.last_synced_at), 'MMM d, h:mm a') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Trips
   ══════════════════════════════════════════════════════════ */
function TripsTab({ trips, theme, onRefresh, refreshing }) {
  const [selected, setSelected] = useState(null);
  const decoded = useMemo(() => {
    if (!selected) return null;
    if (selected.gps_geojson?.coordinates) return selected.gps_geojson.coordinates;
    if (selected.gps_polyline) return decodePolyline(selected.gps_polyline);
    return null;
  }, [selected]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-tertiary)]">
          Trips arrive automatically via webhook. Click <strong>Refresh from Bouncie</strong> to pull older history.
        </p>
        <button onClick={onRefresh} disabled={refreshing}
          className="btn btn-secondary text-xs flex items-center gap-1.5">
          {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh from Bouncie
        </button>
      </div>

      {selected && (
        <div className="card p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {selected.vehicles ? `${selected.vehicles.year} ${selected.vehicles.make} ${selected.vehicles.model}` : `IMEI ${selected.imei}`}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {selected.start_at ? format(new Date(selected.start_at), 'MMM d, h:mm a') : '—'}
                {' → '}
                {selected.end_at ? format(new Date(selected.end_at), 'h:mm a') : '—'}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="btn btn-ghost text-xs">Close</button>
          </div>
          <FleetMap
            vehicles={selected.start_lat != null ? [{
              id: 'start', imei: 'start', last_lat: selected.start_lat, last_lng: selected.start_lng,
            }] : []}
            polyline={decoded}
            theme={theme}
            height={300}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Field label="Distance" value={selected.distance_miles != null ? `${Number(selected.distance_miles).toFixed(1)} mi` : '—'} />
            <Field label="Duration" value={selected.duration_seconds ? `${Math.round(selected.duration_seconds / 60)} min` : '—'} />
            <Field label="Avg / Max speed" value={`${selected.avg_speed_mph || '—'} / ${selected.max_speed_mph || '—'} mph`} />
            <Field label="Hard brake / accel" value={`${selected.hard_brake_count} / ${selected.hard_accel_count}`} />
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              <th className="text-left px-4 py-2">When</th>
              <th className="text-left px-4 py-2">Vehicle</th>
              <th className="text-left px-4 py-2">Booking</th>
              <th className="text-left px-4 py-2">Distance</th>
              <th className="text-left px-4 py-2">Max speed</th>
              <th className="text-left px-4 py-2">Events</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {trips.length === 0 && (
              <tr><td colSpan={7} className="text-center text-xs text-[var(--text-tertiary)] py-8">
                No trips yet.
              </td></tr>
            )}
            {trips.map(t => (
              <tr key={t.id} className="hover:bg-[var(--bg-elevated)] cursor-pointer" onClick={() => setSelected(t)}>
                <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">
                  {t.start_at ? format(new Date(t.start_at), 'MMM d, h:mm a') : '—'}
                </td>
                <td className="px-4 py-2 text-xs">
                  {t.vehicles
                    ? `${t.vehicles.vehicle_code ? `#${t.vehicles.vehicle_code} ` : ''}${t.vehicles.year} ${t.vehicles.make} ${t.vehicles.model}`
                    : <span className="font-mono text-[var(--text-tertiary)]">{t.imei}</span>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {t.bookings ? (
                    <Link to={`/bookings/${t.bookings.id}`} className="text-[#465FFF] hover:underline" onClick={e => e.stopPropagation()}>
                      {t.bookings.booking_code}
                    </Link>
                  ) : <span className="text-[var(--text-tertiary)]">—</span>}
                </td>
                <td className="px-4 py-2 text-xs">{t.distance_miles != null ? `${Number(t.distance_miles).toFixed(1)} mi` : '—'}</td>
                <td className="px-4 py-2 text-xs">{t.max_speed_mph != null ? `${Math.round(t.max_speed_mph)} mph` : '—'}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="flex gap-1">
                    {(t.hard_brake_count || 0) > 0 && <Pill color="#eab308">{t.hard_brake_count}× brake</Pill>}
                    {(t.hard_accel_count || 0) > 0 && <Pill color="#f97316">{t.hard_accel_count}× accel</Pill>}
                  </div>
                </td>
                <td className="px-4 py-2"><ChevronRight size={14} className="text-[var(--text-tertiary)]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className="font-mono mt-0.5 text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Alerts
   ══════════════════════════════════════════════════════════ */
const ALERT_LABEL = {
  connect: { label: 'Connect', color: '#22c55e' },
  disconnect: { label: 'Disconnect', color: '#ef4444' },
  mil: { label: 'Check engine', color: '#ef4444' },
  battery: { label: 'Battery', color: '#eab308' },
  vinChange: { label: 'VIN change', color: '#94a3b8' },
  tripStart: { label: 'Trip start', color: '#465FFF' },
  tripEnd: { label: 'Trip end', color: '#465FFF' },
  tripMetrics: { label: 'Trip metrics', color: '#465FFF' },
  tripData: { label: 'Trip data', color: '#94a3b8' },
  applicationGeozone: { label: 'App geo-zone', color: '#f97316' },
  userGeozone: { label: 'User geo-zone', color: '#f97316' },
  rest_call: { label: 'API call', color: '#94a3b8' },
  webhook_rejected: { label: 'Webhook rejected', color: '#ef4444' },
};

function AlertRow({ ev }) {
  const meta = ALERT_LABEL[ev.event_type] || { label: ev.event_type, color: '#94a3b8' };
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}>
        {ev.error_text ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill color={meta.color}>{meta.label}</Pill>
          {ev.imei && <span className="text-[10px] font-mono text-[var(--text-tertiary)]">IMEI {ev.imei}</span>}
          {ev.vin && <span className="text-[10px] font-mono text-[var(--text-tertiary)]">VIN …{ev.vin.slice(-6)}</span>}
        </div>
        {ev.error_text && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{ev.error_text}</p>}
        {ev.request_path && <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">{ev.request_path}{ev.status_code ? ` · ${ev.status_code}` : ''}</p>}
      </div>
      <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">
        {ev.received_at ? format(new Date(ev.received_at), 'MMM d, h:mm a') : '—'}
      </span>
    </div>
  );
}

function AlertsTab({ events, filter, setFilter, errorsOnly, setErrorsOnly }) {
  return (
    <div className="space-y-4">
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--text-tertiary)]">Filter:</span>
        {[null, 'mil', 'battery', 'disconnect', 'tripMetrics', 'applicationGeozone'].map(t => (
          <button key={t || 'all'}
            onClick={() => setFilter(t)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === t ? 'bg-[#465FFF] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
            {t ? ALERT_LABEL[t]?.label || t : 'All'}
          </button>
        ))}
        <label className="ml-auto text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} />
          Errors only
        </label>
      </div>

      <div className="card divide-y divide-[var(--border-subtle)] p-0">
        {events.length === 0 ? (
          <div className="text-xs text-[var(--text-tertiary)] text-center py-8">No events match this filter.</div>
        ) : (
          events.map(e => <AlertRow key={e.id} ev={e} />)
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Geo-Zones
   ══════════════════════════════════════════════════════════ */
function GeozonesTab({ geozones, onCreate, onDelete, creating, theme }) {
  const [form, setForm] = useState({ name: '', center_lat: '', center_lng: '', radius_meters: 1000, alert_on_exit: true, alert_on_enter: false });
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lat = parseFloat(form.center_lat);
    const lng = parseFloat(form.center_lng);
    const radius = parseFloat(form.radius_meters);
    if (!form.name || isNaN(lat) || isNaN(lng) || isNaN(radius)) return;
    await onCreate({
      name: form.name,
      geometry_type: 'circle',
      center_lat: lat,
      center_lng: lng,
      radius_meters: radius,
      alert_on_exit: form.alert_on_exit,
      alert_on_enter: form.alert_on_enter,
    });
    setForm({ name: '', center_lat: '', center_lng: '', radius_meters: 1000, alert_on_exit: true, alert_on_enter: false });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-tertiary)]">
          Geo-zones trigger alerts when a connected vehicle enters or leaves. Common uses: "rental left Florida", "vehicle at unauthorized location."
        </p>
        <button onClick={() => setShowForm(s => !s)} className="btn btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New zone
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Name *</label>
            <input className="input mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Florida service area" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Center latitude *</label>
            <input className="input mt-1" value={form.center_lat} onChange={e => setForm({ ...form, center_lat: e.target.value })} placeholder="27.27" inputMode="decimal" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Center longitude *</label>
            <input className="input mt-1" value={form.center_lng} onChange={e => setForm({ ...form, center_lng: e.target.value })} placeholder="-80.36" inputMode="decimal" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Radius (meters) *</label>
            <input className="input mt-1" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: e.target.value })} placeholder="1000" inputMode="numeric" />
          </div>
          <div className="flex items-end gap-3">
            <label className="text-xs flex items-center gap-1.5">
              <input type="checkbox" checked={form.alert_on_exit} onChange={e => setForm({ ...form, alert_on_exit: e.target.checked })} />
              Alert on exit
            </label>
            <label className="text-xs flex items-center gap-1.5">
              <input type="checkbox" checked={form.alert_on_enter} onChange={e => setForm({ ...form, alert_on_enter: e.target.checked })} />
              Alert on enter
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={creating} className="btn btn-primary text-xs flex items-center gap-1.5">
              {creating ? <Loader2 size={12} className="animate-spin" /> : null} Create zone
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost text-xs">Cancel</button>
          </div>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Center</th>
              <th className="text-left px-4 py-2">Radius</th>
              <th className="text-left px-4 py-2">Alerts</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {geozones.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-xs text-[var(--text-tertiary)] py-6">No geo-zones yet.</td></tr>
            ) : geozones.map(g => (
              <tr key={g.id}>
                <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{g.name}</td>
                <td className="px-4 py-2 text-xs font-mono text-[var(--text-secondary)]">
                  {g.center_lat != null ? `${Number(g.center_lat).toFixed(4)}, ${Number(g.center_lng).toFixed(4)}` : 'polygon'}
                </td>
                <td className="px-4 py-2 text-xs">{g.radius_meters ? `${g.radius_meters} m` : '—'}</td>
                <td className="px-4 py-2 text-xs">
                  {g.alert_on_enter && <Pill color="#22c55e">enter</Pill>}{' '}
                  {g.alert_on_exit && <Pill color="#ef4444">exit</Pill>}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => onDelete(g.id)} className="text-[var(--text-tertiary)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Tab: Settings
   ══════════════════════════════════════════════════════════ */
function SettingsTab({ status, onConnect, onDisconnect, connecting, error, apiBase }) {
  const webhookUrl = `${apiBase}/bouncie/webhook`;
  const callbackUrl = `${apiBase}/bouncie/oauth/callback`;
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            {status?.connected ? <><Wifi size={16} className="text-green-500" /> Connected</> : <><WifiOff size={16} className="text-[var(--text-tertiary)]" /> Not connected</>}
          </p>
          {status?.connected && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {status.bouncie_user_email || 'Unknown account'} ·
              {' '}Connected {status.connected_at ? format(new Date(status.connected_at), 'MMM d, yyyy') : '—'}
            </p>
          )}
        </div>
        {status?.connected ? (
          <button onClick={onDisconnect} className="btn btn-ghost text-xs text-red-500">Disconnect</button>
        ) : (
          <button onClick={onConnect} disabled={connecting} className="btn btn-primary text-xs flex items-center gap-1.5">
            {connecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
            {connecting ? 'Opening…' : 'Connect Bouncie'}
          </button>
        )}
      </div>

      {error && (
        <div className="card p-3 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">One-time setup</p>
        <ol className="text-xs text-[var(--text-secondary)] space-y-2 list-decimal list-inside">
          <li>Register an app at <a href="https://www.bouncie.dev/" target="_blank" rel="noreferrer" className="text-[#465FFF] underline">bouncie.dev</a>.</li>
          <li>Add this <strong>Redirect URI</strong> to your Bouncie app: <code className="font-mono text-[11px] block mt-1 p-2 rounded bg-[var(--bg-elevated)]">{callbackUrl}</code></li>
          <li>Add this <strong>Webhook URL</strong> in the Bouncie dev portal with the events you want pushed (connect, disconnect, mil, battery, tripStart/End/Metrics/Data, applicationGeozone, userGeozone): <code className="font-mono text-[11px] block mt-1 p-2 rounded bg-[var(--bg-elevated)]">{webhookUrl}</code></li>
          <li>Set the webhook's <strong>Authorization</strong> header to the same string as your <code className="font-mono">BOUNCIE_WEBHOOK_SECRET</code> backend env var.</li>
          <li>Set the following backend env vars in Vercel: <code className="font-mono">BOUNCIE_CLIENT_ID</code>, <code className="font-mono">BOUNCIE_CLIENT_SECRET</code>, <code className="font-mono">BOUNCIE_REDIRECT_URI</code>, <code className="font-mono">BOUNCIE_WEBHOOK_SECRET</code>.</li>
          <li>Set <code className="font-mono">VITE_MAPBOX_TOKEN</code> in the dashboard project env vars (Mapbox free tier covers 50k loads/month).</li>
          <li>Come back, click <strong>Connect Bouncie</strong> above.</li>
        </ol>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Mapbox</p>
        <p className="text-xs text-[var(--text-tertiary)]">
          Token detected: <strong>{MAPBOX_TOKEN ? 'Yes' : 'No — set VITE_MAPBOX_TOKEN'}</strong>
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */
export default function TelematicsPage() {
  const theme = useTheme();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('overview');
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [annieVehicles, setAnnieVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [events, setEvents] = useState([]);
  const [geozones, setGeozones] = useState([]);
  const [eventFilter, setEventFilter] = useState(null);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [refreshingTrips, setRefreshingTrips] = useState(false);
  const [creatingGeozone, setCreatingGeozone] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Handle OAuth callback redirect query params
  useEffect(() => {
    const err = params.get('connect_error');
    const ok = params.get('connected');
    if (err) setConnectError(err);
    if (ok) {
      // Clear the query so a refresh doesn't keep saying "Just connected"
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line
  }, []);

  const apiBase = useMemo(() => (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, ''), []);

  async function loadStatus() {
    setLoadingStatus(true);
    try { setStatus(await bouncieApi.status()); }
    catch (e) { setConnectError(e.message); }
    finally { setLoadingStatus(false); }
  }

  async function loadStats() { try { setStats(await bouncieApi.stats()); } catch {} }
  async function loadVehicles() {
    try {
      const { vehicles } = await bouncieApi.getVehicles();
      setVehicles(vehicles || []);
    } catch {}
  }
  async function loadAnnieVehicles() {
    try {
      const list = await api.getVehicles();
      setAnnieVehicles(Array.isArray(list) ? list : (list.vehicles || []));
    } catch {}
  }
  async function loadTrips() { try { const { trips } = await bouncieApi.getTrips({ limit: 100 }); setTrips(trips || []); } catch {} }
  async function loadEvents() {
    try {
      const { events } = await bouncieApi.getEvents({
        limit: 100,
        ...(eventFilter ? { type: eventFilter } : {}),
        ...(errorsOnly ? { errors_only: 'true' } : {}),
      });
      setEvents(events || []);
    } catch {}
  }
  async function loadGeozones() { try { const { geozones } = await bouncieApi.listGeozones(); setGeozones(geozones || []); } catch {} }

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => {
    if (status?.connected) {
      loadStats(); loadVehicles(); loadAnnieVehicles(); loadTrips(); loadEvents(); loadGeozones();
    }
    // eslint-disable-next-line
  }, [status?.connected]);
  useEffect(() => { if (status?.connected) loadEvents(); /* eslint-disable-next-line */ }, [eventFilter, errorsOnly]);

  async function handleConnect() {
    setConnecting(true); setConnectError('');
    try {
      const { authorize_url } = await bouncieApi.startConnect();
      window.location.href = authorize_url;
    } catch (e) {
      setConnectError(e.message || 'Connect failed');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect Bouncie? Existing trip history is kept but no new data will flow.')) return;
    try {
      await bouncieApi.disconnect();
      setStatus({ connected: false });
    } catch (e) { setConnectError(e.message); }
  }

  async function handleSync() {
    setSyncing(true);
    try { await bouncieApi.sync(); await loadVehicles(); await loadStats(); }
    catch (e) { setConnectError(e.message); }
    finally { setSyncing(false); }
  }

  async function handleMap(bouncieVehicleId, annieVehicleId) {
    try { await bouncieApi.setMapping(bouncieVehicleId, annieVehicleId); await loadVehicles(); }
    catch (e) { setConnectError(e.message); }
  }

  async function handleRefreshTrips() {
    setRefreshingTrips(true);
    try {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      await bouncieApi.refreshTrips({ starts_after: since });
      await loadTrips();
    } catch (e) { setConnectError(e.message); }
    finally { setRefreshingTrips(false); }
  }

  async function handleCreateGeozone(body) {
    setCreatingGeozone(true);
    try { await bouncieApi.createGeozone(body); await loadGeozones(); }
    catch (e) { setConnectError(e.message); }
    finally { setCreatingGeozone(false); }
  }

  async function handleDeleteGeozone(id) {
    if (!window.confirm('Delete this geo-zone? Will also remove it from Bouncie.')) return;
    try { await bouncieApi.deleteGeozone(id); await loadGeozones(); }
    catch (e) { setConnectError(e.message); }
  }

  if (loadingStatus) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[var(--text-tertiary)]" /></div>;
  }

  // Not connected? Show the empty state regardless of tab — except Settings
  if (!status?.connected && tab !== 'settings') {
    return (
      <div className="space-y-4">
        <PageHeader />
        <NotConnectedState onConnect={handleConnect} connecting={connecting} error={connectError} />
        <div className="text-center">
          <button onClick={() => setTab('settings')} className="text-xs text-[var(--text-tertiary)] hover:underline">
            Or open Settings to view the one-time setup checklist →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader />
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'overview' && <OverviewTab stats={stats} vehicles={vehicles} alerts={events.slice(0, 10)} theme={theme} onSync={handleSync} syncing={syncing} />}
      {tab === 'vehicles' && <VehiclesTab vehicles={vehicles} annieVehicles={annieVehicles} onMap={handleMap} theme={theme} />}
      {tab === 'trips' && <TripsTab trips={trips} theme={theme} onRefresh={handleRefreshTrips} refreshing={refreshingTrips} />}
      {tab === 'alerts' && <AlertsTab events={events} filter={eventFilter} setFilter={setEventFilter} errorsOnly={errorsOnly} setErrorsOnly={setErrorsOnly} />}
      {tab === 'geozones' && <GeozonesTab geozones={geozones} onCreate={handleCreateGeozone} onDelete={handleDeleteGeozone} creating={creatingGeozone} theme={theme} />}
      {tab === 'settings' && <SettingsTab status={status} onConnect={handleConnect} onDisconnect={handleDisconnect} connecting={connecting} error={connectError} apiBase={apiBase} />}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'rgba(70,95,255,0.12)', color: '#465FFF' }}>
        <Satellite size={20} />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Telematics</h1>
        <p className="text-xs text-[var(--text-tertiary)]">Bouncie GPS, trips, diagnostics, and geo-fencing for your fleet.</p>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }) {
  return (
    <div className="border-b border-[var(--border-subtle)] flex gap-1 overflow-x-auto no-scrollbar">
      {TABS.map(t => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${active ? 'border-[#465FFF] text-[#465FFF]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}
