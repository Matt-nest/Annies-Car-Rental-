import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Shield, AlertTriangle, CheckCircle2, RefreshCw, DollarSign,
  Loader2, ExternalLink, Activity, Clock, XCircle,
} from 'lucide-react';
import { bonzahApi } from '../api/bonzah';
import DataError from '../components/shared/DataError';

const STATUS_FILTERS = [
  { key: null,           label: 'All' },
  { key: 'active',       label: 'Active' },
  { key: 'pending',      label: 'Pending' },
  { key: 'bind_failed',  label: 'Bind failed' },
  { key: 'cancelled',    label: 'Cancelled' },
  { key: 'expired',      label: 'Expired' },
];

const STATUS_BADGE = {
  active:      { bg: 'rgba(34,197,94,0.12)',  fg: '#22c55e' },
  pending:     { bg: 'rgba(234,179,8,0.12)',  fg: '#eab308' },
  bind_failed: { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444' },
  cancelled:   { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  expired:     { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  declined:    { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
};

function dollars(cents) {
  if (cents == null || isNaN(Number(cents))) return '—';
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' };
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {status || '—'}
    </span>
  );
}

function StatTile({ icon: Icon, label, value, accent = '#465FFF', sublabel }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">{label}</p>
        <p className="text-2xl font-semibold mt-0.5 font-mono text-[var(--text-primary)]">{value}</p>
        {sublabel && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function InsurancePage() {
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState('');
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policiesErr, setPoliciesErr] = useState('');
  const [filter, setFilter] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  async function loadStats() {
    try {
      const data = await bonzahApi.stats();
      setStats(data);
      setStatsErr('');
    } catch (e) {
      setStatsErr(e.message || 'Failed to load stats');
    }
  }

  async function loadPolicies() {
    setPoliciesLoading(true);
    try {
      const { policies } = await bonzahApi.listPolicies({ status: filter });
      setPolicies(policies || []);
      setPoliciesErr('');
    } catch (e) {
      setPoliciesErr(e.message || 'Failed to load policies');
    } finally {
      setPoliciesLoading(false);
    }
  }

  async function loadEvents() {
    setEventsLoading(true);
    try {
      const { events } = await bonzahApi.getEvents({ limit: 20 });
      setEvents(events || []);
    } catch (e) {
      console.warn('[Insurance] events load failed:', e.message);
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => { loadStats(); loadEvents(); }, []);
  useEffect(() => { loadPolicies(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const counts = stats?.counts || {};
  const activeCount      = counts.active      || 0;
  const pendingCount     = counts.pending     || 0;
  const bindFailedCount  = counts.bind_failed || 0;
  const monthMarkup = stats?.markup_this_month_cents || 0;
  const allTimeMarkup = stats?.markup_all_time_cents || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Shield size={22} className="text-[#465FFF]" />
            Insurance
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Bonzah policies, reconciliation queue, and markup revenue.
          </p>
        </div>
        <button
          onClick={() => { loadStats(); loadPolicies(); loadEvents(); }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats tiles */}
      {statsErr ? (
        <DataError message={statsErr} onRetry={loadStats} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={CheckCircle2} label="Active" value={activeCount} accent="#22c55e" />
          <StatTile icon={Clock} label="Pending bind" value={pendingCount} accent="#eab308" />
          <StatTile
            icon={AlertTriangle}
            label="Bind failed"
            value={bindFailedCount}
            accent="#ef4444"
            sublabel={bindFailedCount > 0 ? 'Reconciliation needed' : 'All clear'}
          />
          <StatTile
            icon={DollarSign}
            label="Markup · this month"
            value={dollars(monthMarkup)}
            accent="#465FFF"
            sublabel={`${dollars(allTimeMarkup)} lifetime`}
          />
        </div>
      )}

      {/* Bind-failed reconciliation banner */}
      {bindFailedCount > 0 && filter !== 'bind_failed' && (
        <button
          type="button"
          onClick={() => setFilter('bind_failed')}
          className="w-full text-left rounded-xl p-4 flex items-center gap-3 transition-colors"
          style={{
            backgroundColor: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444',
          }}
        >
          <AlertTriangle size={18} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{bindFailedCount} policy bind failure{bindFailedCount === 1 ? '' : 's'} need attention</p>
            <p className="text-xs opacity-80 mt-0.5">Customer was charged but Bonzah did not issue a policy. Click to filter.</p>
          </div>
          <ExternalLink size={14} className="shrink-0" />
        </button>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const active = filter === f.key;
          const count = f.key ? (counts[f.key] || 0) : (stats?.total || 0);
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'border-[#465FFF] bg-[rgba(70,95,255,0.1)] text-[#465FFF]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Policies table */}
      <div className="card overflow-hidden">
        {policiesLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin" /> Loading policies…
          </div>
        ) : policiesErr ? (
          <DataError message={policiesErr} onRetry={loadPolicies} />
        ) : policies.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">
            No {filter ? STATUS_FILTERS.find(f => f.key === filter)?.label?.toLowerCase() : ''} policies yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Booking</th>
                  <th className="text-left font-semibold px-4 py-3">Customer</th>
                  <th className="text-left font-semibold px-4 py-3">Vehicle</th>
                  <th className="text-left font-semibold px-4 py-3">Dates</th>
                  <th className="text-left font-semibold px-4 py-3">Tier</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Premium</th>
                  <th className="text-right font-semibold px-4 py-3">Markup</th>
                  <th className="text-right font-semibold px-4 py-3">Charged</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                {policies.map(p => {
                  const v = p.vehicles || {};
                  const c = p.customers || {};
                  const customerName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || '—';
                  const vehicleName = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || '—';
                  const tier = p.bonzah_tier_id
                    ? p.bonzah_tier_id.charAt(0).toUpperCase() + p.bonzah_tier_id.slice(1)
                    : '—';
                  return (
                    <tr key={p.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/bookings/${p.id}`} className="font-mono text-xs text-[#465FFF] hover:underline">
                          {p.booking_code}
                        </Link>
                        {p.bonzah_policy_no && (
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                            Policy {p.bonzah_policy_no}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">{customerName}</td>
                      <td className="px-4 py-3">{vehicleName}</td>
                      <td className="px-4 py-3 text-xs">
                        {p.pickup_date && format(new Date(p.pickup_date + 'T12:00:00'), 'MMM d')}
                        {' → '}
                        {p.return_date && format(new Date(p.return_date + 'T12:00:00'), 'MMM d')}
                      </td>
                      <td className="px-4 py-3">{tier}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.insurance_status} /></td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{dollars(p.bonzah_premium_cents)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#22c55e]">{dollars(p.bonzah_markup_cents)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-primary)]">{dollars(p.bonzah_total_charged_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h2>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">Last 20 Bonzah API calls. Errors highlighted.</p>
        </div>
        {eventsLoading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">
            No Bonzah activity yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map(ev => (
              <li
                key={ev.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                  ev.error_text ? 'bg-[rgba(239,68,68,0.06)]' : 'bg-[var(--bg-elevated)]'
                }`}
              >
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: ev.error_text ? 'rgba(239,68,68,0.15)' : 'rgba(70,95,255,0.12)',
                    color: ev.error_text ? '#ef4444' : '#465FFF',
                  }}
                >
                  {ev.event_type}
                </span>
                <span className={ev.error_text ? 'text-[#ef4444]' : 'text-[var(--text-secondary)]'}>
                  {ev.error_text ? (
                    <>
                      {ev.error_text.length > 100 ? ev.error_text.slice(0, 100) + '…' : ev.error_text}
                    </>
                  ) : (
                    <>HTTP {ev.status_code} · {ev.duration_ms}ms</>
                  )}
                </span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono shrink-0">
                  {ev.created_at && format(new Date(ev.created_at), 'MMM d, h:mm:ss a')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
