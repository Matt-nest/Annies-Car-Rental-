import { useCallback, useEffect, useState } from 'react';
import { FileText, ReceiptText, Download, Loader2, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { bookingApi } from '../../api/bookingApi';

/**
 * DocumentsFolder — lists archived contracts + invoices and downloads them via a
 * short-lived signed URL. Shared by the per-customer folder (CustomerDetailPage)
 * and the per-booking folder (BookingDetailPage). Pass `customerId` OR `bookingId`.
 * `showBookingCode` adds the booking column (useful on the customer-wide view).
 */
export default function DocumentsFolder({ customerId, bookingId, showBookingCode = false, refreshKey = 0 }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = customerId
        ? await bookingApi.getCustomerDocuments(customerId)
        : await bookingApi.getBookingDocuments(bookingId);
      setDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load documents');
      setDocs([]);
    }
  }, [customerId, bookingId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function download(doc) {
    setBusyId(doc.id);
    try {
      const { url } = await bookingApi.downloadDocument(doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message || 'Could not open document');
    } finally {
      setBusyId(null);
    }
  }

  if (docs === null) {
    return <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-4"><Loader2 size={14} className="animate-spin" /> Loading documents…</div>;
  }

  if (error && !docs.length) {
    return <p className="text-sm text-[#ef4444]">{error}</p>;
  }

  if (!docs.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-3">
        <FolderOpen size={15} />
        <span>No documents yet. Generated contracts and invoices are filed here automatically.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map(d => {
        const isContract = d.type === 'contract';
        const Icon = isContract ? FileText : ReceiptText;
        return (
          <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: isContract ? 'var(--accent-color)' : '#22c55e' }}>
              <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {isContract ? 'Rental Contract' : 'Invoice'}
                {showBookingCode && d.booking_code && <span className="font-mono text-xs text-[var(--text-tertiary)] ml-2">{d.booking_code}</span>}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {d.created_at ? format(new Date(d.created_at), 'MMM d, yyyy · h:mm a') : ''}
                {d.generated_by ? ` · ${d.generated_by}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => download(d)} disabled={busyId === d.id}
              className="btn-ghost px-3 py-1.5 shrink-0" style={{ border: '1px solid var(--border-subtle)' }}>
              {busyId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
          </div>
        );
      })}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
