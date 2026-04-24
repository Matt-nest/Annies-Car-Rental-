import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Check, ChevronRight } from 'lucide-react';
import { INSURANCE_TIERS, formatCurrency, type WizardDraft, type InsuranceTier } from '../constants';

interface Props {
  draft: WizardDraft;
  rentalDays: number;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

export default function InsuranceStep({ draft, rentalDays, onUpdate, onContinue, onBack, theme }: Props) {
  const [error, setError] = useState('');

  const handleOwnInsurance = () => {
    onUpdate({ insuranceChoice: 'own', anniesTier: null });
    setError('');
  };

  const handleSelectTier = (tierKey: string) => {
    onUpdate({ insuranceChoice: 'annies', anniesTier: tierKey });
    setError('');
  };

  const handleContinue = () => {
    if (!draft.insuranceChoice) {
      setError('Please select an insurance option to continue');
      return;
    }
    onContinue();
  };

  const selectedTier = draft.anniesTier;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <Shield size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Insurance Coverage</h3>
        </div>
        <p className="text-xs leading-relaxed ml-[42px]" style={{ color: 'var(--text-tertiary)' }}>
          Florida law requires auto insurance coverage during your rental period. Choose how you'd like to be covered.
        </p>
      </div>

      {/* Option 1: Own insurance */}
      <button
        type="button"
        onClick={handleOwnInsurance}
        className="w-full rounded-xl border p-4 sm:p-5 text-left transition-all duration-200 cursor-pointer hover:shadow-md"
        style={{
          backgroundColor: draft.insuranceChoice === 'own'
            ? theme === 'dark' ? 'rgba(200,169,126,0.1)' : 'rgba(200,169,126,0.06)'
            : 'var(--bg-card)',
          borderColor: draft.insuranceChoice === 'own' ? 'var(--accent-color)' : 'var(--border-subtle)',
          borderWidth: draft.insuranceChoice === 'own' ? '2px' : '1px',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: draft.insuranceChoice === 'own' ? 'var(--accent-glow)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: draft.insuranceChoice === 'own' ? 'var(--accent-color)' : 'var(--text-tertiary)',
              }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>I have my own insurance</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Your personal auto insurance will cover the rental · No extra charge
              </p>
            </div>
          </div>
          {draft.insuranceChoice === 'own' && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-color)' }}>
              <Check size={14} style={{ color: 'var(--accent-fg)' }} />
            </div>
          )}
        </div>
        {draft.insuranceChoice === 'own' && (
          <p className="text-[11px] mt-3 ml-[52px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Your insurance details from the agreement will be used. Make sure your coverage is active for the full rental period.
          </p>
        )}
      </button>

      {/* Option 2: Annie's insurance */}
      <div className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: draft.insuranceChoice === 'annies' ? 'var(--accent-color)' : 'var(--border-subtle)',
          borderWidth: draft.insuranceChoice === 'annies' ? '2px' : '1px',
        }}>
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: draft.insuranceChoice === 'annies' ? 'var(--accent-glow)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: draft.insuranceChoice === 'annies' ? 'var(--accent-color)' : 'var(--text-tertiary)',
              }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Purchase coverage through Annie's</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Select a protection plan — added to your total at checkout
              </p>
            </div>
          </div>

          {/* Tier cards */}
          <div className="space-y-2.5">
            {INSURANCE_TIERS.map((tier) => {
              const isSelected = draft.insuranceChoice === 'annies' && selectedTier === tier.key;
              const totalCost = tier.dailyRate * rentalDays;

              return (
                <button
                  key={tier.key}
                  type="button"
                  onClick={() => handleSelectTier(tier.key)}
                  className="w-full rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer hover:shadow-sm"
                  style={{
                    backgroundColor: isSelected
                      ? theme === 'dark' ? 'rgba(200,169,126,0.12)' : 'rgba(200,169,126,0.08)'
                      : theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-subtle)',
                    borderWidth: isSelected ? '2px' : '1px',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'var(--accent-color)' }}>
                          <Check size={12} style={{ color: 'var(--accent-fg)' }} />
                        </div>
                      )}
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{tier.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm" style={{ color: 'var(--accent-color)' }}>
                        {formatCurrency(tier.dailyRate)}<span className="text-xs font-normal">/day</span>
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatCurrency(totalCost)} total
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {tier.description}
                  </p>
                  {isSelected && (
                    <ul className="mt-2 space-y-1">
                      {tier.highlights.map((h, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Check size={12} style={{ color: 'var(--accent-color)' }} />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <Shield size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button type="button" onClick={handleContinue}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          Continue to Payment
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}
