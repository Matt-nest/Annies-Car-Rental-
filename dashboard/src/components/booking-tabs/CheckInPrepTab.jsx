import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { Camera, X, Loader2, ImagePlus, CheckCircle, Key, AlertCircle, Fuel } from 'lucide-react';

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

/* ── Inline Photo Uploader (Admin — uses admin auth) ─────────────── */
function AdminPhotoUploader({ bookingId, photos, setPhotos }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        const result = await api.uploadVehicleImage(file);
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
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [lockboxCode, setLockboxCode] = useState(null);

  const isReady = ['ready_for_pickup', 'active', 'returned', 'completed'].includes(booking.status);

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
      // Load lockbox
      const lb = await api.getBookingLockbox(booking.id).catch(() => null);
      if (lb?.lockbox_code) setLockboxCode(lb.lockbox_code);
    } catch (e) { console.error(e); }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await api.recordCheckIn(booking.id, {
        odometer: odometer ? Number(odometer) : undefined,
        fuelLevel,
        conditionNotes: notes || undefined,
        photoUrls: photos.length > 0 ? photos : undefined,
        markReady: true,
      });
      setSuccess(true);
      // Load lockbox code after marking ready
      const lb = await api.getBookingLockbox(booking.id).catch(() => null);
      if (lb?.lockbox_code) setLockboxCode(lb.lockbox_code);
      onReload?.();
    } catch (err) {
      setError(err.message || 'Failed to save check-in');
    }
    setSubmitting(false);
  }

  const v = booking.vehicles;
  const vehicleName = v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle';

  /* ─── Already Prepped State ──────────────────────────────────────── */
  if (isReady || success) {
    return (
      <div className="max-w-lg mx-auto space-y-5 py-2">
        {/* Success banner */}
        <div className="p-5 rounded-2xl text-center" style={{
          backgroundColor: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Vehicle Ready for Pickup
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {vehicleName} has been checked in and the customer has been notified.
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
      </div>
    );
  }

  /* ─── Check-In Form ─────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto space-y-5 py-2">
      {/* Vehicle header */}
      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{vehicleName}</p>
        <p className="text-xs text-[var(--text-tertiary)] font-mono">{v?.vehicle_code}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444',
        }}>
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Odometer */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">
          Starting Odometer
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

      {/* Fuel Level */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
          <Fuel size={13} /> Fuel Level
        </label>
        <FuelSelector value={fuelLevel} onChange={setFuelLevel} />
      </div>

      {/* Photos */}
      <AdminPhotoUploader bookingId={booking.id} photos={photos} setPhotos={setPhotos} />

      {/* Notes (collapsed by default) */}
      {!showNotes ? (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
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
            rows={3}
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

      {/* Submit — single atomic action */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        style={{
          backgroundColor: '#22c55e',
          color: '#fff',
          boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
          minHeight: '56px',
        }}
      >
        {submitting ? (
          <><Loader2 size={20} className="animate-spin" /> Saving & Marking Ready…</>
        ) : (
          <><CheckCircle size={20} /> Ready for Pickup</>
        )}
      </button>

      <p className="text-xs text-center text-[var(--text-tertiary)]">
        This will save the check-in record and notify the customer that their vehicle is ready.
      </p>
    </div>
  );
}
