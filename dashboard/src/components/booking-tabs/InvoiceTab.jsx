import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import { FileText, Send, DollarSign, CheckCircle, AlertCircle, Eye, RefreshCw, Mail, ArrowRight, Printer } from 'lucide-react';

export default function InvoiceTab({ booking, onReload }) {
  const [invoice, setInvoice] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, [booking.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [inv, dep] = await Promise.all([
        api.getInvoice(booking.id).catch(() => null),
        api.getBookingDeposit(booking.id).catch(() => null),
      ]);
      setInvoice(inv);
      setDeposit(dep);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const inv = await api.generateInvoice(booking.id);
      setInvoice(inv);
      setShowPreview(true);
    } catch (e) { console.error(e); alert(e.message); }
    setGenerating(false);
  }

  async function handleSendInvoice() {
    if (!invoice || !confirm('Send this invoice to the customer?')) return;
    setSending(true);
    try {
      await api.sendInvoice(invoice.id);
      await loadData();
    } catch (e) { console.error(e); alert(e.message); }
    setSending(false);
  }

  async function handleReleaseDeposit() {
    if (!confirm('Refund the full deposit back to the customer?')) return;
    setReleasing(true);
    try {
      await api.releaseDeposit(booking.id);
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setReleasing(false);
  }

  async function handleSettleDeposit() {
    if (!confirm('Settle the deposit against incidentals?')) return;
    setSettling(true);
    try {
      const incidentals = await api.getIncidentals(booking.id).catch(() => []);
      const activeTotal = incidentals.filter(i => !i.waived).reduce((sum, i) => sum + i.amount, 0);
      await api.settleDeposit(booking.id, { incidentalTotal: activeTotal });
      await loadData();
      onReload?.();
    } catch (e) { console.error(e); alert(e.message); }
    setSettling(false);
  }

  const statusColors = {
    draft: 'text-[var(--text-tertiary)]',
    sent: 'text-[#63b3ed]',
    paid: 'text-emerald-500',
    disputed: 'text-amber-500',
  };

  const statusBg = {
    draft: 'bg-[var(--bg-elevated)]',
    sent: 'bg-blue-500/10',
    paid: 'bg-emerald-500/10',
    disputed: 'bg-amber-500/10',
  };

  const customerName = booking.customers 
    ? `${booking.customers.first_name} ${booking.customers.last_name}`
    : 'Customer';
  const customerEmail = booking.customers?.email || '';
  const vehicleName = booking.vehicles 
    ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`
    : 'Vehicle';

  return (
    <div className="space-y-5">
      {/* ── Deposit Status ─────────────────────────────────────────────── */}
      <Section title="Security Deposit">
        {deposit && deposit.status !== 'none' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                  ${(deposit.amount / 100).toFixed(2)}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] capitalize mt-0.5">
                  Status: <span className={`font-semibold ${
                    deposit.status === 'held' ? 'text-emerald-500' :
                    deposit.status === 'refunded' ? 'text-[#63b3ed]' :
                    deposit.status === 'applied' ? 'text-amber-500' :
                    'text-[var(--text-secondary)]'
                  }`}>{deposit.status}</span>
                </p>
              </div>
              {deposit.status === 'held' && (
                <div className="flex gap-2">
                  <button onClick={handleReleaseDeposit} disabled={releasing} className="btn-secondary text-xs">
                    {releasing ? 'Releasing…' : 'Full Refund'}
                  </button>
                  <button onClick={handleSettleDeposit} disabled={settling} className="btn-primary text-xs">
                    {settling ? 'Settling…' : 'Settle Against Charges'}
                  </button>
                </div>
              )}
            </div>
            {deposit.refund_amount > 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                Refunded: <span className="font-semibold text-emerald-500">${(deposit.refund_amount / 100).toFixed(2)}</span>
                {deposit.applied_amount > 0 && (
                  <> · Applied: <span className="font-semibold text-amber-500">${(deposit.applied_amount / 100).toFixed(2)}</span></>
                )}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No deposit charge on file</p>
        )}
      </Section>

      {/* ── Invoice ────────────────────────────────────────────────────── */}
      <Section title="Invoice">
        {invoice ? (
          <div className="space-y-4">
            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize px-2.5 py-1 rounded-full ${statusBg[invoice.status] || ''} ${statusColors[invoice.status] || ''}`}>
                  {invoice.status === 'sent' && <Mail size={11} />}
                  {invoice.status === 'paid' && <CheckCircle size={11} />}
                  {invoice.status}
                </span>
                {invoice.sent_at && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    Sent {new Date(invoice.sent_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="btn-ghost text-xs"
                >
                  <Eye size={13} />
                  {showPreview ? 'Hide Preview' : 'Preview'}
                </button>
                <button onClick={handleGenerate} disabled={generating} className="btn-ghost text-xs">
                  <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                  Regenerate
                </button>
              </div>
            </div>

            {/* Line items table */}
            <div className="space-y-1.5">
              {(invoice.items || []).map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                  <div>
                    <p className="text-[var(--text-primary)]">{item.description}</p>
                    <p className="text-xs text-[var(--text-tertiary)] capitalize">{item.type}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${
                    item.type === 'incidental' ? 'text-[var(--danger-color)]' : 'text-[var(--text-primary)]'
                  }`}>
                    ${(item.amount / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between text-sm text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span className="tabular-nums">${(invoice.subtotal / 100).toFixed(2)}</span>
              </div>
              {invoice.deposit_applied > 0 && (
                <div className="flex justify-between text-sm text-emerald-500">
                  <span>Deposit Applied</span>
                  <span className="tabular-nums">-${(invoice.deposit_applied / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[var(--text-primary)] pt-2 border-t border-[var(--border-subtle)]">
                <span>{invoice.amount_due > 0 ? 'Amount Due' : 'Refund Due'}</span>
                <span className={`tabular-nums ${invoice.amount_due > 0 ? 'text-[var(--danger-color)]' : 'text-emerald-500'}`}>
                  ${(Math.abs(invoice.amount_due) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* ── Email Preview ──────────────────────────────────────────── */}
            {showPreview && (
              <div className="mt-4 border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Email Preview</span>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">To: {customerEmail}</span>
                </div>
                <div className="p-5 bg-white dark:bg-[#1a1a2e]" style={{ fontFamily: 'Georgia, serif' }}>
                  {/* Email content */}
                  <div className="max-w-md mx-auto">
                    <div className="text-center mb-6">
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">Annie's Car Rental</h2>
                      <p className="text-xs text-[var(--text-tertiary)]">Rental Invoice</p>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Hi {customerName.split(' ')[0]},
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Here's your final invoice for booking <strong>{booking.booking_code}</strong>:
                    </p>

                    <div className="bg-[var(--bg-elevated)] rounded-lg p-4 mb-4 border border-[var(--border-subtle)]">
                      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Vehicle</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{vehicleName}</p>
                      <div className="flex gap-6 text-xs text-[var(--text-tertiary)] mt-1">
                        <span>Pickup: {booking.pickup_date}</span>
                        <span>Return: {booking.return_date}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {(invoice.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">{item.description}</span>
                          <span className={`font-semibold tabular-nums ${item.type === 'incidental' ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                            ${(item.amount / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-[var(--border-subtle)] pt-2 space-y-1">
                      {invoice.deposit_applied > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-600">Security Deposit Applied</span>
                          <span className="text-emerald-600 font-semibold">-${(invoice.deposit_applied / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--border-subtle)]">
                        <span>{invoice.amount_due > 0 ? 'Amount Due' : 'Refund Due'}</span>
                        <span className={invoice.amount_due > 0 ? 'text-red-600' : 'text-emerald-600'}>
                          ${(Math.abs(invoice.amount_due) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
                      <p>Annie's Car Rental · 586 NW Mercantile Pl, Port St. Lucie, FL 34986</p>
                      <p>(772) 985-6667 · www.anniescarrental.com</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Send button */}
            {invoice.status === 'draft' && (
              <div className="flex gap-3 pt-2">
                <button onClick={handleSendInvoice} disabled={sending} className="btn-primary flex-1">
                  <Send size={15} />
                  {sending ? 'Sending…' : 'Send Invoice to Customer'}
                </button>
              </div>
            )}

            {invoice.status === 'sent' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle size={18} className="text-blue-500" />
                <div>
                  <p className="text-sm font-semibold text-blue-500">Invoice Sent</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Emailed to {customerEmail} on {new Date(invoice.sent_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText size={36} className="mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-1">No invoice generated yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              Generate an invoice from the booking charges and incidentals to review before sending.
            </p>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary">
              <FileText size={15} />
              {generating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
