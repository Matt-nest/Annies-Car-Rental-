import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { useAlerts } from '../../lib/alertsContext';
import { compressImage } from '../../lib/compressImage';
import { Camera, X, Loader2, ImagePlus, CheckCircle, Key, AlertCircle, Fuel, Gauge, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';

/* ── Fuel Level Tap Selector ────────────────────────────────────────── */
const FUEL_LEVELS = [
  { value: 'full',  label: 'F',   pct: 100 },
  { value: '3/4',   label: '¾',   pct: 75  },
  { value: '1/2',   label: '½',   pct: 50  },
  { value: '1/4',   label: '¼',   pct: 25  },
  { value: 'empty', label: 'E',   pct: 0   },
];

function FuelSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {FUEL_LEVELS.map(level => {
        const isSelected = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: isSelected ? 'var(--accent-glow)' : 'var(--bg-card-hover)',
              border: isSelected ? '2px solid var(--accent-color)' : '2px solid var(--border-subtle)',
              color: isSelected ? 'var(--accent-color)' : 'var(--text-tertiary)',
              minHeight: '56px',
            }}
          >
            <span className="text-lg">{level.label}</span>
            <span className="text-[10px] opacity-60">{level.pct}%</span>
          </button>
        );
      })}
    </div>
  );
}

