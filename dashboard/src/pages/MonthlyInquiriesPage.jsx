import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import { SkeletonDashboard, SkeletonTable } from '../components/shared/Skeleton';
import DataError from '../components/shared/DataError';
import { formatDateOnly } from '../lib/dates';

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'closed'];
const STATUS_COLORS = {
  new:       { bg: 'rgba(212,175,55,0.12)',  text: '#D4AF37',  border: 'rgba(212,175,55,0.3)' },
  contacted: { bg: 'rgba(99,179,237,0.08)',  text: '#63b3ed',  border: 'rgba(99,179,237,0.2)' },
  converted: { bg: 'rgba(34,197,94,0.08)',   text: '#22c55e',  border: 'rgba(34,197,94,0.2)'  },
  closed:    { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8',  border: 'rgba(148,163,184,0.2)' },
};

const NEXT_ACTIONS = {
  new: ['contacted', 'closed'],
  contacted: ['converted', 'closed'],
  converted: ['closed'],
  closed: ['new'],
};

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {status}
    </span>
  );
}

function formatCreatedAt(value) {
  if (!value) return 'Recent';
  try {
    return format(parseISO(value), 'MMM d, h:mma');
  } catch {
    return 'Recent';
  }
}

function statusCounts(inquiries) {
  return inquiries.reduce((acc, item) => {
    const key = STATUS_OPTIONS.includes(item.status) ? item.status : 'new';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function MonthlyInquiriesPanel({ embedded = false }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMonthlyInquiries();
      setInquiries(data || []);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Could not load monthly leads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, newStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      await api.updateMonthlyInquiry(id, { status: newStatus });
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Could not update lead status');
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveNotes(id) {
    const notes = noteInputs[id] ?? '';
    setUpdatingId(id);
    setError(null);
    try {
      await api.updateMonthlyInquiry(id, { notes });
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
      setExpandedId(null);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Could not save notes');
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = useMemo(() => statusCounts(inquiries), [inquiries]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inquiries.filter(inq => {
      if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
      if (!q) return true;
      return [
        inq.name,
        inq.phone,
        inq.email,
        inq.vehicle_name,
        inq.message,
        inq.notes,
      ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [inquiries, query, statusFilter]);

  if (loading && inquiries.length === 0) {
    return embedded ? <SkeletonTable rows={5} cols={4} /> : <SkeletonDashboard />;
  }

  const containerClass = embedded ? 'space-y-5' : 'page-shell lg:p-8 space-y-6';

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Monthly Leads</h1>
            {(counts.new || 0) > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.new.bg, color: STATUS_COLORS.new.text }}>
                {counts.new} new
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Longer-rental inquiries sorted by status, customer, and vehicle interest.
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs py-1.5 px-3 self-start">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <DataError message={error} onRetry={load} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {STATUS_OPTIONS.map(status => {
          const c = STATUS_COLORS[status];
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(active ? 'all' : status)}
              className="rounded-xl border p-3 text-left transition-all min-h-[72px]"
              style={{
                backgroundColor: active ? c.bg : 'var(--bg-card)',
                borderColor: active ? c.border : 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold capitalize" style={{ color: active ? c.text : 'var(--text-secondary)' }}>
                  {status}
                </span>
                <span className="text-lg font-bold tabular-nums" style={{ color: active ? c.text : 'var(--text-primary)' }}>
                  {counts[status] || 0}
                </span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {status === 'new' ? 'Needs first touch' : status === 'contacted' ? 'Follow-up open' : status === 'converted' ? 'Won' : 'Done'}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search leads..."
            className="input w-full pl-9"
          />
        </label>
        {statusFilter !== 'all' && (
          <button type="button" onClick={() => setStatusFilter('all')} className="btn-secondary text-xs">
            Clear filter
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-14 text-center">
          <MessageSquare size={30} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {query || statusFilter !== 'all' ? 'No leads match this view' : 'No monthly leads yet'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">New monthly rental forms will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inq => (
            <div
              key={inq.id}
              className="rounded-xl border p-4 space-y-3 transition-colors"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: inq.status === 'new' ? STATUS_COLORS.new.border : 'var(--border-subtle)' }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{inq.name || 'Unknown lead'}</p>
                    <StatusPill status={inq.status || 'new'} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {inq.phone && (
                      <a href={`tel:${inq.phone}`} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <Phone size={11} /> {inq.phone}
                      </a>
                    )}
                    {inq.email && (
                      <a href={`mailto:${inq.email}`} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <Mail size={11} /> {inq.email}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock size={11} className="text-[var(--text-tertiary)]" />
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {formatCreatedAt(inq.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                {inq.vehicle_name && (
                  <span className="flex items-center gap-1.5">
                    <Car size={11} /> {inq.vehicle_name}
                  </span>
                )}
                {inq.start_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={11} /> Starts {formatDateOnly(inq.start_date)}
                  </span>
                )}
              </div>

              {inq.message && (
                <p className="text-xs italic text-[var(--text-tertiary)] border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  &quot;{inq.message}&quot;
                </p>
              )}

              {inq.notes && inq.id !== expandedId && (
                <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-lg px-2.5 py-1.5 border flex items-start gap-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <MessageSquare size={12} className="mt-0.5 shrink-0" /> {inq.notes}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                {(NEXT_ACTIONS[inq.status] || ['contacted']).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(inq.id, s)}
                    disabled={updatingId === inq.id}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all capitalize hover:scale-[1.03] disabled:opacity-50"
                    style={{
                      backgroundColor: STATUS_COLORS[s]?.bg,
                      color: STATUS_COLORS[s]?.text,
                      borderColor: STATUS_COLORS[s]?.border,
                    }}
                  >
                    Mark {s}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setExpandedId(expandedId === inq.id ? null : inq.id);
                    setNoteInputs(p => ({ ...p, [inq.id]: inq.notes || '' }));
                  }}
                  className="sm:ml-auto text-[10px] font-medium flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <MessageSquare size={11} /> Notes
                </button>
              </div>

              {expandedId === inq.id && (
                <div className="space-y-2">
                  <textarea
                    value={noteInputs[inq.id] ?? ''}
                    onChange={e => setNoteInputs(p => ({ ...p, [inq.id]: e.target.value }))}
                    rows={2}
                    placeholder="Internal notes..."
                    className="input resize-none text-xs w-full"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => saveNotes(inq.id)} disabled={updatingId === inq.id} className="btn-primary text-xs py-1 px-3">
                      <CheckCircle2 size={11} /> Save
                    </button>
                    <button onClick={() => setExpandedId(null)} className="btn-ghost text-xs py-1 px-3">
                      <XCircle size={11} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonthlyInquiriesPage() {
  return <MonthlyInquiriesPanel />;
}
