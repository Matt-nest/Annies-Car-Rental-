import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Plus,
  Percent,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../auth/supabaseClient';
import DataError from '../components/shared/DataError';
import { SkeletonDashboard, SkeletonTable } from '../components/shared/Skeleton';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

const EMPTY_FORM = { name: '', start_date: '', end_date: '', multiplier: '1.10', active: true };

function multiplierLabel(m) {
  const pct = Math.round((parseFloat(m) - 1) * 100);
  if (Number.isNaN(pct)) return '--';
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

function multiplierColor(m) {
  const pct = (parseFloat(m) - 1) * 100;
  if (pct > 0) return 'text-amber-500';
  if (pct < 0) return 'text-emerald-500';
  return 'text-[var(--text-secondary)]';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isLive(rule) {
  if (!rule.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  return rule.start_date <= today && rule.end_date >= today;
}

function RuleModal({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (!form.start_date || !form.end_date) return setError('Both dates are required');
    if (form.start_date > form.end_date) return setError('Start must be before end date');
    const m = parseFloat(form.multiplier);
    if (Number.isNaN(m) || m <= 0) return setError('Multiplier must be a positive number');
    setError('');
    onSave({ ...form, multiplier: m });
  };

  const inputCls = 'input w-full text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {initial ? 'Edit Pricing Rule' : 'New Pricing Rule'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2 min-h-0" aria-label="Close pricing rule modal">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Rule name</label>
            <input className={inputCls} placeholder="Spring break, holiday week, slow season" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Start date</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">End date</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
              Multiplier <span className="opacity-60">(1.25 = +25%, 0.90 = -10%)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10"
                className={inputCls}
                value={form.multiplier}
                onChange={e => set('multiplier', e.target.value)}
              />
              <span className={`text-lg font-bold font-mono shrink-0 w-14 text-right ${multiplierColor(form.multiplier)}`}>
                {multiplierLabel(form.multiplier)}
              </span>
            </div>
          </div>

          <button type="button" onClick={() => set('active', !form.active)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            {form.active
              ? <ToggleRight size={22} style={{ color: 'var(--accent-color)' }} />
              : <ToggleLeft size={22} className="text-[var(--text-tertiary)]" />}
            {form.active ? 'Active' : 'Inactive'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function PricingRulesPanel({ embedded = false }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch('/pricing-rules');
      setRules(data || []);
    } catch (e) {
      console.error('[PricingRules]', e);
      setError(e?.message || 'Could not load pricing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    setError(null);
    try {
      if (modal?.mode === 'edit') {
        const updated = await authFetch(`/pricing-rules/${modal.rule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      } else {
        const created = await authFetch('/pricing-rules', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setRules(prev => [...prev, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      }
      setModal(null);
    } catch (e) {
      console.error('[PricingRules] save:', e);
      setError(e?.message || 'Could not save pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    setError(null);
    try {
      const updated = await authFetch(`/pricing-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !rule.active }),
      });
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (e) {
      console.error('[PricingRules] toggle:', e);
      setError(e?.message || 'Could not update pricing rule');
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      await authFetch(`/pricing-rules/${id}`, { method: 'DELETE' });
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('[PricingRules] delete:', e);
      setError(e?.message || 'Could not delete pricing rule');
    } finally {
      setDeletingId(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const live = rules.filter(r => r.active && r.start_date <= today && r.end_date >= today);
  const upcoming = rules.filter(r => r.active && r.start_date > today);
  const inactive = rules.filter(r => r.end_date < today || !r.active);

  const matchesQuery = useCallback((rule) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [rule.name, rule.start_date, rule.end_date, multiplierLabel(rule.multiplier)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  }, [query]);

  const filteredGroups = useMemo(() => ({
    live: live.filter(matchesQuery),
    upcoming: upcoming.filter(matchesQuery),
    inactive: inactive.filter(matchesQuery),
  }), [live, upcoming, inactive, matchesQuery]);

  const averageAdjustment = rules.length
    ? Math.round(rules.reduce((sum, rule) => sum + ((parseFloat(rule.multiplier) - 1) * 100 || 0), 0) / rules.length)
    : 0;

  if (loading && rules.length === 0) {
    return embedded ? <SkeletonTable rows={5} cols={4} /> : <SkeletonDashboard />;
  }

  const containerClass = embedded ? 'space-y-5' : 'page-shell lg:p-8 space-y-6';

  const RuleCard = ({ rule }) => {
    const liveNow = isLive(rule);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border transition-colors"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: liveNow ? 'var(--accent-color)' : 'var(--border-subtle)' }}
      >
        <div className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 border"
          style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}>
          <Percent size={14} className={multiplierColor(rule.multiplier)} />
          <span className={`text-lg font-bold font-mono leading-tight ${multiplierColor(rule.multiplier)}`}>
            {multiplierLabel(rule.multiplier)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{rule.name}</p>
            {liveNow && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 shrink-0">LIVE</span>
            )}
            {!rule.active && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 shrink-0">OFF</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <CalendarRange size={11} />
            {formatDate(rule.start_date)} - {formatDate(rule.end_date)}
          </div>
          {rule.vehicle_ids?.length > 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{rule.vehicle_ids.length} targeted vehicle{rule.vehicle_ids.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          <button onClick={() => toggleActive(rule)} title={rule.active ? 'Disable rule' : 'Enable rule'} className="btn-ghost p-2 min-h-0">
            {rule.active
              ? <ToggleRight size={20} style={{ color: 'var(--accent-color)' }} />
              : <ToggleLeft size={20} className="text-[var(--text-tertiary)]" />}
          </button>
          <button
            onClick={() => setModal({ mode: 'edit', rule })}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(rule.id)}
            disabled={deletingId === rule.id}
            className="btn-ghost p-2 min-h-0 disabled:opacity-40"
            aria-label={`Delete ${rule.name}`}
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </motion.div>
    );
  };

  const Section = ({ title, items }) => {
    if (!items.length) return null;
    return (
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">{title}</h2>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {items.map(r => <RuleCard key={r.id} rule={r} />)}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const hasVisibleRules = filteredGroups.live.length || filteredGroups.upcoming.length || filteredGroups.inactive.length;

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Pricing Rules</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Seasonal multipliers applied when new bookings are created.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost text-xs py-1.5 px-3">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} /> New Rule
          </button>
        </div>
      </div>

      <DataError message={error} onRetry={load} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['Live now', live.length],
          ['Upcoming', upcoming.length],
          ['Inactive', inactive.length],
          ['Avg. adjustment', `${averageAdjustment > 0 ? '+' : ''}${averageAdjustment}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--border-subtle)] p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {live.length > 0 && (
        <div className="rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-500/10 text-sm text-amber-500">
          <strong>{live.length} active now</strong>
          {' - '}
          {live.map(r => `${r.name} (${multiplierLabel(r.multiplier)})`).join(', ')}
        </div>
      )}

      <label className="relative block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search rules..."
          className="input w-full pl-9"
        />
      </label>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-14 text-center">
          <Percent size={32} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No pricing rules yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Create peak season, holiday, or promotion multipliers.</p>
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary mt-4 mx-auto">
            <Plus size={14} /> New Rule
          </button>
        </div>
      ) : !hasVisibleRules ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-14 text-center">
          <Search size={30} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No rules match this search</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Live Now" items={filteredGroups.live} />
          <Section title="Upcoming" items={filteredGroups.upcoming} />
          <Section title="Past / Inactive" items={filteredGroups.inactive} />
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <RuleModal
            initial={modal.mode === 'edit' ? { ...modal.rule, multiplier: String(modal.rule.multiplier) } : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PricingRulesPage() {
  return <PricingRulesPanel />;
}
