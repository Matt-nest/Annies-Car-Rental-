import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Shield, RefreshCw, ExternalLink, DollarSign, ClipboardCheck, Clock } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonTable } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import DataError from '../shared/DataError';

const STATUS_STYLES = {
  held: { label: 'Held', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  partial_refund: { label: 'Partial', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  refunded: { label: 'Refunded', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  applied: { label: 'Applied', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

function depositRefundable(row) {
  return Math.max(0, Number(row.amount || 0) - Number(row.refund_amount || 0) - Number(row.applied_amount || 0));
}

function settlementLabel(row) {
  const status = row.bookings?.status;
  if (row.status !== 'held') return STATUS_STYLES[row.status]?.label || row.status;
  if (status === 'returned') return 'Settle now';
  if (status === 'active') return 'Hold until return';
  return 'Pre-trip hold';
}

function settlementTone(row) {
  const status = row.bookings?.status;
  if (row.status !== 'held') return STATUS_STYLES[row.status] || STATUS_STYLES.held;
  if (status === 'returned') return { label: 'Settle now', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (status === 'active') return { label: 'Hold until return', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
  return { label: 'Pre-trip hold', color: '#64748b', bg: 'rgba(148,163,184,0.12)' };
}

export default function DepositsPanel() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total_held_dollars: '0.00' });
  const [status, setStatus] = useState('held');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listDeposits({ status });
      setRows(res.data || []);
      setSummary(res.summary || { count: 0, total_held_dollars: '0.00' });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const handleRelease = async (bookingId) => {
    if (!confirm('Refund the full deposit to the customer?')) return;
    setActing(bookingId);
    try {
      await api.releaseDeposit(bookingId);
      await load();
    } catch (err) {
      alert(err.message || 'Release failed');
    }
    setActing(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Deposits Held</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-[var(--text-primary)]">{summary.count}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Total Held</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-indigo-500">${summary.total_held_dollars}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Settle Now</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-amber-500">
            {rows.filter(row => row.status === 'held' && row.bookings?.status === 'returned').length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Active Holds</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-[var(--text-primary)]">
            {rows.filter(row => row.status === 'held' && row.bookings?.status === 'active').length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'held', label: 'Held' },
          { key: 'all', label: 'All' },
          { key: 'refunded', label: 'Refunded' },
          { key: 'applied', label: 'Applied' },
        ].map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setStatus(opt.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: status === opt.key ? 'var(--accent-glow)' : 'var(--bg-card-hover)',
              color: status === opt.key ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: status === opt.key ? '1px solid var(--accent-color)' : '1px solid var(--border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}
        <button className="btn-secondary ml-auto" onClick={load}>
          <RefreshCw size={14} /> Sync
        </button>
      </div>

      {error && <DataError message={error} onRetry={load} />}

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No deposits found"
          description={status === 'held'
            ? 'Held deposits appear here after checkout payment or when you record a manual deposit on a booking.'
            : 'Try a different filter.'}
        />
      ) : (
        <div className="rounded-xl overflow-hidden scroll-x-contained" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                {['Booking', 'Customer', 'Vehicle', 'Amount', 'Decision', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const b = row.bookings;
                const cust = b?.customers;
                const veh = b?.vehicles;
                const st = settlementTone(row);
                const refundable = depositRefundable(row);
                const settlement = settlementLabel(row);
                return (
                  <tr key={row.id} className="border-t border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${b?.id}`} className="font-mono text-xs font-semibold text-[var(--accent-color)] hover:underline">
                        {b?.booking_code}
                      </Link>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{b?.status}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {cust ? `${cust.first_name} ${cust.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {veh ? `${veh.year} ${veh.make} ${veh.model}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold tabular-nums text-[var(--text-primary)]">${(row.amount / 100).toFixed(2)}</span>
                      {refundable < row.amount && (
                        <p className="text-[11px] text-[var(--text-tertiary)]">${(refundable / 100).toFixed(2)} refundable</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                        {settlement}
                      </span>
                      {row.status === 'held' && b?.status === 'returned' && (
                        <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1"><ClipboardCheck size={11} /> Inspect, apply charges, or refund.</p>
                      )}
                      {row.status === 'held' && b?.status === 'active' && (
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1"><Clock size={11} /> Keep held until check-out.</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/bookings/${b?.id}`} className="btn-ghost text-xs py-1.5 px-2">
                          <ExternalLink size={13} /> Open
                        </Link>
                        {row.status === 'held' && refundable > 0 && (
                          <button
                            type="button"
                            className="btn-secondary text-xs py-1.5 px-2"
                            disabled={acting === b?.id}
                            onClick={() => handleRelease(b?.id)}
                          >
                            <DollarSign size={13} /> Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
