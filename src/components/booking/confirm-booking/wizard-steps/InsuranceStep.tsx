import React, { useState, useEffect, useMemo } from 'react';
import { Shield, ShieldCheck, Check, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import {
  API_URL,
  formatCurrency,
  BONZAH_COVERAGE_LABELS,
  BONZAH_DISCLOSURE_TEXT,
  BONZAH_DISCLOSURE_LINKS,
  type WizardDraft,
  type BonzahConfig,
  type BonzahQuote,
  type BonzahTier,
} from '../constants';
import bonzahLogo from '../../../../assets/bonzah-logo.svg';

interface Props {
  draft: WizardDraft;
  rentalDays: number;
  bookingCode: string;
  pickupState?: string;            // 2-letter or full state name from booking
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

// Map 2-letter state codes to full names so we can compare against
// settings.bonzah_excluded_states (which stores full names).
const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',
  RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};
function normalizeState(s?: string): string {
  if (!s) return '';
  return s.length === 2 ? (STATE_NAMES[s.toUpperCase()] || s) : s;
}

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a -= 1;
  return a;
}

export default function InsuranceStep({ draft, rentalDays, bookingCode, pickupState, onUpdate, onContinue, onBack, theme }: Props) {
  const [error, setError] = useState('');
  const [config, setConfig] = useState<BonzahConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [ownExpanded, setOwnExpanded] = useState(draft.insuranceChoice === 'own');
  const [quoteLoadingTier, setQuoteLoadingTier] = useState<string | null>(null);

  // ── Eligibility checks ──────────────────────────────────────────────
  const driverAge = ageFrom(draft.dob);
  const ageOk = driverAge !== null && driverAge >= 21;
  const stateName = normalizeState(pickupState);
  const stateBlocked = !!config && config.excluded_states.includes(stateName);

  // Hide Bonzah entirely when ineligible — force own-insurance path.
  const bonzahAvailable = !!config?.enabled && ageOk && !stateBlocked;

  // Hide Complete tier in PAI-restricted states
  const visibleTiers = useMemo<BonzahTier[]>(() => {
    if (!config) return [];
    return config.tiers.filter((t: BonzahTier) => {
      if (t.coverages.includes('pai') && config.pai_excluded_states.includes(stateName)) return false;
      return true;
    });
  }, [config, stateName]);

  // ── Load public Bonzah config on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/bookings/insurance/config`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || 'Failed to load insurance options');
        setConfig(json);
      } catch (e: any) {
        if (!cancelled) setConfigError(e.message || 'Failed to load insurance options');
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch a fresh quote from Bonzah for the selected tier ───────────
  async function fetchQuote(tierId: string) {
    setQuoteLoadingTier(tierId);
    setError('');
    try {
      const res = await fetch(`${API_URL}/bookings/${bookingCode}/insurance/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: tierId,
          // Stage 1 collects these into the wizard draft but only persists at submit time.
          // Pass them inline so Bonzah can quote before the customer record is updated.
          customer_overrides: {
            date_of_birth: draft.dob,
            address_line1: draft.address.line1,
            zip: draft.address.zip,
            state: draft.address.state,
            driver_license_number: draft.license.number,
            driver_license_state: draft.license.state,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load price');
      const quote: BonzahQuote = json;
      onUpdate({ insuranceChoice: 'bonzah', bonzahTierId: tierId, bonzahQuote: quote });
    } catch (e: any) {
      setError(e.message || 'Could not load Bonzah pricing. Please try again or use your own insurance.');
      onUpdate({ insuranceChoice: null, bonzahTierId: null });
    } finally {
      setQuoteLoadingTier(null);
    }
  }

  // ── Auto-pick the default tier the first time we see config ─────────
  useEffect(() => {
    if (!config || !bonzahAvailable || draft.insuranceChoice) return;
    const def = visibleTiers.find((t: BonzahTier) => t.default) || visibleTiers[0];
    if (def) fetchQuote(def.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, bonzahAvailable]);

  const handleSelectOwn = () => {
    onUpdate({ insuranceChoice: 'own', bonzahTierId: null, bonzahQuote: null });
    setOwnExpanded(true);
    setError('');
  };

  const handleSelectTier = (tierId: string) => {
    if (quoteLoadingTier) return;
    fetchQuote(tierId);
  };

  const updatePersonalInsurance = (patch: Partial<WizardDraft['personalInsurance']>) => {
    onUpdate({ personalInsurance: { ...draft.personalInsurance, ...patch } });
  };

  const handleContinue = () => {
    if (!draft.insuranceChoice) {
      setError('Please select an insurance option to continue');
      return;
    }
    if (draft.insuranceChoice === 'bonzah') {
      if (!draft.bonzahTierId || !draft.bonzahQuote) {
        setError('Insurance pricing is still loading — please wait a moment and try again');
        return;
      }
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

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
  };
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors';
  const labelClass = 'text-[11px] uppercase tracking-wider font-semibold mb-1.5 block';

  // ── Loading / config-error states ───────────────────────────────────
  if (configLoading) {
    return (
      <div className="rounded-xl border p-6 flex items-center justify-center gap-2.5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <Loader2 className="animate-spin" size={18} style={{ color: 'var(--accent-color)' }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading insurance options…</span>
      </div>
    );
  }

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

      {/* Eligibility/exclusion notices */}
      {!configError && config && !ageOk && driverAge !== null && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah insurance requires drivers 21 or older. Please use your own auto insurance below.
        </div>
      )}
      {!configError && config && stateBlocked && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah insurance is not available for rentals picked up in {stateName}. Please use your own auto insurance below.
        </div>
      )}
      {configError && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {configError} — you can still continue with your own insurance.
        </div>
      )}

      {/* Bonzah path — 3 tier cards */}
      {bonzahAvailable && (
        <div className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: draft.insuranceChoice === 'bonzah' ? 'var(--accent-color)' : 'var(--border-subtle)',
            borderWidth: draft.insuranceChoice === 'bonzah' ? '2px' : '1px',
          }}>
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
                  <Shield size={20} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Buy Bonzah Insurance</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Real-time quote · added to your total at checkout
                  </p>
                </div>
              </div>
              <img src={bonzahLogo} alt="Bonzah" className="h-6 opacity-80" />
            </div>

            <div className="space-y-2.5">
              {visibleTiers.map((tier: BonzahTier) => {
                const isSelected = draft.insuranceChoice === 'bonzah' && draft.bonzahTierId === tier.id;
                const isLoading = quoteLoadingTier === tier.id;
                const showPrice = isSelected && !!draft.bonzahQuote && !isLoading;
                const totalDollars = showPrice ? draft.bonzahQuote!.total_cents / 100 : null;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleSelectTier(tier.id)}
                    disabled={!!quoteLoadingTier}
                    className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                      quoteLoadingTier ? 'opacity-70' : 'hover:shadow-sm cursor-pointer'
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? theme === 'dark' ? 'rgba(200,169,126,0.12)' : 'rgba(200,169,126,0.08)'
                        : theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-subtle)',
                      borderWidth: isSelected ? '2px' : '1px',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--accent-color)' }}>
                            <Check size={12} style={{ color: 'var(--accent-fg)' }} />
                          </div>
                        )}
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{tier.label}</p>
                        {tier.recommended && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {isLoading ? (
                          <Loader2 className="animate-spin" size={16} style={{ color: 'var(--accent-color)' }} />
                        ) : showPrice ? (
                          <>
                            <p className="font-bold text-sm" style={{ color: 'var(--accent-color)' }}>
                              {formatCurrency(totalDollars!)}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              {rentalDays} day{rentalDays === 1 ? '' : 's'} total
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Select to see price</p>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-1 mt-2">
                      {tier.coverages.map((c: string) => (
                        <li key={c} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
                          <span>
                            <strong>{BONZAH_COVERAGE_LABELS[c]?.label || c.toUpperCase()}</strong>{' — '}
                            <span style={{ color: 'var(--text-tertiary)' }}>{BONZAH_COVERAGE_LABELS[c]?.summary}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Mandatory Bonzah disclosure */}
            <p className="text-[10px] leading-relaxed mt-4" style={{ color: 'var(--text-tertiary)' }}>
              {BONZAH_DISCLOSURE_TEXT.replace('Terms and Conditions', '').replace('Privacy', '').replace('Covered Vehicles', '')}
              <span className="block mt-1.5">
                <a href={BONZAH_DISCLOSURE_LINKS.terms} target="_blank" rel="noopener noreferrer" className="underline mr-2" style={{ color: 'var(--accent-color)' }}>Terms</a>
                <a href={BONZAH_DISCLOSURE_LINKS.privacy} target="_blank" rel="noopener noreferrer" className="underline mr-2" style={{ color: 'var(--accent-color)' }}>Privacy</a>
                <a href={BONZAH_DISCLOSURE_LINKS.vehicles} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-color)' }}>Covered Vehicles</a>
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Own insurance path */}
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
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
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
