import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import Field from '../shared/Field';
import { Clipboard, Plus, Trash2, AlertTriangle, Camera, DollarSign, CheckCircle } from 'lucide-react';

const INCIDENTAL_TYPES = [
  { value: 'cleaning', label: 'Cleaning Fee', defaultAmount: 7500 },
  { value: 'gas', label: 'Gas Discrepancy', defaultAmount: 5000 },
  { value: 'smoking', label: 'Smoking Fee', defaultAmount: 15000 },
  { value: 'damage', label: 'Damage Charge', defaultAmount: 0 },
  { value: 'late_return', label: 'Late Return Fee', defaultAmount: 0 },
  { value: 'mileage_overage', label: 'Mileage Overage', defaultAmount: 0 },
  { value: 'toll_violation', label: 'Toll Violation', defaultAmount: 3500 },
  { value: 'other', label: 'Other', defaultAmount: 0 },
];

export default function InspectionTab({ booking, onReload }) {
  const [incidentals, setIncidentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [addingIncidental, setAddingIncidental] = useState(false);
  const [deposit, setDeposit] = useState(null);

  const [inspectionForm, setInspectionForm] = useState({
    checkoutOdometer: '',
    fuelLevel: 'full',
    conditionNotes: '',
  });

  const [newIncidental, setNewIncidental] = useState({
    type: 'cleaning',
    amount: '',
    description: '',
    waived: false,
  });

  useEffect(() => {
    loadData();
  }, [booking.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [inc, dep] = await Promise.all([
        api.getIncidentals(booking.id).catch(() => []),
        api.getBookingDeposit(booking.id).catch(() => null),
      ]);
      setIncidentals(inc);
      setDeposit(dep);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleInspection() {
    setInspecting(true);
    try {
      await api.recordInspection(booking.id, {
        checkoutOdometer: inspectionForm.checkoutOdometer ? Number(inspectionForm.checkoutOdometer) : undefined,
        fuelLevel: inspectionForm.fuelLevel,
        conditionNotes: inspectionForm.conditionNotes || undefined,
      });
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setInspecting(false);
  }

  async function handleAddIncidental() {
    setAddingIncidental(true);
    try {
      await api.addIncidental(booking.id, {
        type: newIncidental.type,
        amount: Math.round(Number(newIncidental.amount) * 100),
        description: newIncidental.description,
        waived: newIncidental.waived,
      });
      setNewIncidental({ type: 'cleaning', amount: '', description: '', waived: false });
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

  const isInspectable = ['returned'].includes(booking.status);
  const inspectionDone = booking.inspection_completed_at;
  const activeIncidentals = incidentals.filter(i => !i.waived);
  const incidentalTotal = activeIncidentals.reduce((sum, i) => sum + i.amount, 0);
  const depositAmt = deposit?.amount || 0;
  const netRefund = Math.max(0, depositAmt - incidentalTotal);
  const amountOwed = Math.max(0, incidentalTotal - depositAmt);

  return (
    <div className="space-y-5">
      {/* Inspection Status Banner */}
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

      {/* Inspection Form */}
      {isInspectable && !inspectionDone && (
        <Section title="Post-Return Inspection">
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
                placeholder="Document any damage, cleanliness issues, or missing items…"
                value={inspectionForm.conditionNotes}
                onChange={e => setInspectionForm(f => ({ ...f, conditionNotes: e.target.value }))}
              />
            </div>
            <button onClick={handleInspection} disabled={inspecting} className="btn-primary">
              <Clipboard size={15} />
              {inspecting ? 'Running Inspection…' : 'Complete Inspection'}
            </button>
            <p className="text-xs text-[var(--text-tertiary)]">
              This will auto-calculate mileage overages and late fees based on booking data.
            </p>
          </div>
        </Section>
      )}

      {/* Mileage Summary */}
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
            <Field label="Allowed" value={`${(booking.rental_days || 1) * 200} mi`} />
          </div>
        </Section>
      )}

      {/* Incidentals List */}
      <Section title="Incidentals">
        {incidentals.length > 0 ? (
          <div className="space-y-2">
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
                    title={inc.waived ? 'Unwaive' : 'Waive'}
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
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No incidentals recorded</p>
        )}

        {/* Add Incidental Form */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Add Incidental</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <select
                className="input text-sm"
                value={newIncidental.type}
                onChange={e => {
                  const match = INCIDENTAL_TYPES.find(t => t.value === e.target.value);
                  setNewIncidental(f => ({
                    ...f,
                    type: e.target.value,
                    amount: match?.defaultAmount ? (match.defaultAmount / 100).toFixed(2) : f.amount,
                  }));
                }}
              >
                {INCIDENTAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                className="input text-sm"
                placeholder="Amount ($)"
                value={newIncidental.amount}
                onChange={e => setNewIncidental(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <input
                className="input text-sm"
                placeholder="Description"
                value={newIncidental.description}
                onChange={e => setNewIncidental(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={handleAddIncidental}
            disabled={addingIncidental || !newIncidental.amount}
            className="btn-secondary mt-3"
          >
            <Plus size={14} />
            {addingIncidental ? 'Adding…' : 'Add Charge'}
          </button>
        </div>
      </Section>

      {/* Deposit Settlement Summary */}
      {(incidentals.length > 0 || depositAmt > 0) && (
        <Section title="Settlement Summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Security Deposit Held</span>
              <span className="tabular-nums text-emerald-500">
                ${(depositAmt / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Total Incidentals ({activeIncidentals.length} charge{activeIncidentals.length !== 1 ? 's' : ''})</span>
              <span className="tabular-nums text-[var(--danger-color)]">
                -${(incidentalTotal / 100).toFixed(2)}
              </span>
            </div>
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
