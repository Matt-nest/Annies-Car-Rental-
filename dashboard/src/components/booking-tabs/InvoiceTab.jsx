import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import { FileText, Send, DollarSign, CheckCircle, AlertCircle, Eye, RefreshCw, Mail, ArrowRight, Printer, Download } from 'lucide-react';

export default function InvoiceTab({ booking, onReload }) {
  const [invoice, setInvoice] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const blob = await api.downloadInvoicePdf(booking.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${booking.booking_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert(e.message); }
    setDownloading(false);
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
                <button onClick={handleDownloadPdf} disabled={downloading} className="btn-primary text-xs">
                  <Download size={13} className={downloading ? 'animate-bounce' : ''} />
                  {downloading ? 'Downloading…' : 'Download Invoice'}
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
            {showPreview && (() => {
              const items = invoice.items || [];
              const amountDue = Math.abs(invoice.amount_due || 0);
              const isRefund = (invoice.amount_due || 0) <= 0;
              const isClean = (invoice.amount_due || 0) === 0 && invoice.deposit_applied > 0;
              const totalLabel = isRefund ? 'Refund Due to You' : 'Balance Due';
              const introText = isRefund
                ? 'Your rental is complete and your vehicle passed inspection. Here\u2019s your deposit settlement:'
                : 'Your rental is complete. During our post-return inspection, we found a few items that were applied against your security deposit:';

              return (
                <div className="mt-4 border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-[var(--text-tertiary)]" />
                      <span className="text-xs text-[var(--text-secondary)]">Email Preview — Actual email sent to customer</span>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">To: {customerEmail}</span>
                  </div>
                  {/* Rendered email preview matching backend template */}
                  <div style={{ background: '#fafaf9', padding: 0 }}>
                    <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e7e5e4', overflow: 'hidden' }}>
                      {/* Gold gradient bar */}
                      <div style={{ height: 4, background: 'linear-gradient(90deg, #c8a97e 0%, #d4af37 50%, #c8a97e 100%)' }} />
                      {/* Dark header */}
                      <div style={{ background: '#1c1917', padding: '28px 32px' }}>
                        <p style={{ margin: '0 0 16px', color: '#c8a97e', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>ANNIE'S CAR RENTAL</p>
                        <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 600 }}>Deposit Settlement</h2>
                      </div>
                      {/* Body */}
                      <div style={{ padding: 32, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#57534e', margin: '0 0 20px' }}>
                          Hi {customerName.split(' ')[0]},<br /><br />
                          {introText}
                        </p>

                        {/* Booking card */}
                        <div style={{ background: '#fafaf9', borderRadius: 12, padding: 16, border: '1px solid #f5f5f4', marginBottom: 20 }}>
                          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: '#a8a29e', margin: '0 0 6px' }}>Booking</p>
                          <p style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', margin: '0 0 6px' }}>{vehicleName} — {booking.booking_code}</p>
                          <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>
                            {booking.pickup_date} &nbsp;→&nbsp; {booking.return_date}
                          </p>
                        </div>

                        {/* Line items */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                          <tbody>
                            {items.map((item, i) => {
                              const isDeposit = item.type === 'deposit';
                              const isIncidental = item.type === 'incidental';
                              const color = isDeposit ? '#10B981' : isIncidental ? '#EF4444' : '#1c1917';
                              return (
                                <tr key={i}>
                                  <td style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f4', fontSize: 14, color: '#57534e' }}>{item.description}</td>
                                  <td style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f4', fontSize: 14, textAlign: 'right', fontWeight: 600, color }}>${(item.amount / 100).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Total */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #e7e5e4' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '12px 0', fontSize: 16, fontWeight: 700, color: '#1c1917' }}>{totalLabel}</td>
                              <td style={{ padding: '12px 0', fontSize: 18, fontWeight: 700, textAlign: 'right', color: isRefund ? '#10B981' : '#EF4444' }}>${(amountDue / 100).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Status message */}
                        {isRefund && amountDue > 0 && (
                          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px 16px', border: '1px solid #bbf7d0', marginTop: 16 }}>
                            <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 600, margin: '0 0 4px' }}>Refund on the Way</p>
                            <p style={{ fontSize: 13, color: '#57534e', margin: 0 }}>Your refund of ${(amountDue / 100).toFixed(2)} will be processed back to your original payment method within 5–10 business days.</p>
                          </div>
                        )}
                        {!isRefund && amountDue > 0 && (
                          <div style={{ background: '#fef2f2', borderRadius: 12, padding: '14px 16px', border: '1px solid #fecaca', marginTop: 16 }}>
                            <p style={{ fontSize: 14, color: '#dc2626', fontWeight: 600, margin: '0 0 4px' }}>Balance Due</p>
                            <p style={{ fontSize: 13, color: '#57534e', margin: 0 }}>Charges exceeded your security deposit. Please contact us to arrange payment of the remaining ${(amountDue / 100).toFixed(2)}.</p>
                          </div>
                        )}
                        {isClean && (
                          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px 16px', border: '1px solid #bbf7d0', marginTop: 16 }}>
                            <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 600, margin: '0 0 4px' }}>All Clear ✓</p>
                            <p style={{ fontSize: 13, color: '#57534e', margin: 0 }}>No charges were applied. Your full deposit of ${(invoice.deposit_applied / 100).toFixed(2)} is being refunded.</p>
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f5f5f4', textAlign: 'center' }}>
                          <p style={{ fontSize: 13, color: '#57534e', margin: '0 0 12px' }}>Questions about your settlement? We're here to help.</p>
                          <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>Annie's Car Rental · 586 NW Mercantile Pl, Port St. Lucie, FL 34986</p>
                          <p style={{ fontSize: 12, color: '#a8a29e', margin: '4px 0 0' }}>(772) 985-6667 · anniescarrental.com</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
            <p className="text-sm text-[var(--text-secondary)] mb-1">No settlement invoice generated yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              Generate a settlement invoice from incidentals, or download a rental invoice PDF.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={handleGenerate} disabled={generating} className="btn-secondary">
                <FileText size={15} />
                {generating ? 'Generating…' : 'Generate Settlement'}
              </button>
              <button onClick={handleDownloadPdf} disabled={downloading} className="btn-primary">
                <Download size={15} />
                {downloading ? 'Downloading…' : 'Download Invoice PDF'}
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
