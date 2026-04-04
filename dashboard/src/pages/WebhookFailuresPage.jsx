import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, formatDistanceToNow } from 'date-fns';

export default function WebhookFailuresPage() {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getWebhookFailures(100);
      setFailures(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums">Webhook Failures</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">GHL notifications that failed to deliver</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {failures.length === 0 ? (
        <div className="card p-10 text-center">
          <AlertTriangle size={28} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)] text-sm">No webhook failures recorded</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-[var(--danger-glow)] border-b border-[rgba(244,63,94,0.2)] flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--danger-color)]" />
            <p className="text-sm font-medium text-[var(--danger-color)]">{failures.length} failed webhook{failures.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-[var(--danger-color)] ml-1">— GHL may not have received these notifications</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Time', 'Event', 'Booking', 'Status', 'Error'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-[var(--text-tertiary)] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {failures.map(f => (
                  <tr key={f.id} className="hover:bg-[var(--bg-card)]">
                    <td className="px-4 py-3 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{f.event_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{f.booking_code || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-[var(--danger-glow)] text-[var(--danger-color)] px-2 py-0.5 rounded-full font-medium">
                        {f.status_code || 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-xs truncate" title={f.error_message}>
                      {f.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
