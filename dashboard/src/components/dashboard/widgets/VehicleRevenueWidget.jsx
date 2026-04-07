import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

function RevenueBar({ vehicle, maxRevenue, rank }) {
  const pct = maxRevenue > 0 ? (vehicle.revenue / maxRevenue) * 100 : 0;
  const isTop = rank <= 3;
  const isBottom = rank > 0 && vehicle.revenue === 0;

  const barColor = isBottom
    ? 'var(--border-medium)'
    : isTop
    ? 'var(--accent-color)'
    : 'rgba(30,58,95,0.5)';

  return (
    <div className="flex items-center gap-3 py-2.5 group"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Rank */}
      <div className="w-5 text-right shrink-0">
        {isTop ? (
          <span className="text-[11px] font-bold" style={{ color: 'var(--accent-color)' }}>#{rank}</span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{rank}</span>
        )}
      </div>

      {/* Vehicle label */}
      <div className="w-28 shrink-0 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: isBottom ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {vehicle.label || vehicle.vehicle_code || vehicle.name || `Vehicle ${rank}`}
        </p>
      </div>

      {/* Bar */}
      <div className="flex-1 relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Revenue value */}
      <div className="w-16 text-right shrink-0">
        <span className="text-xs font-semibold tabular-nums display-num"
          style={{ color: isBottom ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {vehicle.revenue > 0 ? `$${(vehicle.revenue / 1000).toFixed(1)}k` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function VehicleRevenueWidget() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('revenue-full', () => api.getRevenue())
      .then((data) => {
        const byVehicle = data?.by_vehicle || [];
        // Normalize and sort descending
        const normalized = byVehicle.map((v) => ({
          ...v,
          revenue: Number(v.total || v.revenue || v.amount || 0),
          label: v.label || v.vehicle_code || v.name || '',
        })).sort((a, b) => b.revenue - a.revenue);
        setVehicles(normalized);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = vehicles[0]?.revenue || 1;

  const headerAction = (
    <button
      onClick={() => navigate('/revenue')}
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--accent-color)' }}
    >
      Full report →
    </button>
  );

  return (
    <WidgetWrapper
      title="Vehicle Revenue Leaderboard"
      icon={DollarSign}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="list"
      headerAction={headerAction}
      noPadding
    >
      {vehicles.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No revenue data yet</p>
        </div>
      ) : (
        <div className="px-5 pt-3 pb-2">
          {/* Column headers */}
          <div className="flex items-center gap-3 pb-1.5 mb-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="w-5" />
            <div className="w-28 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Vehicle</div>
            <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Revenue</div>
            <div className="w-16 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Total</div>
          </div>

          {vehicles.map((v, i) => (
            <RevenueBar key={v.id || v.vehicle_code || i} vehicle={v} maxRevenue={maxRevenue} rank={i + 1} />
          ))}

          {vehicles[vehicles.length - 1]?.revenue === 0 && (
            <p className="text-[11px] mt-2 px-1" style={{ color: 'var(--text-tertiary)' }}>
              Vehicles showing — may need pricing review or Turo listing.
            </p>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
