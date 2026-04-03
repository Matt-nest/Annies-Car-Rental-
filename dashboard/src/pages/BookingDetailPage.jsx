import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, MapPin, CheckCircle, XCircle, Package, RotateCcw, Flag, DollarSign } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import AgreementSection from '../components/shared/AgreementSection';
import { format, formatDistanceToNow } from 'date-fns';

function Section({ title, children }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-sm text-stone-900 font-medium">{value || '—'}</p>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [actioning, setActioning] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ payment_type: 'rental', amount: '', method: 'cash', reference_id: '', notes: '' });
  const [conditionForm, setConditionForm] = useState({ fuel: 'full', notes: '', photoUrl: '' });
  const [damageForm, setDamageForm] = useState({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });

  const load = async () => {
    setLoading(true);
    try {
      const b = await api.getBooking(id);
      setBooking(b);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  async function doAction(action) {
    setActioning(true);
    try {
      if (action === 'approve')  await api.approveBooking(id);
      if (action === 'decline')  await api.declineBooking(id, modalInput);
      if (action === 'cancel')   await api.cancelBooking(id, modalInput);
      if (action === 'pickup')   await api.recordPickup(id, {
        mileage: modalInput,
        fuel_level: conditionForm.fuel,
        condition_notes: conditionForm.notes || undefined,
        photos: conditionForm.photoUrl ? [conditionForm.photoUrl] : [],
      });
      if (action === 'return')   await api.recordReturn(id, {
        mileage: modalInput,
        fuel_level: conditionForm.fuel,
        condition_notes: conditionForm.notes || undefined,
        photos: conditionForm.photoUrl ? [conditionForm.photoUrl] : [],
      });
      if (action === 'complete') await api.completeBooking(id);
      if (action === 'payment')  await api.recordPayment(id, paymentForm);
      if (action === 'damage')   await api.fileDamageReport(id, damageForm);
      await load();
    } catch (e) { console.error(e); }
    setModal(null);
    setModalInput('');
    setConditionForm({ fuel: 'full', notes: '', photoUrl: '' });
    setDamageForm({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });
    setActioning(false);
  }

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!booking) return <div className="p-6 text-stone-500">Booking not found</div>;

  const { status, customers: c, vehicles: v } = booking;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bookings')} className="btn-ghost py-1.5 px-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-stone-900 font-mono">{booking.booking_code}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Created {format(new Date(booking.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Contextual action buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {status === 'pending_approval' && (
            <>
              <button onClick={() => doAction('approve')} className="btn-primary">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => setModal('decline')} className="btn-danger">
                <XCircle size={15} /> Decline
              </button>
            </>
          )}
          {['approved', 'confirmed'].includes(status) && (
            <button onClick={() => setModal('pickup')} className="btn-primary">
              <Package size={15} /> Record Pickup
            </button>
          )}
          {status === 'active' && (
            <button onClick={() => setModal('return')} className="btn-primary">
              <RotateCcw size={15} /> Record Return
            </button>
          )}
          {status === 'returned' && (
            <>
              <button onClick={() => doAction('complete')} className="btn-primary">
                <CheckCircle size={15} /> Complete
              </button>
              <button onClick={() => setModal('damage')} className="btn-secondary">
                <Flag size={15} /> Damage Report
              </button>
            </>
          )}
          {['pending_approval', 'approved', 'confirmed', 'active'].includes(status) && (
            <button onClick={() => setModal('cancel')} className="btn-ghost text-red-500">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Customer */}
        <Section title="Customer">
          <p className="font-semibold text-stone-900">{c?.first_name} {c?.last_name}</p>
          <div className="space-y-2">
            <a href={`tel:${c?.phone}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600">
              <Phone size={14} /> {c?.phone}
            </a>
            <a href={`mailto:${c?.email}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600">
              <Mail size={14} /> {c?.email}
            </a>
          </div>
          {c?.driver_license_number && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="DL Number" value={c.driver_license_number} />
              <Field label="DL State" value={c.driver_license_state} />
              <Field label="DL Expiry" value={c.driver_license_expiry} />
            </div>
          )}
        </Section>

        {/* Vehicle */}
        <Section title="Vehicle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
              <Car size={18} className="text-stone-500" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">{v?.year} {v?.make} {v?.model}</p>
              <p className="text-xs text-stone-400 font-mono">{v?.vehicle_code}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily Rate" value={`$${booking.daily_rate}`} />
            <Field label="Rental Days" value={booking.rental_days} />
          </div>
        </Section>

        {/* Rental Details */}
        <Section title="Rental Details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pickup Date" value={format(new Date(booking.pickup_date), 'MMM d, yyyy')} />
            <Field label="Pickup Time" value={booking.pickup_time} />
            <Field label="Return Date" value={format(new Date(booking.return_date), 'MMM d, yyyy')} />
            <Field label="Return Time" value={booking.return_time} />
          </div>
          <div className="flex items-start gap-2 text-sm text-stone-600">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {booking.pickup_location}
          </div>
          {booking.delivery_requested && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              Delivery requested: {booking.delivery_address}
            </p>
          )}
        </Section>

        {/* Pricing */}
        <Section title="Pricing">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>${booking.daily_rate}/day × {booking.rental_days}d</span>
              <span>${booking.subtotal}</span>
            </div>
            {booking.delivery_fee > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Delivery fee</span>
                <span>${booking.delivery_fee}</span>
              </div>
            )}
            {booking.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-${booking.discount_amount}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>Tax</span>
              <span>${booking.tax_amount}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900 pt-1.5 border-t border-stone-100">
              <span>Total</span>
              <span>${booking.total_cost}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Deposit</span>
              <span>${booking.deposit_amount} ({booking.deposit_status})</span>
            </div>
          </div>
        </Section>

        {/* Insurance */}
        <Section title="Insurance">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider" value={booking.insurance_provider} />
            <div>
              <p className="text-xs text-stone-400">Status</p>
              <select
                className="input text-sm mt-0.5"
                defaultValue={booking.insurance_status || 'pending'}
                onChange={async e => {
                  await api.updateInsuranceStatus(id, e.target.value);
                  await load();
                }}
              >
                {['pending', 'active', 'declined', 'not_required', 'external'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-stone-400">Policy ID</p>
              <input
                className="input text-sm mt-0.5"
                defaultValue={booking.bonzah_policy_id || ''}
                placeholder="Policy number (if applicable)"
                onBlur={async e => {
                  if (e.target.value !== (booking.bonzah_policy_id || '')) {
                    await api.updateInsuranceStatus(id, booking.insurance_status, e.target.value);
                    await load();
                  }
                }}
              />
            </div>
          </div>
        </Section>

        {/* Payments */}
        <Section title="Payments">
          {booking.payments?.length > 0 ? (
            <div className="space-y-2">
              {booking.payments.map(p => (
                <div key={p.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium text-stone-800 capitalize">{p.payment_type} ({p.method})</p>
                    <p className="text-xs text-stone-400">{p.reference_id}</p>
                  </div>
                  <span className={`font-medium ${p.payment_type === 'refund' ? 'text-red-600' : 'text-green-600'}`}>
                    ${p.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">No payments recorded</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setPaymentForm(p => ({ ...p, payment_type: 'rental' })); setModal('payment'); }}
              className="btn-secondary flex-1 justify-center"
            >
              <DollarSign size={14} /> Record Payment
            </button>
            <button
              onClick={() => { setPaymentForm(p => ({ ...p, payment_type: 'refund', amount: '' })); setModal('payment'); }}
              className="btn-ghost flex-1 justify-center text-red-500 hover:bg-red-50"
            >
              Issue Refund
            </button>
          </div>
        </Section>

        {/* Vehicle Condition */}
        {(booking.pickup_mileage || booking.return_mileage) && (
          <Section title="Vehicle Condition">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Mileage" value={booking.pickup_mileage} />
              <Field label="Pickup Fuel" value={booking.pickup_fuel_level} />
              <Field label="Return Mileage" value={booking.return_mileage} />
              <Field label="Return Fuel" value={booking.return_fuel_level} />
            </div>
            {booking.pickup_condition_notes && <Field label="Pickup Notes" value={booking.pickup_condition_notes} />}
            {booking.return_condition_notes && <Field label="Return Notes" value={booking.return_condition_notes} />}
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes">
          {booking.special_requests && (
            <div>
              <p className="text-xs text-stone-400 mb-1">Customer requests</p>
              <p className="text-sm text-stone-700">{booking.special_requests}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-stone-400 mb-1">Internal notes (private)</p>
            <textarea
              className="input resize-none text-xs"
              rows={3}
              defaultValue={booking.internal_notes || ''}
              placeholder="Add private notes here…"
              onBlur={async e => {
                if (e.target.value !== booking.internal_notes) {
                  await api.updateBooking(id, { internal_notes: e.target.value });
                }
              }}
            />
          </div>
        </Section>
      </div>

      {/* Rental Agreement */}
      <AgreementSection bookingId={id} />

      {/* Timeline */}
      <Section title="Status Timeline">
        <div className="space-y-3">
          {(booking.booking_status_log || []).map(log => (
            <div key={log.id} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {log.from_status && <StatusBadge status={log.from_status} />}
                  {log.from_status && <span className="text-stone-300 text-xs">→</span>}
                  <StatusBadge status={log.to_status} />
                  <span className="text-xs text-stone-400">by {log.changed_by}</span>
                </div>
                {log.reason && <p className="text-xs text-stone-500 mt-0.5">{log.reason}</p>}
              </div>
              <p className="text-xs text-stone-400 whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Action modals */}
      <Modal open={modal === 'decline'} onClose={() => setModal(null)} title="Decline Booking">
        <div className="space-y-4">
          <div>
            <label className="label">Reason (sent to customer)</label>
            <textarea className="input resize-none" rows={3} value={modalInput} onChange={e => setModalInput(e.target.value)} placeholder="Vehicle unavailable…" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => doAction('decline')} disabled={actioning} className="btn-danger flex-1 justify-center">
              {actioning ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel Booking">
        <div className="space-y-4">
          <div>
            <label className="label">Reason</label>
            <textarea className="input resize-none" rows={3} value={modalInput} onChange={e => setModalInput(e.target.value)} placeholder="Customer requested cancellation…" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Back</button>
            <button onClick={() => doAction('cancel')} disabled={actioning} className="btn-danger flex-1 justify-center">
              {actioning ? 'Cancelling…' : 'Cancel Booking'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'pickup'} onClose={() => setModal(null)} title="Record Pickup">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mileage Out</label>
              <input className="input" type="number" value={modalInput} onChange={e => setModalInput(e.target.value)} placeholder="15000" />
            </div>
            <div>
              <label className="label">Fuel Level</label>
              <select className="input" value={conditionForm.fuel} onChange={e => setConditionForm(f => ({ ...f, fuel: e.target.value }))}>
                {['full', '3/4', '1/2', '1/4', 'empty'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Condition Notes</label>
            <textarea className="input resize-none text-sm" rows={2} placeholder="Any pre-existing damage, notes…" value={conditionForm.notes} onChange={e => setConditionForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <label className="label">Photo URL (optional)</label>
            <input className="input text-sm" type="url" placeholder="https://…" value={conditionForm.photoUrl} onChange={e => setConditionForm(f => ({ ...f, photoUrl: e.target.value }))} />
            <p className="text-[10px] text-stone-400 mt-0.5">Paste a link to a photo of the vehicle condition at pickup</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => doAction('pickup')} disabled={actioning} className="btn-primary flex-1 justify-center">
              {actioning ? 'Saving…' : 'Record Pickup'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Record Return">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mileage In</label>
              <input className="input" type="number" value={modalInput} onChange={e => setModalInput(e.target.value)} placeholder="15450" />
            </div>
            <div>
              <label className="label">Fuel Level</label>
              <select className="input" value={conditionForm.fuel} onChange={e => setConditionForm(f => ({ ...f, fuel: e.target.value }))}>
                {['full', '3/4', '1/2', '1/4', 'empty'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Condition Notes</label>
            <textarea className="input resize-none text-sm" rows={2} placeholder="Any damage, notes on return condition…" value={conditionForm.notes} onChange={e => setConditionForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <label className="label">Photo URL (optional)</label>
            <input className="input text-sm" type="url" placeholder="https://…" value={conditionForm.photoUrl} onChange={e => setConditionForm(f => ({ ...f, photoUrl: e.target.value }))} />
            <p className="text-[10px] text-stone-400 mt-0.5">Paste a link to a photo of the vehicle condition at return</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => doAction('return')} disabled={actioning} className="btn-primary flex-1 justify-center">
              {actioning ? 'Saving…' : 'Record Return'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'damage'} onClose={() => setModal(null)} title="File Damage Report">
        <div className="space-y-4">
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none text-sm" rows={3} placeholder="Describe the damage…" value={damageForm.description} onChange={e => setDamageForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Severity</label>
              <select className="input" value={damageForm.severity} onChange={e => setDamageForm(f => ({ ...f, severity: e.target.value }))}>
                {['minor', 'moderate', 'major', 'totaled'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estimated Cost ($)</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={damageForm.estimated_cost} onChange={e => setDamageForm(f => ({ ...f, estimated_cost: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Photo URL (optional)</label>
            <input className="input text-sm" type="url" placeholder="https://…" value={damageForm.photo_url} onChange={e => setDamageForm(f => ({ ...f, photo_url: e.target.value }))} />
            <p className="text-[10px] text-stone-400 mt-0.5">Paste a link to a photo of the damage</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => doAction('damage')} disabled={actioning || !damageForm.description} className="btn-danger flex-1 justify-center disabled:opacity-50">
              {actioning ? 'Saving…' : 'File Report'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Record Payment">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={paymentForm.payment_type} onChange={e => setPaymentForm(p => ({ ...p, payment_type: e.target.value }))}>
                {['rental', 'deposit', 'damage', 'overage', 'refund'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input" type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}>
                {['cash', 'card', 'zelle', 'venmo', 'paypal'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reference ID</label>
              <input className="input" value={paymentForm.reference_id} onChange={e => setPaymentForm(p => ({ ...p, reference_id: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => doAction('payment')} disabled={actioning} className="btn-primary flex-1 justify-center">
              {actioning ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
