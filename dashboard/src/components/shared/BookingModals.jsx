import Modal from './Modal';

/**
 * Booking action modals: Decline, Cancel, Pickup, Return, Damage, Payment.
 * Extracted from BookingDetailPage to reduce component size.
 */
export default function BookingModals({
  modal, setModal, modalInput, setModalInput,
  conditionForm, setConditionForm, damageForm, setDamageForm,
  paymentForm, setPaymentForm, actioning, doAction,
}) {
  return (
    <>
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
    </>
  );
}
