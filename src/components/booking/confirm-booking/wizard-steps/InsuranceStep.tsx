import React, { useState, useEffect, useMemo } from 'react';
import { Shield, ShieldCheck, Check, ChevronDown, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
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
  // Per-tier maps so all three quotes can load in parallel and each card shows its own state.
  const [tierQuotes, setTierQuotes] = useState<Record<string, BonzahQuote>>({});
  const [tierLoading, setTierLoading] = useState<Record<string, boolean>>({});
  const [tierErrors, setTierErrors] = useState<Record<string, string>>({});

  // ── Eligibility checks ──────────────────────────────────────────────
  const driverAge = ageFrom(draft.dob);
  const ageOk = driverAge !== null && driverAge >= 21;
  const stateName = normalizeState(pickupState);
  const stateBlocked = !!config && config.excluded_states.includes(stateName);

  // Bonzah available when enabled and driver qualifies
  const bonzahAvailable = !!config?.enabled && ageOk && !stateBlocked;

  // Hide Complete tier in PAI-restricted states
  const visibleTiers = useMemo<BonzahTier[]>(() => {
    if (!config) return [];
    return config.tiers.filter((t: BonzahTier) => {
      if (t.coverages.includes('pai') && config.pai_excluded_states.includes(stateName)) return false;
      return true;
    });
  }, [config, stateName]);

  // The essential tier (always the minimum required)
  const essentialTier = useMemo(() => visibleTiers.find(t => t.id === 'essential'), [visibleTiers]);

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

  // ── Fetch one tier's quote and store in maps. Returns the quote (or null on error). ─
  async function fetchQuote(tierId: string): Promise<BonzahQuote | null> {
    setTierLoading(prev => ({ ...prev, [tierId]: true }));
    setTierErrors(prev => { const next = { ...prev }; delete next[tierId]; return next; });
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
      setTierQuotes(prev => ({ ...prev, [tierId]: quote }));
      return quote;
    } catch (e: any) {
      setTierErrors(prev => ({ ...prev, [tierId]: e.message || 'Unavailable' }));
      return null;
    } finally {
      setTierLoading(prev => ({ ...prev, [tierId]: false }));
    }
  }

  // ── Fetch ALL visible tiers in parallel as soon as config arrives ───
  useEffect(() => {
    if (!config || !bonzahAvailable || visibleTiers.length === 0) return;
    let cancelled = false;
    Promise.all(visibleTiers.map(t => fetchQuote(t.id))).then(quotes => {
      if (cancelled) return;
      // Auto-select Essential (the mandatory minimum) if user hasn't picked yet or picked 'own'
      if (!draft.insuranceChoice || draft.insuranceChoice === 'own') {
        const essIdx = visibleTiers.findIndex(t => t.id === 'essential');
        const idx = essIdx >= 0 ? essIdx : 0;
        const def = visibleTiers[idx];
        const defQuote = quotes[idx];
        if (def && defQuote) {
          onUpdate({ insuranceChoice: 'bonzah', bonzahTierId: def.id, bonzahQuote: defQuote });
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, bonzahAvailable]);

  // Selecting a tier just reads from the cache — no refetch. Quotes pre-populated on mount.
  const handleSelectTier = (tierId: string) => {
    const quote = tierQuotes[tierId];
    if (!quote) return; // still loading or errored — card is disabled in render
    onUpdate({ insuranceChoice: 'bonzah', bonzahTierId: tierId, bonzahQuote: quote });
    setError('');
  };

  const handleContinue = () => {
    if (!draft.insuranceChoice || draft.insuranceChoice !== 'bonzah') {
      setError('CDW Essential Coverage is required to rent a vehicle. Please select a coverage tier.');
      return;
    }
    if (!draft.bonzahTierId || !draft.bonzahQuote) {
      setError('Insurance pricing is still loading — please wait a moment and try again');
      return;
    }
    onContinue();
  };

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
          CDW Essential Coverage is <strong style={{ color: 'var(--text-primary)' }}>required</strong> for all rentals.
          You may upgrade to Standard or Complete for additional protection.
        </p>
      </div>

      {/* Required coverage notice */}
      <div className="rounded-xl border p-3 flex items-start gap-2.5"
        style={{ backgroundColor: 'rgba(200,169,126,0.08)', borderColor: 'rgba(200,169,126,0.25)' }}>
        <ShieldAlert size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <strong>CDW Essential Coverage is mandatory.</strong> This ensures every rental has minimum collision damage waiver protection.
          Choose your coverage tier below — Essential is pre-selected and included in your total.
        </p>
      </div>

      {/* Eligibility/exclusion notices */}
      {!configError && config && !ageOk && driverAge !== null && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah insurance requires drivers 21 or older. Please contact us at (772) 985-6667 to arrange your rental.
        </div>
      )}
      {!configError && config && stateBlocked && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah insurance is not available for rentals picked up in {stateName}. Please contact us at (772) 985-6667 to arrange your rental.
        </div>
      )}
      {configError && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {configError} — Please contact us at (772) 985-6667 to arrange your rental.
        </div>
      )}

      {/* Aggregate-failure banner — shows when every visible tier failed to load. */}
      {bonzahAvailable
        && visibleTiers.length > 0
        && visibleTiers.every(t => tierErrors[t.id])
        && !visibleTiers.some(t => tierLoading[t.id]) && (
        <div className="rounded-xl border p-3 text-xs flex items-start gap-2"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold">Insurance pricing is unavailable for this booking.</p>
            <p className="opacity-90 mt-0.5 break-words">
              {tierErrors[visibleTiers[0].id]}
            </p>
            <p className="opacity-75 mt-1">Please contact us at (772) 985-6667 to complete your booking.</p>
          </div>
        </div>
      )}

      {/* Bonzah coverage tiers */}
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
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Select Your Coverage</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Essential is required · upgrade for more protection
                  </p>
                </div>
              </div>
              <img src={bonzahLogo} alt="Bonzah" className="h-6 opacity-80" />
            </div>

            <div className="space-y-2.5">
              {visibleTiers.map((tier: BonzahTier) => {
                const isSelected = draft.insuranceChoice === 'bonzah' && draft.bonzahTierId === tier.id;
                const isLoading = !!tierLoading[tier.id];
                const tierError = tierErrors[tier.id];
                const cardQuote = tierQuotes[tier.id];
                const totalDollars = cardQuote ? cardQuote.total_cents / 100 : null;
                const perDay = totalDollars != null && rentalDays > 0 ? totalDollars / rentalDays : null;
                const isDisabled = isLoading || !!tierError || !cardQuote;
                const isEssential = tier.id === 'essential';

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleSelectTier(tier.id)}
                    disabled={isDisabled}
                    className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                      isDisabled ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-sm cursor-pointer'
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
                        {isEssential && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                            Required
                          </span>
                        )}
                        {tier.recommended && !isEssential && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {isLoading ? (
                          <Loader2 className="animate-spin" size={16} style={{ color: 'var(--accent-color)' }} />
                        ) : tierError ? (
                          <p
                            className="text-[10px] max-w-[140px] leading-tight"
                            style={{ color: '#ef4444' }}
                            title={tierError}
                          >
                            Unavailable
                          </p>
                        ) : perDay != null ? (
                          <>
                            <p className="font-bold text-base leading-tight" style={{ color: 'var(--accent-color)' }}>
                              {formatCurrency(perDay)}
                              <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-tertiary)' }}>/day</span>
                            </p>
                            <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {formatCurrency(totalDollars!)} for {rentalDays} day{rentalDays === 1 ? '' : 's'}
                            </p>
                          </>
                        ) : null}
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
