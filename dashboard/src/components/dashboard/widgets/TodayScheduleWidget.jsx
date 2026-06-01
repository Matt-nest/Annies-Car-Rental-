import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowUpFromLine, ArrowDownToLine, CheckCheck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

export default function TodayScheduleWidget() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('overview', () => api.getOverview())
      .then(setOverview)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const all = [
    ...(overview?.pickups_today || []).map((b) => ({ ...b, _type: 'pickup', _time: b.pickup_time })),
    ...(overview?.returns_today || []).map((b) => ({ ...b, _type: 'return', _time: b.return_time })),
  ].sort((a, b) => (a._time || '').localeCompare(b._time || ''));

  const title = `Today — ${format(new Date(), 'EEEE, MMM d')}`;

  return (
    <WidgetWrapper
      title={title}
      icon={Clock}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="list"
      noPadding
    >
      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <CheckCheck size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Nothing scheduled today</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>Enjoy the quiet!</p>
        </div>
      ) : (
        all.map((b, i) => (
          <div
            key={`${b._type}-${b.id}`}
            onClick={() => navigate(`/bookings/${b.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/bookings/${b.id}`)}
            className="px-5 py-3.5 flex items-center gap-3.5 cursor-pointer group transition-colors"
            style={{
              borderBottom: i < all.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              minHeight: 54,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {/* Time chip */}
            <div
              className="shrink-0 text-center py-1 px-2.5 rounded-xl text-xs font-semibold min-w-[52px]"
              style={{
                backgroundColor: b._type === 'pickup' ? 'rgba(99,179,237,0.12)' : 'rgba(167,139,250,0.12)',
                color: b._type === 'pickup' ? '#63b3ed' : '#a78bfa',
              }}
            >
              {b._time?.slice(0, 5) || '—'}
            </div>

            {/* Customer + vehicle */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {b.customers?.first_name} {b.customers?.last_name}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
              </p>
            </div>

            {/* Badge */}
            <span
              className="badge shrink-0 gap-1"
              style={{
                backgroundColor: b._type === 'pickup' ? 'rgba(99,179,237,0.1)' : 'rgba(167,139,250,0.1)',
                color: b._type === 'pickup' ? '#63b3ed' : '#a78bfa',
              }}
            >
              {b._type === 'pickup' ? <ArrowUpFromLine size={9} /> : <ArrowDownToLine size={9} />}
              {b._type === 'pickup' ? 'Pickup' : 'Return'}
            </span>

            <ChevronRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ))
      )}
    </WidgetWrapper>
  );
}
