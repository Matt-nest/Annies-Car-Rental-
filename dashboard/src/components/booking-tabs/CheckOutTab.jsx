import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import Field from '../shared/Field';
import {
  Clipboard, Plus, Trash2, AlertTriangle, Camera, DollarSign,
  CheckCircle, ChevronDown, ImagePlus, X, Fuel
} from 'lucide-react';

/* ── Incidental type definitions ─────────────────────────────────────────────
   Defaults now match the actual rental agreement (Section 7 — Charges).
   Gas + late + mileage are auto-calculated when possible.
   ──────────────────────────────────────────────────────────────────────────── */
const INCIDENTAL_TYPES = [
  { value: 'cleaning',        label: 'Cleaning Fee',      defaultAmount: 7500,  maxAmount: 25000, desc: 'Vehicle returned excessively dirty' },
  { value: 'smoking',         label: 'Smoking / Pet Fee',  defaultAmount: 25000, maxAmount: 25000, desc: 'Evidence of smoking or animal transport' },
  { value: 'gas',             label: 'Fuel Refill',        defaultAmount: 0,     maxAmount: null,  desc: '$20 per quarter tank short' },
  { value: 'late_return',     label: 'Late Return Fee',    defaultAmount: 0,     maxAmount: null,  desc: '$30 per day late' },
  { value: 'mileage_overage', label: 'Mileage Overage',    defaultAmount: 0,     maxAmount: null,  desc: '$0.34 per mile over 200/day' },
  { value: 'toll_violation',  label: 'Toll / Traffic Violation', defaultAmount: 5000, maxAmount: null, desc: '$50 admin fee per violation' },
  { value: 'damage',          label: 'Vehicle Damage',     defaultAmount: 0,     maxAmount: null,  desc: 'Custom amount — describe damage' },
  { value: 'other',           label: 'Other Charge',       defaultAmount: 0,     maxAmount: null,  desc: 'Any other incidental charge' },
];

const FUEL_LEVELS = ['full', '3/4', '1/2', '1/4', 'empty'];
const FUEL_QUARTERS = { full: 4, '3/4': 3, '1/2': 2, '1/4': 1, empty: 0 };

