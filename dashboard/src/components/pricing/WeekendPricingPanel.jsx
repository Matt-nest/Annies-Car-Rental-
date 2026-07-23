import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Car, Check, Plus, RefreshCw, Save, Trash2, Zap } from 'lucide-react';
import { supabase } from '../../auth/supabaseClient';
import DataError from '../shared/DataError';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DEFAULT_RULE = {
  enabled: true,
  daysOfWeek: [5, 6, 0],
  defaultWeekendIncrease: 20,
  modelRates: [
    { id: 'nissan-altima', label: 'Altima', make: 'Nissan', model: 'Altima', weekendRate: 115 },
    { id: 'volkswagen-passat', label: 'Passat', make: 'Volkswagen', model: 'Passat', weekendRate: 115 },
    { id: 'volkswagen-jetta', label: 'Jetta', make: 'Volkswagen', model: 'Jetta', weekendRate: 105 },
    { id: 'nissan-sentra', label: 'Sentra', make: 'Nissan', model: 'Sentra', weekendRate: 105 },
  ],
};

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

function normalizeDraft(data) {
  return {
    ...DEFAULT_RULE,
    ...(data || {}),
    daysOfWeek: Array.isArray(data?.daysOfWeek) ? data.daysOfWeek : DEFAULT_RULE.daysOfWeek,
    modelRates: Array.isArray(data?.modelRates) && data.modelRates.length ? data.modelRates : DEFAULT_RULE.modelRates,
  };
}

function countVehiclesForRule(rule, vehicles) {
  const make = String(rule.make || '').trim().toLowerCase();
  const model = String(rule.model || '').trim().toLowerCase();
  return vehicles.filter(vehicle => {
    const vehicleMake = String(vehicle.make || '').trim().toLowerCase();
    const vehicleModel = String(vehicle.model || '').trim().toLowerCase();
    return (!make || vehicleMake === make) && model && vehicleModel === model;
  }).length;
}

function weekendRateFor(vehicle, draft) {
  const exact = draft.modelRates.find(rule => {
    const make = String(rule.make || '').trim().toLowerCase();
    const model = String(rule.model || '').trim().toLowerCase();
    return (!make || make === String(vehicle.make || '').trim().toLowerCase())
      && model
      && model === String(vehicle.model || '').trim().toLowerCase();
  });
  return exact ? Number(exact.weekendRate || 0) : Number(vehicle.daily_rate || 0) + Number(draft.defaultWeekendIncrease || 0);
}

