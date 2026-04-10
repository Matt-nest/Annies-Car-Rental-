import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import Field from '../shared/Field';
import { Package, Key, CheckCircle, Clock, ImagePlus, X, ChevronDown, ChevronRight, Fuel, Gauge } from 'lucide-react';

export default function CheckInPrepTab({ booking, onReload }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockbox, setLockbox] = useState(null);
  const [form, setForm] = useState({ odometer: '', fuelLevel: 'full', conditionNotes: '' });
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // triggers "Mark Ready" required state
  const [historyOpen, setHistoryOpen] = useState(false);

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
        photoUrls: [],
      });
      setForm({ odometer: '', fuelLevel: 'full', conditionNotes: '' });
      setPhotos([]);
      setShowForm(false);
      setJustSaved(true);
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setSaving(false);
  }

  async function handleMarkReady() {
    setMarkingReady(true);
    try {
      await api.markReadyForPickup(booking.id);
      setJustSaved(false);
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setMarkingReady(false);
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setPhotos(prev => [...prev, { data: reader.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  const canMarkReady = booking.status === 'confirmed';
  const isReady = booking.status === 'ready_for_pickup';
  const isActive = booking.status === 'active';
  const isCheckedIn = isReady || isActive || ['returned', 'completed'].includes(booking.status);
  const adminPrepRecords = records.filter(r => r.record_type === 'admin_prep');
  const checkinRecords = records.filter(r => r.record_type !== 'admin_prep');
  const milesAllowed = (booking.rental_days || 1) * 200;
  const hasRecords = adminPrepRecords.length > 0;

  // The check-in is complete when we have records AND status is past "confirmed"
  const checkInComplete = hasRecords && isCheckedIn;

  return (
    <div className="space-y-5">
      {/* ── Completed Banner ─────────────────────────────────────────── */}
      {checkInComplete && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Vehicle Check-In Complete</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {isReady ? 'Ready for customer pickup.' : isActive ? 'Vehicle is currently out.' : 'Rental complete.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Mileage Allowance Banner ─────────────────────────────────── */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Mileage Allowance</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
              {milesAllowed.toLocaleString()} miles
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-tertiary)]">{booking.rental_days || 1} days × 200 mi/day</p>
            <p className="text-xs text-[var(--text-tertiary)]">Overage: $0.34/mile</p>
          </div>
        </div>
      </div>

      {/* ── Lockbox Code ─────────────────────────────────────────────── */}
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

      {/* ── "Mark Ready" Required After Save ──────────────────────────── */}
      {justSaved && canMarkReady && (
        <div
          className="rounded-xl p-4 border-2 border-red-500 bg-red-500/5 animate-pulse-once"
          style={{ animation: 'pulse 1.5s ease-in-out 2' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                ⚠ Required: Mark Vehicle Ready for Pickup
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Check-in record saved. You must mark the vehicle as ready so the customer can begin their check-in process.
              </p>
            </div>
            <button
              onClick={handleMarkReady}
              disabled={markingReady}
              className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              }}
            >
              <Package size={15} className="inline mr-1.5 -mt-0.5" />
              {markingReady ? 'Marking…' : 'Mark Ready for Pickup'}
            </button>
          </div>
        </div>
      )}

      {/* ── Check-In Form — only show when NOT yet checked in ─────────── */}
      {!checkInComplete && !justSaved && (
        <>
          {!showForm && !hasRecords ? (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full py-3 text-base">
              <Package size={18} />
              Start Vehicle Check-In
            </button>
          ) : null}

          {(showForm || hasRecords) && (
            <Section title="Vehicle Check-In">
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

                {/* Photo Uploader */}
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Check-In Photos</label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                        <img src={photo.data} alt={photo.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border-medium)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent-color)] transition-colors">
                      <ImagePlus size={18} className="text-[var(--text-tertiary)]" />
                      <span className="text-[9px] text-[var(--text-tertiary)] mt-1">Add photo</span>
                      <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  </div>
                </div>

                <button onClick={handleSavePrep} disabled={saving} className="btn-primary w-full">
                  <CheckCircle size={15} />
                  {saving ? 'Saving…' : 'Save Check-In Record'}
                </button>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ── Check-In History (collapsible, compact) ─────────────────── */}
      {adminPrepRecords.length > 0 && (
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between p-4 bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--text-tertiary)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Check-In History
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--accent-color)] font-semibold">
                {adminPrepRecords.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-[var(--text-tertiary)] transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: historyOpen ? `${adminPrepRecords.length * 120 + 40}px` : '0px',
              opacity: historyOpen ? 1 : 0,
            }}
          >
            <div className="p-3 space-y-2">
              {adminPrepRecords.map(rec => (
                <div key={rec.id} className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {new Date(rec.created_at).toLocaleString()} — {rec.created_by}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {rec.odometer && (
                      <span className="flex items-center gap-1">
                        <Gauge size={11} className="text-[var(--text-tertiary)]" />
                        <span className="text-[var(--text-secondary)]">{rec.odometer.toLocaleString()} mi</span>
                      </span>
                    )}
                    {rec.fuel_level && (
                      <span className="flex items-center gap-1">
                        <Fuel size={11} className="text-[var(--text-tertiary)]" />
                        <span className="text-[var(--text-secondary)]">{rec.fuel_level}</span>
                      </span>
                    )}
                    {rec.condition_notes && (
                      <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{rec.condition_notes}</span>
                    )}
                  </div>
                  {rec.photo_urls?.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {rec.photo_urls.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover border border-[var(--border-subtle)]" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Records ────────────────────────────────────────── */}
      {checkinRecords.length > 0 && (
        <Section title="Customer Records">
          <div className="space-y-3">
            {checkinRecords.map(rec => (
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
