import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

/**
 * Booking status timeline — shows all status transitions.
 * Extracted from BookingDetailPage for reusability.
 */
export default function BookingTimeline({ logs = [] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-stone-400">No status changes recorded</p>;
  }

  return (
    <div className="space-y-3">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {log.from_status && <StatusBadge status={log.from_status} />}
              {log.from_status && <span className="text-stone-300 text-xs">→</span>}
              <StatusBadge status={log.to_status} />
              <span className="text-xs text-stone-400">by {log.changed_by}</span>
            </div>
            {log.reason && <p className="text-xs text-stone-500 mt-0.5">{log.reason}</p>}
          </div>
          <p className="text-xs text-stone-400 whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  );
}