export default function WeekendPricingPanel() {
  const [draft, setDraft] = useState(DEFAULT_RULE);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, fleet] = await Promise.all([
        authFetch('/pricing-rules/weekend'),
        authFetch('/vehicles'),
      ]);
      setDraft(normalizeDraft(settings));
      setVehicles(fleet || []);
    } catch (e) {
      console.error('[WeekendPricingPanel] load:', e);
      setError(e?.message || 'Could not load weekend pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeDayLabels = useMemo(
    () => DAYS.filter(day => draft.daysOfWeek.includes(day.value)).map(day => day.label).join(', '),
    [draft.daysOfWeek],
  );

  const sampleVehicles = useMemo(() => vehicles.slice(0, 5), [vehicles]);
  const averageWeekendRate = useMemo(() => {
    if (!vehicles.length) return 0;
    const sum = vehicles.reduce((total, vehicle) => total + weekendRateFor(vehicle, draft), 0);
    return Math.round(sum / vehicles.length);
  }, [vehicles, draft]);

  function setField(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleDay(value) {
    setDraft(prev => {
      const active = prev.daysOfWeek.includes(value);
      const next = active ? prev.daysOfWeek.filter(day => day !== value) : [...prev.daysOfWeek, value];
      return { ...prev, daysOfWeek: next };
    });
    setSaved(false);
  }

  function updateModelRule(id, key, value) {
    setDraft(prev => ({
      ...prev,
      modelRates: prev.modelRates.map(rule => rule.id === id ? { ...rule, [key]: value } : rule),
    }));
    setSaved(false);
  }

  function addRule() {
    const id = `custom-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      modelRates: [...prev.modelRates, { id, label: 'Custom model', make: '', model: '', weekendRate: 0 }],
    }));
    setSaved(false);
  }

  function removeRule(id) {
    setDraft(prev => ({ ...prev, modelRates: prev.modelRates.filter(rule => rule.id !== id) }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const savedSettings = await authFetch('/pricing-rules/weekend', {
        method: 'PUT',
        body: JSON.stringify({
          ...draft,
          defaultWeekendIncrease: Number(draft.defaultWeekendIncrease || 0),
          modelRates: draft.modelRates.map(rule => ({
            ...rule,
            weekendRate: Number(rule.weekendRate || 0),
          })),
        }),
      });
      setDraft(normalizeDraft(savedSettings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('[WeekendPricingPanel] save:', e);
      setError(e?.message || 'Could not save weekend pricing');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="h-5 w-40 rounded bg-[var(--bg-card-hover)] animate-pulse mb-4" />
        <div className="grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-[var(--bg-card-hover)] animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card-hover)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            <Zap size={12} className="text-[var(--accent-color)]" /> Dynamic pricing
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Friday / weekend pricing</h2>
          <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
            Saved changes publish to the customer site catalog and new booking quotes.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="btn-ghost text-xs py-1.5 px-3">
            <RefreshCw size={13} /> Refresh
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !draft.daysOfWeek.length} className="btn-primary text-xs py-1.5 px-3">
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? 'Live' : saving ? 'Publishing...' : 'Save & publish'}
          </button>
        </div>
      </div>

      <DataError message={error} onRetry={load} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Status</p>
          <button
            type="button"
            onClick={() => setField('enabled', !draft.enabled)}
            className="mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left"
            style={{
              borderColor: draft.enabled ? 'var(--accent-color)' : 'var(--border-subtle)',
              backgroundColor: draft.enabled ? 'var(--accent-glow)' : 'var(--bg-card)',
            }}
          >
            <span className="text-sm font-semibold text-[var(--text-primary)]">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
            <span className="text-xs text-[var(--text-tertiary)]">{draft.enabled ? 'Publishing active rates' : 'Using base daily rates'}</span>
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">Active days</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {DAYS.map(day => {
              const active = draft.daysOfWeek.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className="h-9 rounded-lg border text-[11px] font-bold transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent-color)' : 'var(--border-subtle)',
                    backgroundColor: active ? 'var(--accent-color)' : 'var(--bg-card)',
                    color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                  }}
                >
                  {day.label.slice(0, 1)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{activeDayLabels || 'No active days selected'}</p>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="text-xs text-[var(--text-tertiary)]">All other vehicles</p>
          <label className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">+$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.defaultWeekendIncrease}
              onChange={e => setField('defaultWeekendIncrease', e.target.value)}
              className="w-full bg-transparent text-lg font-bold tabular-nums text-[var(--text-primary)] outline-none"
            />
          </label>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">Default bump when a model-specific rate is not set.</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Model-specific weekend rates</h3>
            <p className="text-xs text-[var(--text-tertiary)]">Exact weekend daily price wins over the default bump.</p>
          </div>
          <button type="button" onClick={addRule} className="btn-secondary text-xs py-1.5 px-3">
            <Plus size={13} /> Add model
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          <div className="grid grid-cols-[1fr_1fr_92px_42px] gap-2 bg-[var(--bg-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] sm:grid-cols-[1.1fr_1.1fr_1fr_110px_42px]">
            <span>Make</span>
            <span>Model</span>
            <span className="hidden sm:block">Matched</span>
            <span>Rate</span>
            <span />
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {draft.modelRates.map(rule => (
              <div key={rule.id} className="grid grid-cols-[1fr_1fr_92px_42px] gap-2 bg-[var(--bg-card)] px-3 py-2 sm:grid-cols-[1.1fr_1.1fr_1fr_110px_42px]">
                <input className="input min-w-0 text-sm" value={rule.make} onChange={e => updateModelRule(rule.id, 'make', e.target.value)} placeholder="Nissan" />
                <input className="input min-w-0 text-sm" value={rule.model} onChange={e => updateModelRule(rule.id, 'model', e.target.value)} placeholder="Altima" />
                <div className="hidden items-center gap-1.5 text-xs text-[var(--text-tertiary)] sm:flex">
                  <Car size={12} /> {countVehiclesForRule(rule, vehicles)}
                </div>
                <label className="flex min-w-0 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2">
                  <span className="text-xs text-[var(--text-tertiary)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rule.weekendRate}
                    onChange={e => updateModelRule(rule.id, 'weekendRate', e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-2 pl-1 text-sm font-bold tabular-nums text-[var(--text-primary)] outline-none"
                  />
                </label>
                <button type="button" onClick={() => removeRule(rule.id)} className="btn-ghost p-2 min-h-0" aria-label={`Remove ${rule.model || 'model'} weekend rate`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sampleVehicles.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              <CalendarDays size={12} /> Live preview
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Fleet avg. weekend rate ${averageWeekendRate}</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {sampleVehicles.map(vehicle => (
              <div key={vehicle.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  ${Number(vehicle.daily_rate || 0).toFixed(0)}/day → <span className="font-bold text-[var(--accent-color)]">${weekendRateFor(vehicle, draft).toFixed(0)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
