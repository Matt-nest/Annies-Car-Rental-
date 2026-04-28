import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import {
  CheckCircle, AlertCircle, Loader2, Camera, X, ImagePlus,
  Fuel, ChevronRight, ChevronLeft, DollarSign, Plus, Trash2,
  FileText, Send, ArrowRight, Gauge,
} from 'lucide-react';

/* ── Fuel Level Tap Selector ────────────────────────────────────────── */
const FUEL_LEVELS = [
  { value: 'full',  label: 'F',  pct: 100 },
  { value: '3/4',   label: '¾',  pct: 75  },
  { value: '1/2',   label: '½',  pct: 50  },
  { value: '1/4',   label: '¼',  pct: 25  },
  { value: 'empty', label: 'E',  pct: 0   },
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

/* ── Inline Photo Uploader ───────────────────────────────────────────── */
function AdminPhotoUploader({ photos, setPhotos }) {
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
    } catch (e) { console.error(e); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
        <Camera size={13} /> Return Photos <span className="ml-auto tabular-nums">{photos.length}/10</span>
      </label>
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)] group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 10 && (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '2px dashed var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : <><ImagePlus size={18} /> {photos.length === 0 ? 'Add Return Photos' : 'Add More'}</>}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

/* ── Incidental Type Options ─────────────────────────────────────────── */
const INCIDENTAL_TYPES = [
  { value: 'cleaning', label: 'Cleaning Fee', defaultAmount: 7500 },
  { value: 'gas', label: 'Gas Discrepancy', defaultAmount: 5000 },
  { value: 'smoking', label: 'Smoking Fee', defaultAmount: 25000 },
  { value: 'damage', label: 'Damage Charge', defaultAmount: 0 },
  { value: 'late_return', label: 'Late Return Fee', defaultAmount: 0 },
  { value: 'mileage_overage', label: 'Mileage Overage', defaultAmount: 0 },
  { value: 'toll_violation', label: 'Toll Violation', defaultAmount: 0 },
  { value: 'other', label: 'Other', defaultAmount: 0 },
];

/* ── Stepper Header ──────────────────────────────────────────────────── */
function StepperHeader({ step, steps }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              style={{
                backgroundColor: i < step ? '#22c55e' : i === step ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                color: i < step ? '#fff' : i === step ? '#1c1917' : 'var(--text-tertiary)',
                border: i > step ? '2px solid var(--border-subtle)' : 'none',
              }}
            >
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-px flex-1 mx-1" style={{ backgroundColor: i < step ? '#22c55e' : 'var(--border-subtle)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Customer-recorded check-in / check-out display ─────────────────── */
function CustomerRecordCard({ title, record }) {
  if (!record) return null;
  const slots = record.photo_slots && typeof record.photo_slots === 'object' ? record.photo_slots : {};
  const slotEntries = Object.entries(slots).filter(([, url]) => !!url);
  const photos = Array.isArray(record.photo_urls) ? record.photo_urls : [];
  return (
    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</h4>
        {record.created_at && (
          <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
            {new Date(record.created_at).toLocaleString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {record.odometer && (
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Odometer</p>
            <p className="font-semibold tabular-nums text-[var(--text-primary)]">{Number(record.odometer).toLocaleString()} mi</p>
          </div>
        )}
        {record.fuel_level && (
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Fuel Level</p>
            <p className="font-semibold text-[var(--text-primary)]">{record.fuel_level}</p>
          </div>
        )}
      </div>
      {record.condition_notes && (
        <div>
          <p className="text-xs text-[var(--text-tertiary)]">Customer notes</p>
          <p className="text-sm text-[var(--text-secondary)]">{record.condition_notes}</p>
        </div>
      )}
      {slotEntries.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">Slot photos</p>
          <div className="grid grid-cols-4 gap-2">
            {slotEntries.map(([slot, url]) => (
              <a key={slot} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                  <img src={url} alt={slot} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 capitalize text-center">{slot.replace(/_/g, ' ')}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      {photos.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">All photos ({photos.length})</p>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Customer photo ${i + 1}`} className="aspect-square rounded-lg object-cover border border-[var(--border-subtle)]" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — 3-Step Check-Out Flow
   ══════════════════════════════════════════════════════════════════════ */
export default function CheckOutTab({ booking, onReload }) {
  const [step, setStep] = useState(0);
  const STEPS = ['Vehicle Condition', 'Review Charges', 'Finalize'];

  // Step 1: Condition
  const [odometer, setOdometer] = useState(booking.return_mileage || '');
  const [fuelLevel, setFuelLevel] = useState(booking.return_fuel_level || 'full');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showNotes, setShowNotes] = useState(false);

  // Step 2: Incidentals
  const [incidentals, setIncidentals] = useState([]);
  const [incidentalsLoaded, setIncidentalsLoaded] = useState(false);
  const [newIncType, setNewIncType] = useState('cleaning');
  const [newIncAmount, setNewIncAmount] = useState('');
  const [newIncDesc, setNewIncDesc] = useState('');

  // Step 3: Settlement
  const [deposit, setDeposit] = useState(null);
  const [invoice, setInvoice] = useState(null);

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const v = booking.vehicles;
  const vehicleName = v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle';

  // Check if already completed
  const isAlreadyDone = ['completed'].includes(booking.status);
  const isReturned = booking.status === 'returned';

  /* ── Mileage + fuel intelligence ──────────────────────────────────────
     Mirrors backend `calculateMileageOverageFromInputs` (200 free mi/day,
     $0.34/mile overage) so the admin sees the same number the inspection
     service will charge. */
  const FREE_MILES_PER_DAY = 200;
  const OVERAGE_RATE_DOLLARS = 0.34;
  const hasUnlimitedMiles = !!booking.unlimited_miles || booking.mileage_allowance === 'unlimited';
  const hasUnlimitedTolls = !!booking.unlimited_tolls;
  const rentalDaysCount = Math.max(1, Number(booking.rental_days) || 1);
  const freeMilesTotal = rentalDaysCount * FREE_MILES_PER_DAY;
  const checkInOdoNum = booking.checkin_odometer ? Number(booking.checkin_odometer) : null;
  const odometerNum = odometer ? Number(odometer) : null;
  const tripMiles = (checkInOdoNum != null && odometerNum != null)
    ? Math.max(0, odometerNum - checkInOdoNum)
    : null;
  const overageMilesLive = (tripMiles != null && !hasUnlimitedMiles)
    ? Math.max(0, tripMiles - freeMilesTotal)
    : 0;
  const overageDollars = overageMilesLive * OVERAGE_RATE_DOLLARS;

  // Fuel discrepancy — compare against admin-confirmed check-in fuel level.
  // Admin handoff records live in checkinRecords with record_type === 'admin_prep';
  // fall back to booking.checkin_fuel_level if surfaced there.
  const adminPrepFuel = (booking.checkinRecords || [])
    .find(r => r.record_type === 'admin_prep' || r.record_type === 'admin_handoff')?.fuel_level
    || booking.checkin_fuel_level
    || null;
  const fuelOK = adminPrepFuel ? fuelLevel === adminPrepFuel : null;

  /* ── Load incidentals and deposit when entering step 2/3 ── */
  useEffect(() => {
    if (step >= 1 && !incidentalsLoaded) loadIncidentals();
    if (step >= 2) loadDepositAndInvoice();
  }, [step]);

  /* ── Load customer-recorded check-out record + resume from saved condition ──
     If an admin_inspection record already exists for this booking, hydrate the
     Step 1 form fields from it AND advance to Step 2 (Review Charges) so the
     admin doesn't have to re-enter the condition they already saved. */
  const [customerCheckout, setCustomerCheckout] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const records = await api.getCheckinRecords(booking.id);
        setCustomerCheckout(records.find(r => r.record_type === 'customer_checkout') || null);

        if (!hydrated) {
          const adminInspection = records.find(r => r.record_type === 'admin_inspection');
          if (adminInspection) {
            if (adminInspection.odometer != null) setOdometer(String(adminInspection.odometer));
            if (adminInspection.fuel_level) setFuelLevel(adminInspection.fuel_level);
            if (adminInspection.condition_notes) {
              setNotes(adminInspection.condition_notes);
              setShowNotes(true);
            }
            if (Array.isArray(adminInspection.photo_urls) && adminInspection.photo_urls.length > 0) {
              setPhotos(adminInspection.photo_urls);
            }
            // Resume at Review Charges — condition is already saved.
            setStep(s => (s === 0 ? 1 : s));
          }
          setHydrated(true);
        }
      } catch (e) { console.error(e); }
    })();
  }, [booking.id, hydrated]);

  async function loadIncidentals() {
    try {
      const data = await api.getIncidentals(booking.id);
      setIncidentals(Array.isArray(data) ? data : []);
      setIncidentalsLoaded(true);
    } catch (e) { console.error(e); }
  }

  async function loadDepositAndInvoice() {
    try {
      const [dep, inv] = await Promise.all([
        api.getBookingDeposit(booking.id).catch(() => null),
        api.getInvoice(booking.id).catch(() => null),
      ]);
      if (dep && dep.status !== 'none' && dep.amount > 0) {
        setDeposit(dep);
      } else if (booking.deposit_amount) {
        setDeposit({
          amount: Math.round(booking.deposit_amount * 100),
          status: booking.deposit_status || 'held',
        });
      }
      setInvoice(inv);
    } catch (e) { console.error(e); }
  }

  /* ── Step 1 → 2: Save condition record ── */
  async function handleSaveCondition() {
    setLoading(true);
    setError('');
    try {
      await api.recordCheckOut(booking.id, {
        odometer: odometer ? Number(odometer) : undefined,
        fuelLevel,
        conditionNotes: notes || undefined,
        photoUrls: photos.length > 0 ? photos : undefined,
      });

      // Auto-calculate incidentals
      try {
        await api.recordInspection(booking.id, {
          checkoutOdometer: odometer ? Number(odometer) : undefined,
          fuelLevel,
          autoCalculate: true,
        });
      } catch (calcErr) {
        // Non-fatal — inspection endpoint may not exist or may fail, we continue
        console.log('[CheckOut] Auto-calculate skipped:', calcErr.message);
      }

      await loadIncidentals();
      setStep(1);
    } catch (err) {
      setError(err.message || 'Failed to save condition');
    }
    setLoading(false);
  }

  /* ── Step 2: Incidental CRUD ── */
  async function handleAddIncidental() {
    if (!newIncAmount) return;
    setLoading(true);
    try {
      const typeConfig = INCIDENTAL_TYPES.find(t => t.value === newIncType);
      await api.addIncidental(booking.id, {
        type: newIncType,
        description: newIncDesc || typeConfig?.label || newIncType,
        amount: Math.round(Number(newIncAmount) * 100),
      });
      setNewIncAmount('');
      setNewIncDesc('');
      await loadIncidentals();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleWaiveIncidental(id) {
    try {
      await api.updateIncidental(id, { waived: true });
      await loadIncidentals();
    } catch (e) { setError(e.message); }
  }

  async function handleDeleteIncidental(id) {
    try {
      await api.deleteIncidental(id);
      await loadIncidentals();
    } catch (e) { setError(e.message); }
  }

  /* ── Step 3: Finalize ── */
  async function handleGenerateInvoice() {
    setLoading(true);
    try {
      const inv = await api.generateInvoice(booking.id);
      setInvoice(inv);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleReleaseDeposit() {
    if (!confirm('Refund the full deposit back to the customer?')) return;
    setLoading(true);
    try {
      await api.releaseDeposit(booking.id);
      await loadDepositAndInvoice();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleSettleDeposit() {
    if (!confirm('Settle the deposit against incidentals?')) return;
    setLoading(true);
    try {
      const activeTotal = incidentals.filter(i => !i.waived).reduce((sum, i) => sum + i.amount, 0);
      await api.settleDeposit(booking.id, { incidentalTotal: activeTotal });
      await loadDepositAndInvoice();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleComplete() {
    setLoading(true);
    setError('');
    try {
      // Generate invoice if not exists
      if (!invoice) {
        await api.generateInvoice(booking.id);
      }
      // Complete the booking
      await api.completeBooking(booking.id);
      setCompleted(true);
      onReload?.();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleSendInvoiceAndComplete() {
    setLoading(true);
    setError('');
    try {
      // Generate invoice if not exists
      let inv = invoice;
      if (!inv) {
        inv = await api.generateInvoice(booking.id);
        setInvoice(inv);
      }
      // Send invoice
      if (inv?.id && inv.status === 'draft') {
        await api.sendInvoice(inv.id);
      }
      // Complete the booking
      await api.completeBooking(booking.id);
      setCompleted(true);
      onReload?.();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  /* ── Computed values ── */
  const activeIncidentals = incidentals.filter(i => !i.waived);
  const incidentalTotal = activeIncidentals.reduce((sum, i) => sum + (i.amount || 0), 0);
  const depositAmount = deposit?.amount || 0;
  const depositHeld = deposit?.status === 'held';
  const refundAmount = Math.max(0, depositAmount - incidentalTotal);
  const customerOwes = Math.max(0, incidentalTotal - depositAmount);

  /* ── Completed State ─────────────────────────────────────────────── */
  if (completed || isAlreadyDone) {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-5">
        <div className="text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Rental Complete</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {vehicleName} has been checked out, inspected, and the booking is finalized.
          </p>
        </div>
        <CustomerRecordCard title="Customer Check-Out" record={customerCheckout} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-2">
      {/* Customer-recorded check-out — shown above the admin form */}
      <CustomerRecordCard title="Customer Check-Out" record={customerCheckout} />

      {/* Stepper */}
      <StepperHeader step={step} steps={STEPS} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* ═══ STEP 1: Vehicle Condition ═══ */}
      {step === 0 && (
        <div className="space-y-5">
          {/* Vehicle header */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{vehicleName}</p>
            <p className="text-xs text-[var(--text-tertiary)] font-mono">{v?.vehicle_code}</p>
            {booking.checkin_odometer && (
              <p className="text-xs text-[var(--text-tertiary)]">Check-in odometer: {Number(booking.checkin_odometer).toLocaleString()} mi</p>
            )}
            {/* Paid add-on badges + mileage allowance chip — at-a-glance signal */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hasUnlimitedMiles && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  ∞ Unlimited Miles · Paid
                </span>
              )}
              {hasUnlimitedTolls && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  Unlimited Tolls · Paid
                </span>
              )}
              {!hasUnlimitedMiles && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full tabular-nums"
                  style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  title={`${FREE_MILES_PER_DAY} mi/day × ${rentalDaysCount} day${rentalDaysCount !== 1 ? 's' : ''}`}
                >
                  Free Miles: {freeMilesTotal.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Odometer */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Gauge size={13} /> Return Odometer
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full px-4 py-3.5 rounded-xl text-lg font-semibold tabular-nums"
              style={{ backgroundColor: 'var(--bg-card-hover)', border: '2px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
              placeholder="46,120"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
            />
            {booking.checkin_odometer && odometer && (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-[var(--text-tertiary)] tabular-nums">
                  Trip: {(Number(odometer) - Number(booking.checkin_odometer)).toLocaleString()} miles
                </p>
                {/* Mileage status — same font size as the trip line */}
                {hasUnlimitedMiles ? (
                  <p className="text-xs font-medium tabular-nums" style={{ color: '#15803d' }}>
                    Unlimited mileage
                  </p>
                ) : tripMiles != null && overageMilesLive > 0 ? (
                  <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--danger-color)' }}>
                    {overageMilesLive.toLocaleString()} mi over · ${overageDollars.toFixed(2)} fee
                  </p>
                ) : tripMiles != null ? (
                  <p className="text-xs font-medium tabular-nums" style={{ color: '#15803d' }}>
                    Under mileage allowance
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Fuel */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Fuel size={13} /> Fuel Level
            </label>
            <FuelSelector value={fuelLevel} onChange={setFuelLevel} />
            {/* Fuel discrepancy — same font size as mileage / trip indicators */}
            {fuelOK !== null && (
              <p
                className="text-xs font-medium mt-1.5"
                style={{ color: fuelOK ? '#15803d' : 'var(--danger-color)' }}
              >
                {fuelOK ? 'Fuel level OK' : `Fuel discrepancy · check-in was ${adminPrepFuel}`}
              </p>
            )}
          </div>

          {/* Photos */}
          <AdminPhotoUploader photos={photos} setPhotos={setPhotos} />

          {/* Notes */}
          {!showNotes ? (
            <button type="button" onClick={() => setShowNotes(true)} className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              + Add condition notes
            </button>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">Condition Notes</label>
              <textarea className="w-full px-4 py-3 rounded-xl text-sm resize-none" rows={3}
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '2px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
                placeholder="Any damage, scratches, missing items…"
                value={notes} onChange={e => setNotes(e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
              />
            </div>
          )}

          {/* Next */}
          <button onClick={handleSaveCondition} disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917', minHeight: '56px', boxShadow: '0 4px 14px rgba(200,169,126,0.3)' }}>
            {loading ? <><Loader2 size={20} className="animate-spin" /> Saving…</> : <>Next: Review Charges <ChevronRight size={18} /></>}
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Review Charges ═══ */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Incidentals List */}
          <Section title="Charges">
            {activeIncidentals.length === 0 && incidentals.filter(i => i.waived).length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
                No charges detected. Add manual charges below if needed.
              </p>
            ) : (
              <div className="space-y-2">
                {incidentals.map(inc => (
                  <div key={inc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${inc.waived ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: inc.waived ? 'var(--border-subtle)' : 'rgba(239,68,68,0.2)' }}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${inc.waived ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                        {inc.description || inc.type}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] capitalize">{inc.type?.replace(/_/g, ' ')}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${inc.waived ? 'text-[var(--text-tertiary)]' : 'text-[var(--danger-color)]'}`}>
                      ${(inc.amount / 100).toFixed(2)}
                    </span>
                    <div className="flex gap-1">
                      {!inc.waived && (
                        <button onClick={() => handleWaiveIncidental(inc.id)} className="btn-ghost text-xs px-2 py-1" title="Waive charge">
                          Waive
                        </button>
                      )}
                      <button onClick={() => handleDeleteIncidental(inc.id)} className="text-[var(--text-tertiary)] hover:text-[var(--danger-color)] p-1" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {activeIncidentals.length > 0 && (
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-[var(--border-subtle)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Total Charges</span>
                <span className="text-lg font-bold tabular-nums text-[var(--danger-color)]">
                  ${(incidentalTotal / 100).toFixed(2)}
                </span>
              </div>
            )}
          </Section>

          {/* Add Incidental */}
          <Section title="Add Charge">
            <div className="space-y-3">
              <select
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                value={newIncType}
                onChange={e => {
                  const next = e.target.value;
                  setNewIncType(next);
                  const config = INCIDENTAL_TYPES.find(t => t.value === next);
                  // Pre-fill mileage_overage with the live calculated fee from the
                  // odometer reading (admin can override). Otherwise use the type's
                  // configured default amount.
                  if (next === 'mileage_overage' && overageDollars > 0) {
                    setNewIncAmount(overageDollars.toFixed(2));
                  } else if (config?.defaultAmount) {
                    setNewIncAmount((config.defaultAmount / 100).toString());
                  } else {
                    setNewIncAmount('');
                  }
                  setNewIncDesc(config?.label || '');
                }}
              >
                {INCIDENTAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  inputMode="decimal"
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  placeholder="Amount ($)"
                  value={newIncAmount}
                  onChange={e => setNewIncAmount(e.target.value)}
                />
                <button onClick={handleAddIncidental} disabled={!newIncAmount || loading} className="btn-secondary justify-center">
                  <Plus size={14} /> Add Charge
                </button>
              </div>
              <input
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                placeholder="Description (optional)"
                value={newIncDesc}
                onChange={e => setNewIncDesc(e.target.value)}
              />
            </div>
          </Section>

          {/* Navigation */}
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-ghost flex-1 justify-center py-3.5">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => { setStep(2); handleGenerateInvoice(); }} disabled={loading}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>Next: Finalize <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Finalize ═══ */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Deposit Summary */}
          <Section title="Security Deposit">
            {deposit && depositHeld ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">${(depositAmount / 100).toFixed(2)}</p>
                    <p className="text-xs text-emerald-500 font-semibold capitalize">Held</p>
                  </div>
                </div>

                {incidentalTotal > 0 ? (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--text-secondary)]">Charges</span>
                      <span className="font-semibold text-amber-500 tabular-nums">-${(incidentalTotal / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{customerOwes > 0 ? 'Customer owes' : 'Refund to customer'}</span>
                      <span className={`font-bold tabular-nums ${customerOwes > 0 ? 'text-[var(--danger-color)]' : 'text-emerald-500'}`}>
                        ${((customerOwes > 0 ? customerOwes : refundAmount) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p className="text-sm text-emerald-600 font-medium">No charges — full refund of ${(depositAmount / 100).toFixed(2)}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {incidentalTotal === 0 ? (
                    <button onClick={handleReleaseDeposit} disabled={loading} className="btn-primary flex-1 justify-center text-sm">
                      {loading ? 'Processing…' : 'Refund Full Deposit'}
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSettleDeposit} disabled={loading} className="btn-primary flex-1 justify-center text-sm">
                        {loading ? 'Processing…' : 'Settle Against Charges'}
                      </button>
                      <button onClick={handleReleaseDeposit} disabled={loading} className="btn-ghost flex-1 justify-center text-sm">
                        Refund Anyway
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : deposit && deposit.status !== 'held' ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="text-[var(--text-secondary)]">Deposit {deposit.status}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)] ml-auto">${(depositAmount / 100).toFixed(2)}</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No deposit on file</p>
            )}
          </Section>

          {/* Settlement Preview */}
          {invoice && (
            <Section title="Deposit Settlement">
              <div className="space-y-1.5">
                {(invoice.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                    <span className="text-[var(--text-secondary)]">{item.description}</span>
                    <span className={`font-semibold tabular-nums ${
                      item.type === 'deposit' ? 'text-emerald-500' :
                      item.type === 'incidental' ? 'text-[var(--danger-color)]' :
                      'text-[var(--text-primary)]'
                    }`}>
                      ${(item.amount / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              {invoice.amount_due !== undefined && invoice.amount_due !== 0 && (
                <div className="flex justify-between text-base font-bold pt-3 mt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-primary)]">{invoice.amount_due > 0 ? 'Balance Due' : 'Refund Due'}</span>
                  <span className={`tabular-nums ${invoice.amount_due > 0 ? 'text-[var(--danger-color)]' : 'text-emerald-500'}`}>
                    ${(Math.abs(invoice.amount_due) / 100).toFixed(2)}
                  </span>
                </div>
              )}
              {invoice.amount_due === 0 && invoice.deposit_applied > 0 && (
                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)]">
                  <p className="text-sm text-emerald-500 font-medium">✓ No charges — full deposit refund</p>
                </div>
              )}
            </Section>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-ghost flex-1 justify-center py-3.5">
              <ChevronLeft size={16} /> Back
            </button>
          </div>

          {/* Complete Actions */}
          <div className="space-y-3 pt-2">
            <button onClick={handleSendInvoiceAndComplete} disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: '#22c55e', color: '#fff', minHeight: '56px', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}>
              {loading ? <><Loader2 size={20} className="animate-spin" /> Processing…</> : <><Send size={18} /> Send Invoice & Complete Rental</>}
            </button>

            <button onClick={handleComplete} disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
              Complete Without Sending Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
