import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCheck, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, formatDistanceToNow } from 'date-fns';

export default function WebhookFailuresPage() {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getWebhookFailures(100);
      setFailures(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resolveFailure(id) {
    setResolving(id);
    try {
      await api.resolveWebhookFailure(id);
      setFailures(prev => prev.filter(f => f.id !== id));
    } catch (e) { console.error(e); }
    setResolving(null);
  }

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="page-shell lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums">Automation Failures</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Failed outbound notifications or automation events that need operator review</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {failures.length === 0 ? (
        <div className="card p-10 text-center">
          <AlertTriangle size={28} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)] text-sm">No automation failures recorded</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-[var(--danger-glow)] border-b border-[rgba(244,63,94,0.2)] flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--danger-color)]" />
            <p className="text-sm font-medium text-[var(--danger-color)]">{failures.length} unresolved failed event{failures.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-[var(--danger-color)] ml-1">— review delivery, retry from the source workflow if needed, then dismiss</p>
          </div>
          {/* Mobile cards — a 5-column table sideways-scrolls on a phone, so
              stack each failure into a readable card below md. */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {failures.map(f => (
              <div key={f.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{f.event_type}</span>
                  <span className="text-xs bg-[var(--danger-glow)] text-[var(--danger-color)] px-2 py-0.5 rounded-full font-medium shrink-0">
                    {f.status_code || 'Failed'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                  {f.booking_code && <span className="font-mono">· {f.booking_code}</span>}
                </div>
                {f.error_message && (
                  <p className="text-xs break-words" style={{ color: 'var(--text-secondary)' }}>{f.error_message}</p>
                )}
                <button
                  type="button"
                  onClick={() => resolveFailure(f.id)}
                  disabled={resolving === f.id}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-[var(--bg-card-hover)] text-[var(--text-secondary)] disabled:opacity-60"
                >
                  <CheckCheck size={12} />
                  {resolving === f.id ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Time', 'Event', 'Booking', 'Status', 'Error', 'Action'].map(h => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => resolveFailure(f.id)}
                        disabled={resolving === f.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-60"
                      >
                        <CheckCheck size={12} />
                        {resolving === f.id ? 'Dismissing...' : 'Dismiss'}
                      </button>
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
