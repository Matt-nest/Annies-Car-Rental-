import { useEffect, useState } from 'react';
import { Star, CheckCircle2, XCircle, Trash2, Clock } from 'lucide-react';
import { api } from '../api/client';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, parseISO } from 'date-fns';

function StarDisplay({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={12}
          fill={i <= rating ? '#D4AF37' : 'none'}
          stroke={i <= rating ? '#D4AF37' : 'var(--text-tertiary)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.getReviewsPending(),
        api.getReviews(),
      ]);
      setPending(p || []);
      setApproved(a || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    setUpdatingId(id);
    try {
      await api.updateReview(id, { approved: true });
      const item = pending.find(r => r.id === id);
      setPending(prev => prev.filter(r => r.id !== id));
      if (item) setApproved(prev => [{ ...item, approved: true }, ...prev]);
    } catch (e) { console.error(e); }
    setUpdatingId(null);
  }

  async function reject(id) {
    setUpdatingId(id);
    try {
      await api.deleteReview(id);
      setPending(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
    setUpdatingId(null);
  }

  async function remove(id) {
    setUpdatingId(id);
    try {
      await api.deleteReview(id);
      setApproved(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
    setUpdatingId(null);
  }

  if (loading) return <SkeletonDashboard />;

  const list = tab === 'pending' ? pending : approved;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
            Reviews
            {pending.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}>
                {pending.length} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Customer reviews — approve before they appear on the site
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs py-1.5 px-3">Refresh</button>
      </div>

      {/* Tabs */}
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
              backgroundColor: tab === t.key ? 'var(--accent)' : 'var(--bg-card)',
              color: tab === t.key ? 'var(--accent-fg)' : 'var(--text-secondary)',
              borderColor: tab === t.key ? 'var(--accent)' : 'var(--border-subtle)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-tertiary)]">
            {tab === 'pending' ? 'No pending reviews.' : 'No approved reviews yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(r => (
            <div
              key={r.id}
              className="rounded-xl border p-4 space-y-2 transition-colors"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: tab === 'pending' ? 'rgba(212,175,55,0.3)' : 'var(--border-subtle)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{r.reviewer_name}</p>
                    <StarDisplay rating={r.rating} />
                    {r.vehicle_name && (
                      <span className="text-[10px] text-[var(--text-tertiary)]">· {r.vehicle_name}</span>
                    )}
                  </div>
                  {r.booking_code && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Booking #{r.booking_code}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] shrink-0">
                  <Clock size={10} />
                  {format(parseISO(r.created_at), 'MMM d, yyyy')}
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">"{r.comment}"</p>

              <div className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                {tab === 'pending' ? (
                  <>
                    <button
                      onClick={() => approve(r.id)}
                      disabled={updatingId === r.id}
                      className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all hover:scale-[1.03] disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(34,197,94,0.08)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}
                    >
                      <CheckCircle2 size={11} /> Approve
                    </button>
                    <button
                      onClick={() => reject(r.id)}
                      disabled={updatingId === r.id}
                      className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all hover:scale-[1.03] disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => remove(r.id)}
                    disabled={updatingId === r.id}
                    className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--danger-color)] transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={11} /> Remove
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
