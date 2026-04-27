import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Check, ChevronDown } from 'lucide-react';
import { INSURANCE_TIERS, formatCurrency, type WizardDraft } from '../constants';

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
  const [ownExpanded, setOwnExpanded] = useState(draft.insuranceChoice === 'own');

  const handleSelectOwn = () => {
    onUpdate({ insuranceChoice: 'own', anniesTier: null });
    setOwnExpanded(true);
    setError('');
  };

  const handleSelectTier = (tierKey: string) => {
    onUpdate({ insuranceChoice: 'annies', anniesTier: tierKey });
    setError('');
  };

  const updatePersonalInsurance = (patch: Partial<WizardDraft['personalInsurance']>) => {
    onUpdate({ personalInsurance: { ...draft.personalInsurance, ...patch } });
  };

  const handleContinue = () => {
    if (!draft.insuranceChoice) {
      setError('Please select an insurance option to continue');
      return;
    }
    if (draft.insuranceChoice === 'own') {
      const pi = draft.personalInsurance;
      if (!pi.company.trim() || !pi.policyNumber.trim() || !pi.expiry) {
        setError('Please fill in your insurance company, policy number, and policy expiry');
        return;
      }
    }
    onContinue();
  };

  const selectedTier = draft.anniesTier;
  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
  };
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors';
  const labelClass = 'text-[11px] uppercase tracking-wider font-semibold mb-1.5 block';

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

      {/* Option 1: Annie's insurance — primary, expanded */}
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

      {/* Option 2: Own insurance — collapsed by default, expands on click */}
      <div className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: draft.insuranceChoice === 'own' ? 'var(--accent-color)' : 'var(--border-subtle)',
          borderWidth: draft.insuranceChoice === 'own' ? '2px' : '1px',
        }}>
        <button
          type="button"
          onClick={() => {
            const next = !ownExpanded;
            setOwnExpanded(next);
            if (next) handleSelectOwn();
          }}
          className="w-full p-4 sm:p-5 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
          aria-expanded={ownExpanded}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: draft.insuranceChoice === 'own' ? 'var(--accent-glow)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: draft.insuranceChoice === 'own' ? 'var(--accent-color)' : 'var(--text-tertiary)',
                }}>
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>I have my own insurance</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  Use your personal auto policy · No extra charge
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {draft.insuranceChoice === 'own' && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color)' }}>
                  <Check size={14} style={{ color: 'var(--accent-fg)' }} />
                </div>
              )}
              <ChevronDown
                size={18}
                style={{
                  color: 'var(--text-tertiary)',
                  transform: ownExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms ease',
                }}
              />
            </div>
          </div>
        </button>

        {ownExpanded && (
          <div className="px-4 sm:px-5 pb-5 pt-0 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: 'var(--text-tertiary)' }}>
              Florida requires that your coverage is active for the entire rental period. We'll keep these on file in case of a claim.
            </p>

            <div>
              <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Insurance Company *</label>
              <input
                type="text"
                placeholder="e.g. Geico, State Farm, Progressive"
                className={inputClass}
                style={inputStyle}
                value={draft.personalInsurance.company}
                onChange={e => updatePersonalInsurance({ company: e.target.value })}
                onFocus={() => { if (draft.insuranceChoice !== 'own') handleSelectOwn(); }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Policy Number *</label>
                <input
                  type="text"
                  placeholder="Policy #"
                  className={inputClass}
                  style={inputStyle}
                  value={draft.personalInsurance.policyNumber}
                  onChange={e => updatePersonalInsurance({ policyNumber: e.target.value })}
                  onFocus={() => { if (draft.insuranceChoice !== 'own') handleSelectOwn(); }}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Policy Expires *</label>
                <input
                  type="date"
                  className={inputClass}
                  style={inputStyle}
                  value={draft.personalInsurance.expiry}
                  onChange={e => updatePersonalInsurance({ expiry: e.target.value })}
                  onFocus={() => { if (draft.insuranceChoice !== 'own') handleSelectOwn(); }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Agent Name (optional)</label>
                <input
                  type="text"
                  placeholder="Your agent's name"
                  className={inputClass}
                  style={inputStyle}
                  value={draft.personalInsurance.agentName}
                  onChange={e => updatePersonalInsurance({ agentName: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Agent Phone (optional)</label>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  className={inputClass}
                  style={inputStyle}
                  value={draft.personalInsurance.agentPhone}
                  onChange={e => updatePersonalInsurance({ agentPhone: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
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
