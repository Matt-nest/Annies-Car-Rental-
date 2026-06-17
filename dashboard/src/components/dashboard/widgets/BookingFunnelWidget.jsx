import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, XCircle, Ban } from 'lucide-react';
import { bookingApi } from '../../../api/bookingApi';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

const WINDOWS = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
];

/* Step bar colors — accent for the journey, green for the completed terminal. */
function stepColor(key) {
  return key === 'completed' ? '#22c55e' : 'var(--accent-color)';
}

export default function BookingFunnelWidget() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  const load = useCallback((d) => {
    setLoading(true);
    setError(null);
    setMounted(false);
    cachedQuery(`funnel-${d}`, () => bookingApi.getBookingFunnel(d))
      .then((res) => setData(res))
      .catch((e) => setError(e))
      .finally(() => {
        setLoading(false);
        // next tick → lets the bars animate their width in from 0
        setTimeout(() => setMounted(true), 60);
      });
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const steps = data?.steps || [];
  const created = steps[0]?.count || 0;
  const conversion = data?.conversion_rate ?? 0;
  const declined = data?.outcomes?.declined || 0;
  const cancelled = data?.outcomes?.cancelled || 0;

  const headerAction = (
    <div className="flex items-center gap-1">
      {WINDOWS.map((w) => (
        <button
          key={w.days}
          onClick={() => setDays(w.days)}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors"
          style={{
            color: days === w.days ? '#fff' : 'var(--text-tertiary)',
            backgroundColor: days === w.days ? 'var(--accent-color)' : 'transparent',
          }}
        >
          {w.label}
        </button>
      ))}
    </div>
  );

  return (
    <WidgetWrapper
      title="Booking Funnel"
      icon={Filter}
      loading={loading}
      error={error}
      onRetry={() => load(days)}
      skeletonType="chart"
      headerAction={headerAction}
      noPadding
    >
      {/* Summary stat bar */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Conversion</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#22c55e' }}>{conversion}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Bookings Started</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{created}</p>
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        {created === 0 ? (
          <div className="flex items-center justify-center" style={{ height: 160 }}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No bookings in this window</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {steps.map((s, i) => {
              // Drop-off vs the previous step, shown on the right of each row.
              const prev = i > 0 ? steps[i - 1].count : null;
              const dropped = prev != null ? prev - s.count : 0;
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
                      <span className="mx-1">·</span>{s.pct}%
                      {dropped > 0 && (
                        <span className="ml-2" style={{ color: 'var(--danger-color, #ef4444)' }}>−{dropped}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, rgba(127,127,127,0.12))' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: mounted ? `${Math.max(s.pct, 2)}%` : '0%',
                        backgroundColor: stepColor(s.key),
                        opacity: s.key === 'completed' ? 1 : 0.55 + (0.45 * (steps.length - i)) / steps.length,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Terminal drop-offs */}
        {created > 0 && (declined > 0 || cancelled > 0) && (
          <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <XCircle size={12} /> {declined} declined
            </span>
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <Ban size={12} /> {cancelled} cancelled
            </span>
            <button
              onClick={() => navigate('/bookings')}
              className="ml-auto text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent-color)' }}
            >
              View bookings →
            </button>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