export default function CheckOutTab({ booking, onReload }) {
  // ── State ───────────────────────────────────────────────────────────────
  const [incidentals, setIncidentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [addingIncidental, setAddingIncidental] = useState(false);
  const [deposit, setDeposit] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [inspectionForm, setInspectionForm] = useState({
    checkoutOdometer: '',
    fuelLevel: 'full',
    conditionNotes: '',
  });

  // Multi-select incidental
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [incidentalRows, setIncidentalRows] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => { loadData(); }, [booking.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [inc, dep] = await Promise.all([
        api.getIncidentals(booking.id).catch(() => []),
        api.getBookingDeposit(booking.id).catch(() => null),
      ]);
      setIncidentals(inc);
      // Fallback: booking_deposits table may be empty — use booking.deposit_amount
      if (dep && dep.status !== 'none' && dep.amount > 0) {
        setDeposit(dep);
      } else if (booking.deposit_amount) {
        setDeposit({
          amount: Math.round(booking.deposit_amount * 100),
          status: booking.deposit_status || 'held',
        });
      } else {
        setDeposit(null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // ── Auto-calculations ──────────────────────────────────────────────────
  const checkinOdo = booking.checkin_odometer;
  const returnOdo = inspectionForm.checkoutOdometer ? Number(inspectionForm.checkoutOdometer) : booking.checkout_odometer;
  const milesDriven = checkinOdo && returnOdo ? returnOdo - checkinOdo : null;
  const milesAllowed = (booking.rental_days || 1) * 200;
  const milesOver = milesDriven !== null ? Math.max(0, milesDriven - milesAllowed) : 0;
  const mileageCharge = Math.round(milesOver * 34); // cents

  // Fuel math
  const checkinFuel = booking.checkin_fuel_level || 'full';
  const returnFuel = inspectionForm.fuelLevel;
  const fuelDiff = FUEL_QUARTERS[checkinFuel] - FUEL_QUARTERS[returnFuel]; // positive = short
  const fuelCharge = Math.max(0, fuelDiff) * 2000; // $20/quarter tank in cents

  // Late return math
  const scheduledReturn = booking.return_date ? new Date(booking.return_date) : null;
  const actualReturn = booking.actual_return_date ? new Date(booking.actual_return_date) : new Date();
  const daysLate = scheduledReturn ? Math.max(0, Math.ceil((actualReturn - scheduledReturn) / (1000 * 60 * 60 * 24))) : 0;
  const lateCharge = daysLate * 3000; // $30/day in cents

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleInspection() {
    setInspecting(true);
    try {
      await api.recordInspection(booking.id, {
        checkoutOdometer: inspectionForm.checkoutOdometer ? Number(inspectionForm.checkoutOdometer) : undefined,
        fuelLevel: inspectionForm.fuelLevel,
        conditionNotes: inspectionForm.conditionNotes || undefined,
        photoUrls: [],
      });
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setInspecting(false);
  }

  function handleSelectIncidental(type) {
    if (selectedTypes.includes(type.value)) return;
    setSelectedTypes(prev => [...prev, type.value]);

    // Auto-calculate amount for auto-calculable types
    let autoAmount = type.defaultAmount;
    if (type.value === 'gas') autoAmount = fuelCharge;
    if (type.value === 'late_return') autoAmount = lateCharge;
    if (type.value === 'mileage_overage') autoAmount = mileageCharge;

    setIncidentalRows(prev => [...prev, {
      type: type.value,
      label: type.label,
      amount: (autoAmount / 100).toFixed(2),
      description: type.value === 'gas' ? `Fuel: returned at ${returnFuel} (checked-in at ${checkinFuel})` :
                   type.value === 'late_return' ? `${daysLate} day${daysLate !== 1 ? 's' : ''} late × $30/day` :
                   type.value === 'mileage_overage' ? `${milesOver.toLocaleString()} miles over × $0.34/mile` :
                   '',
    }]);
    setShowDropdown(false);
  }

  function handleRemoveRow(typeValue) {
    setSelectedTypes(prev => prev.filter(t => t !== typeValue));
    setIncidentalRows(prev => prev.filter(r => r.type !== typeValue));
  }

  function handleRowChange(typeValue, field, value) {
    setIncidentalRows(prev => prev.map(r =>
      r.type === typeValue ? { ...r, [field]: value } : r
    ));
  }

  async function handleSaveAllIncidentals() {
    setAddingIncidental(true);
    try {
      for (const row of incidentalRows) {
        await api.addIncidental(booking.id, {
          type: row.type,
          amount: Math.round(Number(row.amount) * 100),
          description: row.description,
          waived: false,
        });
      }
      setIncidentalRows([]);
      setSelectedTypes([]);
      await loadData();
    } catch (e) { console.error(e); alert(e.message); }
    setAddingIncidental(false);
  }

  async function handleDeleteIncidental(id) {
    if (!confirm('Delete this incidental charge?')) return;
    try {
      await api.deleteIncidental(id);
      await loadData();
    } catch (e) { console.error(e); }
  }

  async function handleWaiveToggle(inc) {
    try {
      await api.updateIncidental(inc.id, { waived: !inc.waived });
      await loadData();
    } catch (e) { console.error(e); }
  }

  // Photo handling
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

  // ── Computed ───────────────────────────────────────────────────────────
  const isInspectable = ['returned', 'active'].includes(booking.status);
  const inspectionDone = booking.inspection_completed_at;
  const activeIncidentals = incidentals.filter(i => !i.waived);
  const incidentalTotal = activeIncidentals.reduce((sum, i) => sum + i.amount, 0);
  const depositAmt = deposit?.amount || 0;
  const netRefund = Math.max(0, depositAmt - incidentalTotal);
  const amountOwed = Math.max(0, incidentalTotal - depositAmt);

  const availableTypes = INCIDENTAL_TYPES.filter(t =>
    !selectedTypes.includes(t.value) && !incidentals.some(i => i.type === t.value && !i.waived)
  );

  return (
    <div className="space-y-5">
      {/* ── Step 1: Inspection Complete Banner ──────────────────────────── */}
      {inspectionDone && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Inspection Completed</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Completed {new Date(booking.inspection_completed_at).toLocaleString()}
              {booking.inspection_completed_by && ` by ${booking.inspection_completed_by}`}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 1: Return Inspection Form ─────────────────────────────── */}
      {isInspectable && !inspectionDone && (
        <Section title="Step 1 — Return Inspection">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Return Odometer</label>
                <input
                  type="number"
                  className="input text-sm"
                  placeholder="e.g. 46120"
                  value={inspectionForm.checkoutOdometer}
                  onChange={e => setInspectionForm(f => ({ ...f, checkoutOdometer: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Fuel Level</label>
                <select
                  className="input text-sm"
                  value={inspectionForm.fuelLevel}
                  onChange={e => setInspectionForm(f => ({ ...f, fuelLevel: e.target.value }))}
                >
                  {FUEL_LEVELS.map(l => (
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
                placeholder="Document any damage, cleanliness issues, or missing items…"
                value={inspectionForm.conditionNotes}
                onChange={e => setInspectionForm(f => ({ ...f, conditionNotes: e.target.value }))}
              />
            </div>

            {/* Photo Uploader */}
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Return Photos</label>
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

            {/* Auto-calc preview */}
            {(milesDriven !== null || fuelDiff > 0 || daysLate > 0) && (
              <div className="bg-[var(--bg-elevated)] rounded-lg p-3 border border-[var(--border-subtle)] space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Auto-Detected</p>
                {milesDriven !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Miles driven: {milesDriven.toLocaleString()} / {milesAllowed.toLocaleString()} allowed</span>
                    {milesOver > 0 && <span className="text-amber-500 font-semibold">{milesOver.toLocaleString()} over → ${(mileageCharge/100).toFixed(2)}</span>}
                  </div>
                )}
                {fuelDiff > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Fuel: {checkinFuel} → {returnFuel}</span>
                    <span className="text-amber-500 font-semibold">{fuelDiff} quarter{fuelDiff > 1 ? 's' : ''} short → ${(fuelCharge/100).toFixed(2)}</span>
                  </div>
                )}
                {daysLate > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Late: {daysLate} day{daysLate !== 1 ? 's' : ''}</span>
                    <span className="text-amber-500 font-semibold">${(lateCharge/100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleInspection} disabled={inspecting} className="btn-primary">
              <Clipboard size={15} />
              {inspecting ? 'Saving Inspection…' : 'Complete Inspection'}
            </button>
          </div>
        </Section>
      )}

      {/* ── Mileage Summary ────────────────────────────────────────────── */}
      {(booking.checkin_odometer || booking.checkout_odometer) && (
        <Section title="Mileage Summary">
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Check-In" value={booking.checkin_odometer?.toLocaleString() || '—'} />
            <Field label="Check-Out" value={booking.checkout_odometer?.toLocaleString() || '—'} />
            <Field label="Total Miles" value={
              booking.checkin_odometer && booking.checkout_odometer
                ? (booking.checkout_odometer - booking.checkin_odometer).toLocaleString()
                : '—'
            } />
            <Field label="Allowed" value={`${milesAllowed.toLocaleString()} mi`} />
          </div>
        </Section>
      )}

      {/* ── Step 2: Incidentals ────────────────────────────────────────── */}
      <Section title="Step 2 — Incidentals">
        {/* Existing incidentals */}
        {incidentals.length > 0 && (
          <div className="space-y-2 mb-4">
            {incidentals.map(inc => (
              <div
                key={inc.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  inc.waived
                    ? 'bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-50'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex-1">
                  <p className={`text-sm font-medium ${inc.waived ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                    {inc.description || inc.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] capitalize">{inc.type.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${inc.waived ? 'text-[var(--text-tertiary)]' : 'text-[var(--danger-color)]'}`}>
                    ${(inc.amount / 100).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleWaiveToggle(inc)}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      inc.waived
                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                    }`}
                  >
                    {inc.waived ? 'Unwaive' : 'Waive'}
                  </button>
                  <button
                    onClick={() => handleDeleteIncidental(inc.id)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--danger-color)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Multi-select add incidentals */}
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Add Incidentals</p>

          {/* Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="input text-sm flex items-center justify-between w-full"
              disabled={availableTypes.length === 0}
            >
              <span className="text-[var(--text-tertiary)]">
                {availableTypes.length > 0 ? 'Select incidental type…' : 'All types added'}
              </span>
              <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {availableTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => handleSelectIncidental(type)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">{type.label}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{type.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected incidental rows */}
          {incidentalRows.length > 0 && (
            <div className="space-y-3 mt-4">
              {incidentalRows.map(row => (
                <div key={row.type} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{row.label}</span>
                    <button onClick={() => handleRemoveRow(row.type)} className="text-[var(--text-tertiary)] hover:text-[var(--danger-color)]">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--text-tertiary)] mb-0.5 block">Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input text-sm"
                        value={row.amount}
                        onChange={e => handleRowChange(row.type, 'amount', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-tertiary)] mb-0.5 block">Description</label>
                      <input
                        className="input text-sm"
                        placeholder="Details…"
                        value={row.description}
                        onChange={e => handleRowChange(row.type, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={handleSaveAllIncidentals}
                disabled={addingIncidental || incidentalRows.every(r => !r.amount || Number(r.amount) <= 0)}
                className="btn-primary"
              >
                <Plus size={14} />
                {addingIncidental ? 'Saving…' : `Add ${incidentalRows.length} Charge${incidentalRows.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ── Step 3: Settlement Summary ─────────────────────────────────── */}
      {(incidentals.length > 0 || depositAmt > 0) && (
        <Section title="Step 3 — Settlement Summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Security Deposit Held</span>
              <span className="tabular-nums text-emerald-500">
                ${(depositAmt / 100).toFixed(2)}
              </span>
            </div>
            {activeIncidentals.map(inc => (
              <div key={inc.id} className="flex justify-between text-[var(--text-secondary)]">
                <span className="text-xs">{inc.description || inc.type.replace(/_/g, ' ')}</span>
                <span className="tabular-nums text-[var(--danger-color)]">
                  -${(inc.amount / 100).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-[var(--text-primary)] pt-2 border-t border-[var(--border-subtle)]">
              {amountOwed > 0 ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Customer Owes
                  </span>
                  <span className="text-[var(--danger-color)] tabular-nums">${(amountOwed / 100).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span>Refund to Customer</span>
                  <span className="text-emerald-500 tabular-nums">${(netRefund / 100).toFixed(2)}</span>
                </>
              )}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