function StepperHeader({ step, steps }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {steps.map((label, index) => {
          const active = index === step;
          const complete = index < step;
          return (
            <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all"
                style={{
                  backgroundColor: complete || active ? '#22c55e' : 'var(--bg-card-hover)',
                  color: complete || active ? '#fff' : 'var(--text-tertiary)',
                  border: complete || active ? '1px solid #22c55e' : '1px solid var(--border-subtle)',
                }}
              >
                {complete ? <CheckCircle size={14} /> : index + 1}
              </div>
              <span
                className="hidden min-w-0 truncate text-xs font-semibold sm:block"
                style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className="hidden h-0.5 flex-1 rounded-full sm:block"
                  style={{ backgroundColor: complete ? '#22c55e' : 'var(--border-subtle)' }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-card-hover)]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ── Inline Photo Uploader (Admin — uses admin auth) ─────────────── */
function AdminPhotoUploader({ bookingId, photos, setPhotos }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        // Compress to stay under Vercel's 4.5MB body-size limit
        const compressed = await compressImage(file);
        const result = await api.uploadVehicleImage(compressed);
        setPhotos(prev => [...prev, result.url]);
      }
    } catch (e) {
      console.error('Photo upload failed:', e);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
        <Camera size={13} /> Vehicle Photos
        <span className="ml-auto tabular-nums">{photos.length}/10</span>
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)] group">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 10 && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--bg-card-hover)',
            border: '2px dashed var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Uploading…</>
          ) : (
            <><ImagePlus size={18} /> {photos.length === 0 ? 'Add Vehicle Photos' : 'Add More'}</>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function CheckInPrepTab({ booking, onReload }) {
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('full');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [lockboxCode, setLockboxCode] = useState(null);
  const [customerRecord, setCustomerRecord] = useState(null);
  const { refresh: refreshAlerts } = useAlerts();
  const steps = ['Vehicle', 'Photos', 'Confirm'];

  const v = booking.vehicles;
  const vehicleName = v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle';
  const isReady = ['ready_for_pickup', 'active', 'returned', 'completed'].includes(booking.status);
  const displayStatus = success && !isReady ? 'ready_for_pickup' : booking.status;
  const statusCopy = {
    ready_for_pickup: {
      title: 'Vehicle Ready for Pickup',
      body: `${vehicleName} is prepared and the customer can start pickup.`,
    },
    active: {
      title: 'Pickup Complete',
      body: `${vehicleName} is already out with the customer.`,
    },
    returned: {
      title: 'Rental Returned',
      body: `${vehicleName} has been returned. Review checkout details next.`,
    },
    completed: {
      title: 'Rental Completed',
      body: `${vehicleName} has completed the handoff and checkout flow.`,
    },
  }[displayStatus] || {
    title: 'Vehicle Ready for Pickup',
    body: `${vehicleName} has been checked in and the customer has been notified.`,
  };

  // Load existing check-in data if already prepped
  useEffect(() => {
    if (isReady) {
      loadExistingData();
    }
  }, [booking.id]);

  async function loadExistingData() {
    try {
      const records = await api.getCheckinRecords(booking.id);
      const prepRecord = records.find(r => r.record_type === 'admin_prep');
      if (prepRecord) {
        setOdometer(prepRecord.odometer || '');
        setFuelLevel(prepRecord.fuel_level || 'full');
        setNotes(prepRecord.condition_notes || '');
        setPhotos(prepRecord.photo_urls || []);
        if (prepRecord.condition_notes) setShowNotes(true);
      }
      const customerCheckin = records.find(r => r.record_type === 'customer_checkin');
      if (customerCheckin) setCustomerRecord(customerCheckin);
      // Load lockbox
      const lb = await api.getBookingLockbox(booking.id).catch(() => null);
      if (lb?.lockbox_code) setLockboxCode(lb.lockbox_code);
    } catch (e) { console.error(e); }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.recordCheckIn(booking.id, {
        odometer: odometer ? Number(odometer) : undefined,
        fuelLevel,
        conditionNotes: notes || undefined,
        photoUrls: photos.length > 0 ? photos : undefined,
        markReady: true,
      });
      if (result?.markedReady === false) {
        throw new Error('Check-in was saved, but the booking was not marked ready. Refresh and confirm the booking status before handoff.');
      }
      setSuccess(true);
      // Load lockbox code after marking ready
      const lb = await api.getBookingLockbox(booking.id).catch(() => null);
      if (lb?.lockbox_code) setLockboxCode(lb.lockbox_code);
      refreshAlerts();
      onReload?.();
    } catch (err) {
      setError(err.message || 'Failed to save check-in');
    }
    setSubmitting(false);
  }

  /* ─── Already Prepped State ──────────────────────────────────────── */
  if (isReady || success) {
    return (
      <div className="max-w-lg mx-auto space-y-5 py-2 pb-[calc(var(--bottom-nav-offset)+96px)] md:pb-2">
        {/* Success banner */}
        <div className="p-5 rounded-2xl text-center" style={{
          backgroundColor: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            {statusCopy.title}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {statusCopy.body}
          </p>
        </div>

        {/* Lockbox code */}
        {lockboxCode && (
          <div className="p-5 rounded-2xl text-center" style={{
            backgroundColor: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <Key size={24} className="mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-1">Lockbox Code</p>
            <p className="text-3xl font-bold tracking-[0.25em] font-mono text-[var(--text-primary)]">
              {lockboxCode}
            </p>
          </div>
        )}

        {/* Recorded data summary */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Check-In Record</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {odometer && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Odometer</p>
                <p className="font-semibold tabular-nums text-[var(--text-primary)]">{Number(odometer).toLocaleString()} mi</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Fuel Level</p>
              <p className="font-semibold text-[var(--text-primary)]">{fuelLevel}</p>
            </div>
          </div>
          {notes && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Notes</p>
              <p className="text-sm text-[var(--text-secondary)]">{notes}</p>
            </div>
          )}
          {photos.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-2">Photos ({photos.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`} className="aspect-square rounded-lg object-cover border border-[var(--border-subtle)]" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customer check-in record — what THEY uploaded at pickup */}
        {customerRecord && (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Customer Check-In</h4>
              {customerRecord.created_at && (
                <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  {new Date(customerRecord.created_at).toLocaleString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {customerRecord.odometer && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Odometer at pickup</p>
                  <p className="font-semibold tabular-nums text-[var(--text-primary)]">{Number(customerRecord.odometer).toLocaleString()} mi</p>
                </div>
              )}
              {customerRecord.fuel_level && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Fuel at pickup</p>
                  <p className="font-semibold text-[var(--text-primary)]">{customerRecord.fuel_level}</p>
                </div>
              )}
            </div>
            {customerRecord.condition_notes && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Customer notes</p>
                <p className="text-sm text-[var(--text-secondary)]">{customerRecord.condition_notes}</p>
              </div>
            )}
            {customerRecord.photo_slots && Object.keys(customerRecord.photo_slots).length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">Slot photos</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(customerRecord.photo_slots).map(([slot, url]) => (
                    url ? (
                      <a key={slot} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                          <img src={url} alt={slot} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 capitalize text-center">{slot.replace(/_/g, ' ')}</span>
                        </div>
                      </a>
                    ) : null
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(customerRecord.photo_urls) && customerRecord.photo_urls.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">All pickup photos ({customerRecord.photo_urls.length})</p>
                <div className="grid grid-cols-4 gap-2">
                  {customerRecord.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Customer photo ${i + 1}`} className="aspect-square rounded-lg object-cover border border-[var(--border-subtle)]" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Check-In Form ─────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto space-y-4 py-2 pb-[calc(var(--bottom-nav-offset)+112px)] md:pb-2">
      <StepperHeader step={step} steps={steps} />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444',
        }}>
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Vehicle</p>
            <p className="text-base font-semibold text-[var(--text-primary)] mt-1">{vehicleName}</p>
            <p className="text-xs text-[var(--text-tertiary)] font-mono">{v?.vehicle_code || booking.booking_number}</p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Gauge size={13} /> Starting Odometer
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full px-4 py-3.5 rounded-xl text-lg font-semibold tabular-nums transition-all"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '2px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              placeholder="45,320"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Fuel size={13} /> Fuel Level
            </label>
            <FuelSelector value={fuelLevel} onChange={setFuelLevel} />
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
            style={{ backgroundColor: '#22c55e', color: '#fff', minHeight: '56px' }}
          >
            Continue to photos <ChevronRight size={18} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <AdminPhotoUploader bookingId={booking.id} photos={photos} setPhotos={setPhotos} />

          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]"
            >
              + Add condition notes
            </button>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">
                Condition Notes
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl text-sm resize-none transition-all"
                rows={4}
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '2px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                placeholder="Scratch on rear bumper, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
            >
              <ChevronLeft size={18} /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={{ backgroundColor: '#22c55e', color: '#fff' }}
            >
              Review <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-emerald-500" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Ready summary</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Odometer</p>
                <p className="font-semibold tabular-nums text-[var(--text-primary)]">{odometer ? `${Number(odometer).toLocaleString()} mi` : 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Fuel</p>
                <p className="font-semibold text-[var(--text-primary)]">{fuelLevel}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Photos</p>
                <p className="font-semibold text-[var(--text-primary)]">{photos.length} uploaded</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Status</p>
                <p className="font-semibold text-[var(--text-primary)]">Ready for pickup</p>
              </div>
            </div>
            {notes && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Notes</p>
                <p className="text-sm text-[var(--text-secondary)]">{notes}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
            >
              <ChevronLeft size={18} /> Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: '#22c55e', color: '#fff', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Saving</>
              ) : (
                <><CheckCircle size={18} /> Mark ready</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
