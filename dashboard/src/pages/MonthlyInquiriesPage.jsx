import { useEffect, useState } from 'react';
import { Phone, Mail, Car, Calendar, Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, parseISO } from 'date-fns';

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'closed'];
const STATUS_COLORS = {
  new:       { bg: 'rgba(212,175,55,0.12)',  text: '#D4AF37',  border: 'rgba(212,175,55,0.3)' },
  contacted: { bg: 'rgba(99,179,237,0.08)',  text: '#63b3ed',  border: 'rgba(99,179,237,0.2)' },
  booked:    { bg: 'rgba(34,197,94,0.08)',   text: '#22c55e',  border: 'rgba(34,197,94,0.2)'  },
  closed:    { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8',  border: 'rgba(148,163,184,0.2)' },
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

export default function MonthlyInquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await api.getMonthlyInquiries(params);
      setInquiries(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function updateStatus(id, newStatus) {
    setUpdatingId(id);
    try {
      await api.updateMonthlyInquiry(id, { status: newStatus });
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    } catch (e) { console.error(e); }
    setUpdatingId(null);
  }

  async function saveNotes(id) {
    const notes = noteInputs[id] ?? '';
    setUpdatingId(id);
    try {
      await api.updateMonthlyInquiry(id, { notes });
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
      setExpandedId(null);
    } catch (e) { console.error(e); }
    setUpdatingId(null);
  }

  const newCount = inquiries.filter(i => i.status === 'new').length;

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
            Monthly Inquiries
            {newCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.new.bg, color: STATUS_COLORS.new.text }}>
                {newCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Customers interested in monthly rentals
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs py-1.5 px-3">Refresh</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize"
            style={{
              backgroundColor: statusFilter === s ? 'var(--accent)' : 'var(--bg-card)',
              color: statusFilter === s ? 'var(--accent-fg)' : 'var(--text-secondary)',
              borderColor: statusFilter === s ? 'var(--accent)' : 'var(--border-subtle)',
            }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* List */}
      {inquiries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-tertiary)]">
            {statusFilter === 'all' ? 'No monthly inquiries yet.' : `No ${statusFilter} inquiries.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(inq => (
            <div
              key={inq.id}
              className="rounded-xl border p-4 space-y-3 transition-colors"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: inq.status === 'new' ? 'rgba(212,175,55,0.3)' : 'var(--border-subtle)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{inq.name}</p>
                    <StatusPill status={inq.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    <a href={`tel:${inq.phone}`} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                      <Phone size={11} /> {inq.phone}
                    </a>
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
                    {format(parseISO(inq.created_at), 'MMM d, h:mma')}
                  </span>
                </div>
              </div>

              {/* Vehicle + start date */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                {inq.vehicle_name && (
                  <span className="flex items-center gap-1.5">
                    <Car size={11} /> {inq.vehicle_name}
                  </span>
                )}
                {inq.start_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={11} /> Needs from {format(parseISO(inq.start_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>

              {/* Customer message */}
              {inq.message && (
                <p className="text-xs italic text-[var(--text-tertiary)] border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  "{inq.message}"
                </p>
              )}
              {/* Admin notes */}
              {inq.notes && inq.id !== expandedId && (
                <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-lg px-2.5 py-1.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
                  📝 {inq.notes}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                {STATUS_OPTIONS.filter(s => s !== inq.status).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(inq.id, s)}
                    disabled={updatingId === inq.id}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all capitalize hover:scale-[1.03]"
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
                  className="ml-auto text-[10px] font-medium flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <MessageSquare size={11} /> Notes
                </button>
              </div>

              {/* Inline notes editor */}
              {expandedId === inq.id && (
                <div className="space-y-2">
                  <textarea
                    value={noteInputs[inq.id] ?? ''}
                    onChange={e => setNoteInputs(p => ({ ...p, [inq.id]: e.target.value }))}
                    rows={2}
                    placeholder="Internal notes…"
                    className="input resize-none text-xs w-full"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => saveNotes(inq.id)} disabled={updatingId === inq.id} className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Save
                    </button>
                    <button onClick={() => setExpandedId(null)} className="btn-ghost text-xs py-1 px-3 flex items-center gap-1">
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
