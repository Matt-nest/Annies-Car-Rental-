import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

/**
 * Booking status timeline — shows all status transitions.
 */
export default function BookingTimeline({ logs = [] }) {
  if (logs.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No status changes recorded</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map((log, i) => (
        <div key={log.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0 mt-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
            {i < logs.length - 1 && (
              <div className="w-px flex-1 min-h-[16px] mt-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {log.from_status && <StatusBadge status={log.from_status} />}
              {log.from_status && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>→</span>}
              <StatusBadge status={log.to_status} />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>by {log.changed_by}</span>
            </div>
            {log.reason && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{log.reason}</p>}
          </div>
          <p className="text-xs whitespace-nowrap shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  );
}
