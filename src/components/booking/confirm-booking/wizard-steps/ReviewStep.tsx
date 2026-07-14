import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { type WizardDraft } from '../constants';
import OrderSummary from './OrderSummary';

interface Props {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  theme: string;
  onContinue: () => void;
  onBack: () => void;
}

/** Order-summary confirmation screen shown before the Payment step. */
export default function ReviewStep({
  bookingSummary,
  draft,
  depositAmount,
  theme,
  onContinue,
  onBack,
}: Props) {
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
          Please confirm your total looks right before we submit your request for approval.
        </p>
      </div>

      {/* Pricing */}
      <OrderSummary
        bookingSummary={bookingSummary}
        draft={draft}
        depositAmount={depositAmount}
        theme={theme}
      />

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
          Submit for Approval <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
