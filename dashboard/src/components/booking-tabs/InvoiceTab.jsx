import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import { FileText, Send, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

export default function InvoiceTab({ booking, onReload }) {
  const [invoice, setInvoice] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [settling, setSettling] = useState(false);

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
    } catch (e) { console.error(e); alert(e.message); }
    setGenerating(false);
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

  return (
    <div className="space-y-5">
      {/* Deposit Status */}
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

      {/* Invoice */}
      <Section title="Invoice">
        {invoice ? (
          <div className="space-y-4">
            {/* Invoice status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[var(--text-secondary)]" />
                <span className={`text-sm font-semibold capitalize ${statusColors[invoice.status] || ''}`}>
                  {invoice.status}
                </span>
                {invoice.sent_at && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    · Sent {new Date(invoice.sent_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={generating} className="btn-ghost text-xs">
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>

            {/* Line items */}
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
                <span>Amount Due</span>
                <span className="tabular-nums">
                  ${(invoice.amount_due / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText size={32} className="mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-tertiary)] mb-3">No invoice generated yet</p>
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
