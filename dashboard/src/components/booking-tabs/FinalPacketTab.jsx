import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Camera, CreditCard, Download, FileText, Fuel, Gauge, Loader2, Receipt } from 'lucide-react';
import { api } from '../../api/client';

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const label = (value) => String(value || '—').replace(/_/g, ' ');

function Stat({ label: statLabel, value }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{statLabel}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value ?? '—'}</p>
    </div>
  );
}

function PhotoPanel({ title, photos, odometer, fuel, onView }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Camera size={16} className="text-[var(--accent-color)]" />
          {title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)]">{photos.length} photos</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Odometer" value={odometer ? `${odometer.toLocaleString()} mi` : '—'} />
        <Stat label="Fuel" value={label(fuel)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.slice(0, 8).map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            type="button"
            onClick={() => onView?.(photo.url)}
            className="aspect-[4/3] overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            title={label(photo.slot || photo.record_type)}
          >
            <img src={photo.url} alt={label(photo.slot || photo.record_type)} className="h-full w-full object-cover" />
          </button>
        ))}
        {!photos.length && (
          <div className="col-span-full rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-8 text-center text-sm text-[var(--text-tertiary)]">
            No photos recorded
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label: rowLabel, value, tone }) {
  const toneClass = tone === 'danger' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : 'text-[var(--text-primary)]';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2 text-sm last:border-0">
      <span className="text-[var(--text-secondary)]">{rowLabel}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function MoneyRows({ title, rows, empty }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Receipt size={16} className="text-[var(--accent-color)]" />
        {title}
      </h3>
      {rows.length ? rows.map((row, index) => (
        <div key={row.id || index} className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] py-2 text-sm last:border-0">
          <div>
            <p className="font-medium text-[var(--text-primary)]">{row.title}</p>
            {row.detail && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{row.detail}</p>}
          </div>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">{row.amount}</span>
        </div>
      )) : (
        <p className="text-sm text-[var(--text-tertiary)]">{empty}</p>
      )}
    </div>
  );
}

export default function FinalPacketTab({ booking, onView }) {
  const [packet, setPacket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getFinalRentalPacket(booking.id)
      .then((data) => { if (alive) setPacket(data); })
      .catch((err) => { if (alive) setError(err.message || 'Failed to load final packet'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [booking.id]);

  const settlementRows = useMemo(() => {
    const settlement = packet?.settlement || {};
    const totals = settlement.totals || {};
    return [
      ['Security deposit', money(settlement.deposit?.amount_cents)],
      ['Deposit applied', money(settlement.deposit?.applied_amount_cents)],
      ['Deposit refunded', money(settlement.deposit?.refund_amount_cents)],
      ['Tolls', money(totals.toll_total_cents)],
      ['Incidentals', money(totals.incidental_total_cents)],
      ['Balance due', money(totals.balance_due_cents), totals.balance_due_cents > 0 ? 'danger' : undefined],
      ['Refund due', money(totals.refund_due_cents), totals.refund_due_cents > 0 ? 'good' : undefined],
    ];
  }, [packet]);

  const chargeRows = (packet?.settlement?.incidentals || []).map((row) => ({
    id: row.id,
    title: label(row.type),
    detail: row.description,
    amount: money(row.amount_cents),
  }));

  const paymentRows = [
    ...(packet?.settlement?.payments?.completed || []).map((row) => ({
      id: row.id,
      title: `${label(row.method)} payment`,
      detail: row.reference_id,
      amount: money(row.amount_cents),
    })),
    ...(packet?.settlement?.payments?.declines || []).map((row) => ({
      id: row.id,
      title: `${label(row.method)} decline`,
      detail: row.failure_message || row.failure_code || row.reference_id,
      amount: money(Math.abs(row.amount_cents)),
    })),
    ...(packet?.settlement?.payments?.refunds || []).map((row) => ({
      id: row.id,
      title: `${label(row.method)} refund`,
      detail: row.reference_id,
      amount: money(Math.abs(row.amount_cents)),
    })),
  ];

  async function downloadPdf() {
    setDownloading(true);
    setError('');
    try {
      const blob = await api.downloadFinalRentalPacketPdf(booking.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Final_Rental_Packet_${booking.booking_code || booking.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'PDF download failed');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-12">
        <Loader2 size={18} className="mr-2 animate-spin text-[var(--accent-color)]" />
        <span className="text-sm text-[var(--text-secondary)]">Loading final packet...</span>
      </div>
    );
  }

  if (!packet) {
    return (
      <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
        {error || 'Final packet unavailable'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
            <FileText size={18} className="text-[var(--accent-color)]" />
            Final Rental Packet
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Evidence, settlement, payments, declines, refunds, and return condition for this rental.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading || !packet.available}
          className="btn btn-primary inline-flex items-center justify-center gap-2"
        >
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Download PDF
        </button>
      </div>

      {!packet.available && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Final packet PDF becomes available after customer return or completion.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PhotoPanel title="Pickup Photos" photos={packet.pickup?.photos || []} odometer={packet.pickup?.odometer} fuel={packet.pickup?.fuel_level} onView={onView} />
        <PhotoPanel title="Return Photos" photos={packet.return?.photos || []} odometer={packet.return?.odometer} fuel={packet.return?.fuel_level} onView={onView} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <CreditCard size={16} className="text-[var(--accent-color)]" />
            Settlement
          </h3>
          {settlementRows.map(([name, value, tone]) => <Row key={name} label={name} value={value} tone={tone} />)}
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Gauge size={16} className="text-[var(--accent-color)]" />
            Mileage
          </h3>
          <Row label="Pickup" value={packet.settlement?.mileage?.pickup_odometer ? `${packet.settlement.mileage.pickup_odometer.toLocaleString()} mi` : '—'} />
          <Row label="Return" value={packet.settlement?.mileage?.return_odometer ? `${packet.settlement.mileage.return_odometer.toLocaleString()} mi` : '—'} />
          <Row label="Driven" value={packet.settlement?.mileage?.miles_driven != null ? `${packet.settlement.mileage.miles_driven.toLocaleString()} mi` : '—'} />
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Fuel size={16} className="text-[var(--accent-color)]" />
            Fuel
          </h3>
          <Row label="Pickup fuel" value={label(packet.settlement?.fuel?.pickup_fuel_level)} />
          <Row label="Return fuel" value={label(packet.settlement?.fuel?.return_fuel_level)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoneyRows title="Charges" rows={chargeRows} empty="No post-return charges recorded." />
        <MoneyRows title="Payments, Declines, Refunds" rows={paymentRows} empty="No payment events recorded." />
      </div>
    </div>
  );
}
