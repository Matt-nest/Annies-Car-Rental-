import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import Field from '../shared/Field';
import { Package, Key, Camera, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function CheckInPrepTab({ booking, onReload }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockbox, setLockbox] = useState(null);
  const [form, setForm] = useState({ odometer: '', fuelLevel: 'full', conditionNotes: '' });
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);

  useEffect(() => {
    loadData();
  }, [booking.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [recs, lb] = await Promise.all([
        api.getCheckinRecords(booking.id).catch(() => []),
        ['ready_for_pickup', 'active'].includes(booking.status)
          ? api.getBookingLockbox(booking.id).catch(() => null)
          : null,
      ]);
      setRecords(recs);
      setLockbox(lb);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleSavePrep() {
    setSaving(true);
    try {
      await api.recordCheckIn(booking.id, {
        odometer: form.odometer ? Number(form.odometer) : undefined,
        fuelLevel: form.fuelLevel,
        conditionNotes: form.conditionNotes || undefined,
      });
      setForm({ odometer: '', fuelLevel: 'full', conditionNotes: '' });
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setSaving(false);
  }

  async function handleMarkReady() {
    setMarkingReady(true);
    try {
      await api.markReadyForPickup(booking.id);
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setMarkingReady(false);
  }

  const canMarkReady = booking.status === 'confirmed';
  const isReady = booking.status === 'ready_for_pickup';
  const adminPrepRecords = records.filter(r => r.record_type === 'admin_prep');

  return (
    <div className="space-y-5">
      {/* Status banner */}
      {isReady && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-cyan-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">Vehicle Ready for Pickup</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Customer has been notified. Awaiting check-in.
            </p>
          </div>
        </div>
      )}

      {/* Lockbox Code (only shown when ready or active) */}
      {lockbox && (
        <Section title="Lockbox Code">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Key size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="text-3xl font-bold tracking-widest font-mono text-[var(--text-primary)]">
                {lockbox.lockbox_code}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Shared with customer via portal when status is ready/active
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Vehicle Prep Form */}
      <Section title="Vehicle Prep">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Starting Odometer</label>
              <input
                type="number"
                className="input text-sm"
                placeholder="e.g. 45320"
                value={form.odometer}
                onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Fuel Level</label>
              <select
                className="input text-sm"
                value={form.fuelLevel}
                onChange={e => setForm(f => ({ ...f, fuelLevel: e.target.value }))}
              >
                {['full', '3/4', '1/2', '1/4', 'empty'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Condition Notes</label>
            <textarea
              className="input text-sm resize-none"
              rows={3}
              placeholder="Pre-existing damage, cleanliness, accessories included…"
              value={form.conditionNotes}
              onChange={e => setForm(f => ({ ...f, conditionNotes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSavePrep} disabled={saving} className="btn-secondary">
              {saving ? 'Saving…' : 'Save Prep Record'}
            </button>
            {canMarkReady && (
              <button onClick={handleMarkReady} disabled={markingReady} className="btn-primary">
                <CheckCircle size={15} />
                {markingReady ? 'Marking…' : 'Mark Ready for Pickup'}
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* Prep History */}
      {adminPrepRecords.length > 0 && (
        <Section title="Prep History">
          <div className="space-y-3">
            {adminPrepRecords.map(rec => (
              <div key={rec.id} className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    <Clock size={11} className="inline mr-1" />
                    {new Date(rec.created_at).toLocaleString()} — {rec.created_by}
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 text-sm">
                  {rec.odometer && <Field label="Odometer" value={rec.odometer.toLocaleString()} />}
                  {rec.fuel_level && <Field label="Fuel" value={rec.fuel_level} />}
                  {rec.condition_notes && <Field label="Notes" value={rec.condition_notes} />}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Full Check-In Record History */}
      {records.filter(r => r.record_type !== 'admin_prep').length > 0 && (
        <Section title="Check-In / Check-Out Records">
          <div className="space-y-3">
            {records.filter(r => r.record_type !== 'admin_prep').map(rec => (
              <div key={rec.id} className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--accent-color)] uppercase">
                    {rec.record_type === 'customer_checkin' ? '📥 Customer Check-In' :
                     rec.record_type === 'customer_checkout' ? '📤 Customer Check-Out' :
                     rec.record_type === 'admin_inspection' ? '🔍 Admin Inspection' : rec.record_type}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {new Date(rec.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 text-sm">
                  {rec.odometer && <Field label="Odometer" value={rec.odometer.toLocaleString()} />}
                  {rec.fuel_level && <Field label="Fuel" value={rec.fuel_level} />}
                  {rec.condition_notes && <Field label="Notes" value={rec.condition_notes} />}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
