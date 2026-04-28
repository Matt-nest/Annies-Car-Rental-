import React, { useState, useRef, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { RENTAL_TERMS } from '../../../../data/rentalTerms';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

export default function TermsStep({ draft, onUpdate, onContinue, onBack, theme }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkboxEnabled = expanded && scrolledToEnd;
  const continueEnabled = checkboxEnabled && draft.termsAccepted;

  // After expand, re-evaluate whether the content already fits without scroll
  // (short-content edge case + small viewports). Run on next tick so layout settles.
  useEffect(() => {
    if (!expanded) {
      setScrolledToEnd(false);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      if (el.scrollHeight - el.clientHeight <= 4) setScrolledToEnd(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [expanded]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      setScrolledToEnd(true);
    }
  };

  const handleContinue = () => {
    if (!continueEnabled) {
      if (!expanded) setError('Please open and read the full Terms & Conditions');
      else if (!scrolledToEnd) setError('Please scroll to the end of the Terms & Conditions');
      else if (!draft.termsAccepted) setError('You must accept the Terms & Conditions to continue');
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
              <FileText size={16} />
            </div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Terms & Conditions</h3>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: 'var(--text-secondary)',
            }}
          >
            {expanded ? 'Collapse' : 'Read Full Terms'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {!expanded ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            By checking below, you agree to all 12 sections of the Rental Agreement Terms and Conditions including definitions, indemnity, vehicle condition,
            damage responsibility, prohibited uses, insurance, charges, deposit policy, property disclaimers, breach terms, modifications, and miscellaneous provisions.
            Click "Read Full Terms" to review in detail.
          </p>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="max-h-[400px] overflow-y-auto pr-2 space-y-4 text-xs leading-relaxed scrollbar-thin"
              style={{ color: 'var(--text-secondary)' }}
            >
              <h4 className="text-sm font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                Rental Agreement Terms and Conditions
              </h4>
              {RENTAL_TERMS.map(term => (
                <div key={term.number}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {term.number}. {term.title}
                  </p>
                  <p className="text-[11px] leading-relaxed">{term.text}</p>
                </div>
              ))}
              <div className="pt-2 flex items-center gap-2 text-[11px] font-medium" style={{ color: 'var(--accent-color)' }}>
                <Check size={12} /> End of Terms & Conditions
              </div>
            </div>
            {!scrolledToEnd && (
              <p className="text-[11px] mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>
                Scroll to the bottom to enable acceptance.
              </p>
            )}
          </>
        )}

        {/* Accept checkbox — disabled until expanded + scrolled to end */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <label
            className={`flex items-start gap-3 ${checkboxEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            onClick={() => {
              if (!checkboxEnabled) return;
              onUpdate({ termsAccepted: !draft.termsAccepted });
              setError('');
            }}
          >
            <div
              className="w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200"
              style={{
                backgroundColor: draft.termsAccepted ? 'var(--accent-color)' : 'transparent',
                borderColor: draft.termsAccepted ? 'var(--accent-color)' : error ? 'rgba(239,68,68,0.5)' : 'var(--border-medium)',
              }}
            >
              {draft.termsAccepted && <span className="text-xs" style={{ color: 'var(--accent-fg)' }}>✓</span>}
            </div>
            <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              I have read and agree to the Terms & Conditions of this Rental Agreement.
            </span>
          </label>
          {/* a11y live region — announces when controls become enabled */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {checkboxEnabled
              ? 'You may now accept the Terms & Conditions.'
              : !expanded
                ? 'Open Read Full Terms to begin.'
                : 'Scroll to the bottom to enable acceptance.'}
          </div>
          {error && <p className="text-red-400 text-xs mt-2 ml-0.5">{error}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!continueEnabled}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 enabled:hover:scale-[1.02] enabled:hover:shadow-lg"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          Continue
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}
