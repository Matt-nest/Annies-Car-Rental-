import React from 'react';
import { User, MapPin, IdCard, Shield, PenLine, Pencil, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate, type WizardDraft } from '../constants';
import OrderSummary from './OrderSummary';

interface Props {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  customerName?: string;
  theme: string;
  onEditDetails: () => void;
  onEditLicense: () => void;
  onEditInsurance: () => void;
  onEditSignature: () => void;
  onContinue: () => void;
  onBack: () => void;
}

/** Read-only confirmation screen shown before the Payment step. */
export default function ReviewStep({
  bookingSummary,
  draft,
  depositAmount,
  customerName,
  theme,
  onEditDetails,
  onEditLicense,
  onEditInsurance,
  onEditSignature,
  onContinue,
  onBack,
}: Props) {
  // Insurance label mirrors OrderSummary's logic
  let insuranceLabel = 'No coverage selected';
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    const tier = draft.bonzahTierId
      ? draft.bonzahTierId.charAt(0).toUpperCase() + draft.bonzahTierId.slice(1)
      : 'Bonzah';
    insuranceLabel = `Bonzah Insurance — ${tier} · ${formatCurrency(draft.bonzahQuote.total_cents / 100)}`;
  } else if (draft.insuranceChoice === 'own') {
    insuranceLabel = 'Your own insurance (no charge)';
  }

  const fullAddress = [
    draft.address.line1,
    [draft.address.city, draft.address.state].filter(Boolean).join(', '),
    draft.address.zip,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-2"
          style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
          <ShieldCheck size={14} />
          <span className="text-xs font-semibold">Review your booking</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Please confirm everything looks right before you pay.
        </p>
      </div>

      {/* Pricing */}
      <OrderSummary
        bookingSummary={bookingSummary}
        draft={draft}
        depositAmount={depositAmount}
        theme={theme}
      />

      {/* Driver & address */}
      <ReviewCard icon={<User size={16} />} title="Driver & Address" onEdit={onEditDetails}>
        {customerName && <Field label="Name" value={customerName} />}
        <Field label="Address" value={fullAddress || '—'} icon={<MapPin size={12} />} />
        <Field label="Date of birth" value={formatDate(draft.dob) || '—'} />
      </ReviewCard>

      {/* License */}
      <ReviewCard icon={<IdCard size={16} />} title="Driver's License" onEdit={onEditLicense}>
        <Field label="Number" value={draft.license.number || '—'} />
        <Field label="State" value={draft.license.state || '—'} />
        <Field label="Expires" value={formatDate(draft.license.expiry) || '—'} />
        {draft.licensePhotoPaths?.length > 0 && (
          <Field label="Photos" value={`${draft.licensePhotoPaths.length} uploaded`} />
        )}
      </ReviewCard>

      {/* Insurance */}
      <ReviewCard icon={<Shield size={16} />} title="Insurance" onEdit={onEditInsurance}>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{insuranceLabel}</p>
      </ReviewCard>

      {/* Signature */}
      <ReviewCard icon={<PenLine size={16} />} title="Signature" onEdit={onEditSignature}>
        {draft.signature.data ? (
          draft.signature.mode === 'draw' ? (
            <div className="rounded-lg p-2 inline-block"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <img src={draft.signature.data} alt="Your signature" style={{ maxHeight: 56 }} />
            </div>
          ) : (
            <p className="text-2xl" style={{ fontFamily: '"Dancing Script", "Brush Script MT", cursive', color: 'var(--text-primary)' }}>
              {draft.signature.data}
            </p>
          )
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Not signed yet</p>
        )}
      </ReviewCard>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onBack}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button type="button" onClick={onContinue}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          Continue to Payment <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ── Small presentational helpers ─────────────────────────── */
function ReviewCard({
  icon, title, onEdit, children,
}: { icon: React.ReactNode; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 sm:p-5"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            {icon}
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <button type="button" onClick={onEdit}
          className="flex items-center gap-1 text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-color)' }}>
          <Pencil size={12} /> Edit
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        {icon}{label}
      </span>
      <span className="text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
