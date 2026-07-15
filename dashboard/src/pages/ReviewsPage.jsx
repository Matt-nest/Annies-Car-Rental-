import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import { SkeletonDashboard, SkeletonTable } from '../components/shared/Skeleton';
import DataError from '../components/shared/DataError';

function StarDisplay({ rating, size = 12 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating || 0} star review`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= rating ? '#E79B3C' : 'none'}
          stroke={i <= rating ? '#E79B3C' : 'var(--text-tertiary)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function formatReviewDate(value) {
  if (!value) return 'Recent';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return 'Recent';
  }
}

function averageRating(items) {
  if (!items.length) return '0.0';
  const avg = items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length;
  return avg.toFixed(1);
}

export function ReviewsPanel({ embedded = false }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, a] = await Promise.all([
        api.getReviewsPending(),
        api.getReviews(),
      ]);
      setPending(p || []);
      setApproved(a || []);
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    setUpdatingId(id);
    setLoadError(null);
    try {
      await api.updateReview(id, { approved: true });
      const item = pending.find(r => r.id === id);
      setPending(prev => prev.filter(r => r.id !== id));
      if (item) setApproved(prev => [{ ...item, approved: true }, ...prev]);
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not approve review');
    } finally {
      setUpdatingId(null);
    }
  }

  async function reject(id) {
    setUpdatingId(id);
    setLoadError(null);
    try {
      await api.deleteReview(id);
      setPending(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not reject review');
    } finally {
      setUpdatingId(null);
    }
  }

  async function remove(id) {
    setUpdatingId(id);
    setLoadError(null);
    try {
      await api.deleteReview(id);
      setApproved(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not remove review');
    } finally {
      setUpdatingId(null);
    }
  }

  const list = tab === 'pending' ? pending : approved;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r => [
      r.reviewer_name,
      r.comment,
      r.vehicle_name,
      r.booking_code,
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [list, query]);

  if (loading) {
    return embedded ? <SkeletonTable rows={5} cols={4} /> : <SkeletonDashboard />;
  }

  const containerClass = embedded ? 'space-y-5' : 'page-shell lg:p-8 space-y-6';

  return (
    <div className={containerClass}>
      <DataError message={loadError} onRetry={load} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Reviews</h1>
            {pending.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(212,175,55,0.12)', color: '#E79B3C' }}>
                {pending.length} pending
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Review queue and live customer proof for the public site.
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs py-1.5 px-3 self-start">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-xl border border-[var(--border-subtle)] p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-xs text-[var(--text-tertiary)]">Pending</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{pending.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-xs text-[var(--text-tertiary)]">Live</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{approved.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-xs text-[var(--text-tertiary)]">Live rating</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{averageRating(approved)}</p>
            <StarDisplay rating={Math.round(Number(averageRating(approved)))} size={14} />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {[
            { key: 'pending', label: `Pending (${pending.length})` },
            { key: 'approved', label: `Live (${approved.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={{
                backgroundColor: tab === t.key ? 'var(--accent-color)' : 'var(--bg-card)',
                color: tab === t.key ? 'var(--accent-fg)' : 'var(--text-secondary)',
                borderColor: tab === t.key ? 'var(--accent-color)' : 'var(--border-subtle)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative w-full lg:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search reviews..."
            className="input w-full pl-9"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-14 text-center">
          <MessageSquare size={30} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {query ? 'No reviews match this search' : tab === 'pending' ? 'No pending reviews' : 'No live reviews yet'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {tab === 'pending' ? 'New customer reviews will queue here before publishing.' : 'Approved reviews appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div
              key={r.id}
              className="rounded-xl border p-4 space-y-3 transition-colors"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: tab === 'pending' ? 'rgba(212,175,55,0.3)' : 'var(--border-subtle)',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{r.reviewer_name || 'Customer'}</p>
                    <StarDisplay rating={r.rating} />
                    {r.vehicle_name && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">- {r.vehicle_name}</span>
                    )}
                  </div>
                  {r.booking_code && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Booking #{r.booking_code}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] shrink-0">
                  <Clock size={10} />
                  {formatReviewDate(r.created_at)}
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                &quot;{r.comment || 'No written comment.'}&quot;
              </p>

              <div className="flex flex-wrap gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                {tab === 'pending' ? (
                  <>
                    <button
                      onClick={() => approve(r.id)}
                      disabled={updatingId === r.id}
                      className="btn-secondary text-xs py-1.5 px-3"
                      style={{ color: '#22c55e' }}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      onClick={() => reject(r.id)}
                      disabled={updatingId === r.id}
                      className="btn-secondary text-xs py-1.5 px-3"
                      style={{ color: '#ef4444' }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => remove(r.id)}
                    disabled={updatingId === r.id}
                    className="sm:ml-auto btn-ghost text-xs py-1.5 px-3"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Trash2 size={13} /> Remove from site
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return <ReviewsPanel />;
}
