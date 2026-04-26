import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Percent, CalendarRange, X } from 'lucide-react';
import { supabase } from '../auth/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

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

function isActive(rule) {
  if (!rule.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  return rule.start_date <= today && rule.end_date >= today;
}

/* ── Rule Form Modal ── */
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
    if (isNaN(m) || m <= 0) return setError('Multiplier must be a positive number');
    setError('');
    onSave({ ...form, multiplier: m });
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-color)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {initial ? 'Edit Rule' : 'New Pricing Rule'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Rule Name</label>
            <input className={inputCls} placeholder="e.g. Spring Break, Hurricane Season" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Start Date</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">End Date</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
              Rate Multiplier <span className="opacity-60">(1.0 = no change · 1.25 = +25% · 0.90 = -10%)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" step="0.01" min="0.01" max="10"
                className={inputCls}
                value={form.multiplier}
                onChange={e => set('multiplier', e.target.value)}
              />
              <span className={`text-lg font-bold font-mono shrink-0 w-14 text-right ${multiplierColor(form.multiplier)}`}>
                {isNaN(parseFloat(form.multiplier)) ? '—' : multiplierLabel(form.multiplier)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => set('active', !form.active)} className="cursor-pointer">
              {form.active
                ? <ToggleRight size={22} style={{ color: 'var(--accent-color)' }} />
                : <ToggleLeft size={22} className="text-[var(--text-tertiary)]" />}
            </button>
            <span className="text-sm text-[var(--text-secondary)]">{form.active ? 'Active' : 'Inactive'}</span>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ── Main Page ── */
export default function PricingRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', rule }
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await authFetch('/pricing-rules');
      setRules(data);
    } catch (e) {
      console.error('[PricingRules]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal?.mode === 'edit') {
        const updated = await authFetch(`/pricing-rules/${modal.rule.id}`, {
          method: 'PATCH', body: JSON.stringify(form),
        });
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      } else {
        const created = await authFetch('/pricing-rules', {
          method: 'POST', body: JSON.stringify(form),
        });
        setRules(prev => [...prev, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      }
      setModal(null);
    } catch (e) {
      console.error('[PricingRules] save:', e);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      const updated = await authFetch(`/pricing-rules/${rule.id}`, {
        method: 'PATCH', body: JSON.stringify({ active: !rule.active }),
      });
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (e) {
      console.error('[PricingRules] toggle:', e);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await authFetch(`/pricing-rules/${id}`, { method: 'DELETE' });
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('[PricingRules] delete:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeNow = rules.filter(r => r.active && r.start_date <= today && r.end_date >= today);
  const upcoming  = rules.filter(r => r.active && r.start_date > today);
  const past      = rules.filter(r => r.end_date < today || !r.active);

  const RuleCard = ({ rule }) => {
    const live = isActive(rule);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-center gap-4 p-4 rounded-xl border transition-colors"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: live ? 'var(--accent-color)' : 'var(--border-subtle)' }}
      >
        {/* Multiplier badge */}
        <div className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 border"
          style={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-subtle)' }}>
          <Percent size={14} className={multiplierColor(rule.multiplier)} />
          <span className={`text-lg font-bold font-mono leading-tight ${multiplierColor(rule.multiplier)}`}>
            {multiplierLabel(rule.multiplier)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{rule.name}</p>
            {live && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 shrink-0">LIVE</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <CalendarRange size={11} />
            {formatDate(rule.start_date)} — {formatDate(rule.end_date)}
          </div>
          {rule.vehicle_ids?.length > 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{rule.vehicle_ids.length} vehicle{rule.vehicle_ids.length !== 1 ? 's' : ''} targeted</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => toggleActive(rule)} title={rule.active ? 'Disable' : 'Enable'} className="cursor-pointer">
            {rule.active
              ? <ToggleRight size={20} style={{ color: 'var(--accent-color)' }} />
              : <ToggleLeft size={20} className="text-[var(--text-tertiary)]" />}
          </button>
          <button
            onClick={() => setModal({ mode: 'edit', rule })}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(rule.id)}
            disabled={deletingId === rule.id}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors disabled:opacity-40"
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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Seasonal Pricing</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Rate multipliers applied automatically at booking creation</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
        >
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* Active banner */}
      {activeNow.length > 0 && (
        <div className="rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-500/10 text-sm text-amber-500">
          <strong>{activeNow.length} rule{activeNow.length !== 1 ? 's' : ''} active right now</strong>
          {' — '}new bookings are being priced with{' '}
          {activeNow.map(r => `${r.name} (${multiplierLabel(r.multiplier)})`).join(', ')}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--text-tertiary)] py-8 text-center">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
          <Percent size={32} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No pricing rules yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Create rules for peak seasons, holidays, or promotions</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Active Now" items={activeNow} />
          <Section title="Upcoming" items={upcoming} />
          <Section title="Past / Inactive" items={past} />
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
