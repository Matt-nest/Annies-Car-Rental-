import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import StatusBadge from '../../shared/StatusBadge';
import WidgetWrapper from '../WidgetWrapper';

export default function ActivityFeedWidget() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('activity-10', () => api.getActivity(10))
      .then((data) => setActivity(Array.isArray(data) ? data : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const headerAction = (
    <button
      onClick={() => navigate('/bookings')}
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--accent-color)' }}
    >
      All bookings →
    </button>
  );

  return (
    <WidgetWrapper
      title="Recent Activity"
      icon={Activity}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="list"
      headerAction={headerAction}
      noPadding
    >
      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Activity size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>No recent activity</p>
        </div>
      ) : (
        activity.map((log, i) => (
          <div
            key={log.id}
            onClick={() => log.booking_id && navigate(`/bookings/${log.booking_id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && log.booking_id && navigate(`/bookings/${log.booking_id}`)}
            className="px-5 py-3.5 flex items-start gap-3 cursor-pointer transition-colors group"
            style={{ borderBottom: i < activity.length - 1 ? '1px solid var(--border-subtle)' : 'none', minHeight: 54 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center shrink-0 mt-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
              {i < activity.length - 1 && (
                <div className="w-px flex-1 min-h-[20px] mt-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                <span className="font-medium">
                  {log.bookings?.customers?.first_name} {log.bookings?.customers?.last_name}
                </span>
                {log.bookings?.booking_code && (
                  <span className="mono-code text-xs ml-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    {log.bookings.booking_code}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {log.from_status && <StatusBadge status={log.from_status} />}
                {log.from_status && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>→</span>
                )}
                <StatusBadge status={log.to_status} />
              </div>
            </div>

            <p className="text-xs shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
            </p>
          </div>
        ))
      )}
    </WidgetWrapper>
  );
}
