import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

/**
 * Booking status timeline — shows all status transitions.
 */
export default function BookingTimeline({ logs = [] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        No status changes recorded
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log, i) => (
        <div key={log.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0 mt-1">
            <div
              className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1"
              style={{
                backgroundColor: 'var(--accent-color)',
                ringColor: 'var(--accent-glow)',
                ringOffsetColor: 'var(--bg-card)',
              }}
            />
            {i < logs.length - 1 && (
              <div
                className="w-px mt-1"
                style={{
                  height: '28px',
                  backgroundColor: 'var(--border-subtle)',
                }}
              />
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {log.from_status && <StatusBadge status={log.from_status} />}
              {log.from_status && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>→</span>
              )}
              <StatusBadge status={log.to_status} />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                by {log.changed_by}
              </span>
            </div>
            {log.reason && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {log.reason}
              </p>
            )}
          </div>
          <p
            className="text-xs whitespace-nowrap shrink-0 pt-0.5 mono-code"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  );
}
