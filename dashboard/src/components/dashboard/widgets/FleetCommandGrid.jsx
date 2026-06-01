import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

const STATUS_CONFIG = {
  available:   { color: '#22c55e', label: 'Available',    bg: 'rgba(34,197,94,0.1)' },
  rented:      { color: '#465FFF', label: 'Rented',       bg: 'rgba(70,95,255,0.1)' },
  turo:        { color: '#818cf8', label: 'On Turo',      bg: 'rgba(129,140,248,0.1)' },
  maintenance: { color: '#f87171', label: 'Maintenance',  bg: 'rgba(248,113,113,0.1)' },
  retired:     { color: '#737373', label: 'Retired',      bg: 'rgba(115,115,115,0.1)' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'rented', label: 'Rented' },
  { key: 'turo', label: 'Turo' },
  { key: 'maintenance', label: 'Attention' },
];

function getReturnCountdown(vehicle) {
  const booking = vehicle.current_booking || vehicle.active_booking;
  if (!booking) return null;
  const returnDate = booking.return_date;
  const returnTime = booking.return_time || '23:59';
  if (!returnDate) return null;
  const returnDt = new Date(`${returnDate}T${returnTime}`);
  const diffMs = returnDt - Date.now();
  if (diffMs <= 0) return 'Overdue';
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function getRenterName(vehicle) {
  const booking = vehicle.current_booking || vehicle.active_booking;
  return booking?.customers?.first_name || null;
}

// ─── Summary chips ────────────────────────────────────────────────────────────
function SummaryChips({ vehicles }) {
  const total = vehicles.length;
  const available = vehicles.filter((v) => v.status === 'available').length;
  const earning = vehicles.filter((v) => v.status === 'rented' || v.status === 'turo').length;
  const attention = vehicles.filter((v) => v.status === 'maintenance' || v.status === 'retired').length;

  const chips = [
    { label: 'Total', value: total, color: 'var(--text-secondary)', bg: 'var(--bg-card-hover)' },
    { label: 'Available', value: available, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Earning', value: earning, color: '#465FFF', bg: 'rgba(70,95,255,0.1)' },
    ...(attention > 0 ? [{ label: 'Attention', value: attention, color: '#f87171', bg: 'rgba(248,113,113,0.08)' }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-2 px-5 pt-4 pb-2">
      {chips.map((c) => (
        <div key={c.label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: c.bg, color: c.color }}>
          <span className="text-sm font-bold display-num">{c.value}</span>
          <span className="font-medium">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────
function FilterPills({ active, onChange, vehicles }) {
  const counts = {};
  for (const v of vehicles) counts[v.status] = (counts[v.status] || 0) + 1;

  return (
    <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto no-scrollbar">
      {FILTERS.map(({ key, label }) => {
        const count = key === 'all' ? vehicles.length
          : key === 'maintenance' ? (counts.maintenance || 0) + (counts.retired || 0)
          : counts[key] || 0;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              backgroundColor: active === key ? 'var(--accent-color)' : 'var(--bg-card-hover)',
              color: active === key ? 'var(--accent-fg)' : 'var(--text-secondary)',
              border: `1px solid ${active === key ? 'var(--accent-color)' : 'transparent'}`,
            }}
          >
            {label}
            {count > 0 && (
              <span className="text-[10px]" style={{ opacity: active === key ? 0.75 : 0.55 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Vehicle tile ─────────────────────────────────────────────────────────────
function VehicleTile({ vehicle, onClick }) {
  const cfg = STATUS_CONFIG[vehicle.status] || STATUS_CONFIG.available;
  const countdown = getReturnCountdown(vehicle);
  const renterName = getRenterName(vehicle);
  const isOverdue = countdown === 'Overdue';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.18 } }}
      onClick={onClick}
      className="rounded-xl overflow-hidden cursor-pointer flex flex-col"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: `1px solid ${cfg.color}30`,
        boxShadow: `0 0 0 1px ${cfg.color}10`,
      }}
    >
      {/* Status stripe */}
      <div className="h-1 w-full" style={{ backgroundColor: cfg.color }} />

      {/* Image / placeholder */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: 'var(--bg-card)' }}>
        {vehicle.thumbnail_url ? (
          <img
            src={vehicle.thumbnail_url}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car size={28} style={{ color: cfg.color, opacity: 0.4 }} />
          </div>
        )}

        {/* Vehicle code badge */}
        <div className="absolute top-1.5 right-1.5">
          <span className="mono-code text-[9px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
            {vehicle.vehicle_code}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
          {vehicle.year} {vehicle.make}
        </p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{vehicle.model}</p>

        {/* Status + renter */}
        <div className="flex items-center justify-between gap-1 mt-auto pt-1">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>

          {(vehicle.status === 'rented' || vehicle.status === 'turo') && countdown && (
            <div
              className="flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: isOverdue ? '#ef4444' : 'var(--text-tertiary)' }}
            >
              <Clock size={9} />
              {countdown}
            </div>
          )}
        </div>

        {renterName && (
          <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
            ↳ {renterName}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────
export default function FleetCommandGrid() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('vehicles', () => api.getVehicles())
      .then((res) => setVehicles(Array.isArray(res) ? res : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'maintenance') return v.status === 'maintenance' || v.status === 'retired';
    return v.status === 'filter';
  });

  // Fix filter logic
  const filteredVehicles = vehicles.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'maintenance') return v.status === 'maintenance' || v.status === 'retired';
    return v.status === filter;
  });

  const headerAction = (
    <button
      onClick={() => navigate('/fleet')}
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--accent-color)' }}
    >
      Manage →
    </button>
  );

  return (
    <WidgetWrapper
      title="Fleet Command Grid"
      icon={Car}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="fleet"
      headerAction={headerAction}
      noPadding
    >
      <SummaryChips vehicles={vehicles} />
      <FilterPills active={filter} onChange={setFilter} vehicles={vehicles} />

      <div className="px-5 pb-5">
        <motion.div
          layout
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
        >
          {filteredVehicles.map((v) => (
            <VehicleTile
              key={v.id}
              vehicle={v}
              onClick={() => navigate(`/fleet/${v.id}`)}
            />
          ))}
        </motion.div>

        {filteredVehicles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Car size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No vehicles match this filter</p>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
