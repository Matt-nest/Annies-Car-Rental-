import React, { useState, useEffect, useMemo } from 'react';
import { Shield, ShieldCheck, Check, Loader2, AlertCircle, ShieldAlert, ArrowLeft, UserCheck } from 'lucide-react';
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

type View = 'choice' | 'own' | 'bonzah';

export default function InsuranceStep({ draft, rentalDays, bookingCode, pickupState, onUpdate, onContinue, onBack, theme }: Props) {
  // Sub-view inside the insurance step. Initialized once from the draft so a
  // refresh keeps the customer where they left off; never auto-changes after mount.
  const [view, setView] = useState<View>(
    draft.insuranceChoice === 'own' ? 'own'
    : draft.insuranceChoice === 'bonzah' ? 'bonzah'
    : 'choice'
  );

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Bonzah state — only fetched when the customer enters the Bonzah branch.
  const [config, setConfig] = useState<BonzahConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [tierQuotes, setTierQuotes] = useState<Record<string, BonzahQuote>>({});
  const [tierLoading, setTierLoading] = useState<Record<string, boolean>>({});
  const [tierErrors, setTierErrors] = useState<Record<string, string>>({});

  // ── Own insurance form helpers ──────────────────────────────────────
  const own = draft.personalInsurance;
  const updateOwn = (patch: Partial<typeof own>) => {
    onUpdate({ personalInsurance: { ...own, ...patch } });
    setFieldErrors(prev => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };
  const inputClass = (field: string) =>
    `w-full px-3.5 min-h-[46px] rounded-xl border text-sm focus:outline-none transition-all placeholder:opacity-40 appearance-none ${fieldErrors[field] ? 'border-red-500/60' : ''}`;
  const borderStyle = (field: string): React.CSSProperties => ({
    borderColor: fieldErrors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  // ── Bonzah eligibility checks ───────────────────────────────────────
  const driverAge = ageFrom(draft.dob);
  const ageOk = driverAge !== null && driverAge >= 21;
  const stateName = normalizeState(pickupState);
  const stateBlocked = !!config && config.excluded_states.includes(stateName);
  const bonzahAvailable = !!config?.enabled && ageOk && !stateBlocked;

  const visibleTiers = useMemo<BonzahTier[]>(() => {
    if (!config) return [];
    return config.tiers.filter((t: BonzahTier) => {
      if (t.coverages.includes('pai') && config.pai_excluded_states.includes(stateName)) return false;
      return true;
    });
  }, [config, stateName]);

  // ── Load Bonzah config only when the customer enters the Bonzah branch ──
  useEffect(() => {
    if (view !== 'bonzah' || config || configLoading) return;
    let cancelled = false;
    setConfigLoading(true);
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
  }, [view, config, configLoading]);

  // ── Fetch one tier's quote ──────────────────────────────────────────
  async function fetchQuote(tierId: string): Promise<BonzahQuote | null> {
    setTierLoading(prev => ({ ...prev, [tierId]: true }));
    setTierErrors(prev => { const next = { ...prev }; delete next[tierId]; return next; });
    try {
      const res = await fetch(`${API_URL}/bookings/${bookingCode}/insurance/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: tierId,
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

  // ── Fetch tier quotes once the Bonzah view is active and config has loaded ──
  useEffect(() => {
    if (view !== 'bonzah' || !config || !bonzahAvailable || visibleTiers.length === 0) return;
    const toFetch = visibleTiers.filter(t => !tierQuotes[t.id] && !tierLoading[t.id] && !tierErrors[t.id]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    Promise.all(toFetch.map(t => fetchQuote(t.id))).then(quotes => {
      if (cancelled) return;
      // Auto-select Essential only if no Bonzah tier is already on the draft
      if (!draft.bonzahTierId) {
        const essIdx = visibleTiers.findIndex(t => t.id === 'essential');
        const idx = essIdx >= 0 ? essIdx : 0;
        const def = visibleTiers[idx];
        const defQuote = def ? (tierQuotes[def.id] || quotes[toFetch.findIndex(t => t.id === def.id)]) : null;
        if (def && defQuote) {
          onUpdate({ insuranceChoice: 'bonzah', bonzahTierId: def.id, bonzahQuote: defQuote });
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, config, bonzahAvailable]);

  // Selecting a tier just reads from the cache — no refetch.
  const handleSelectTier = (tierId: string) => {
    const quote = tierQuotes[tierId];
    if (!quote) return;
    onUpdate({ insuranceChoice: 'bonzah', bonzahTierId: tierId, bonzahQuote: quote });
    setError('');
  };

  // ── Choice screen actions ──────────────────────────────────────────
  const handleChooseOwn = () => {
    onUpdate({
      insuranceChoice: 'own',
      bonzahTierId: null,
      bonzahQuote: null,
    });
    setError('');
    setView('own');
  };

  const handleChooseBonzah = () => {
    setError('');
    setView('bonzah');
  };

  const handleBackToChoice = () => {
    setError('');
    setFieldErrors({});
    setView('choice');
  };

  // ── Continue handler — branch on view ──────────────────────────────
  const handleContinue = () => {
    if (view === 'own') {
      const errs: Record<string, string> = {};
      if (!own.company.trim()) errs.company = 'Required';
      if (!own.policyNumber.trim()) errs.policyNumber = 'Required';
      if (!own.expiry) errs.expiry = 'Required';
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) {
        setError('Please fill in your insurance company, policy number, and expiry date.');
        return;
      }
      // insuranceChoice was already set when they picked "own" on the choice screen
      onContinue();
      return;
    }

    if (view === 'bonzah') {
      if (draft.insuranceChoice !== 'bonzah' || !draft.bonzahTierId || !draft.bonzahQuote) {
        setError('Please select a coverage tier — Essential is the minimum.');
        return;
      }
      onContinue();
      return;
    }
  };

  /* ════════════════════════════════════════════════════════
     View 1 — Choice screen (two side-by-side rectangles)
     ════════════════════════════════════════════════════════ */
  if (view === 'choice') {
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
            How would you like to cover this rental? Choose the option that works best for you.
          </p>
        </div>

        {/* Two equal cards, side-by-side on tablet+ */}
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Own insurance */}
          <button
            type="button"
            onClick={handleChooseOwn}
            className="rounded-xl border p-5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: draft.insuranceChoice === 'own' ? 'var(--accent-color)' : 'var(--border-subtle)',
              borderWidth: draft.insuranceChoice === 'own' ? '2px' : '1px',
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
              <UserCheck size={20} />
            </div>
            <p className="font-semibold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>
              I have my own insurance
            </p>
            <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-tertiary)' }}>
              Use your existing auto policy for this rental. We'll collect your provider details for the rental agreement — no additional charge.
            </p>
            <p className="text-xs mt-3 font-medium flex items-center gap-1" style={{ color: 'var(--accent-color)' }}>
              Continue with my coverage <span aria-hidden>→</span>
            </p>
          </button>

          {/* Buy from us */}
          <button
            type="button"
            onClick={handleChooseBonzah}
            className="rounded-xl border p-5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: draft.insuranceChoice === 'bonzah' ? 'var(--accent-color)' : 'var(--border-subtle)',
              borderWidth: draft.insuranceChoice === 'bonzah' ? '2px' : '1px',
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
              <ShieldCheck size={20} />
            </div>
            <p className="font-semibold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Buy coverage from us
            </p>
            <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-tertiary)' }}>
              Add Bonzah collision damage waiver to your rental. Optional upgrades for liability, supplemental liability, and personal accident.
            </p>
            <p className="text-xs mt-3 font-medium flex items-center gap-1" style={{ color: 'var(--accent-color)' }}>
              View coverage options <span aria-hidden>→</span>
            </p>
          </button>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onBack}
            className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     View 2 — Own insurance details form
     ════════════════════════════════════════════════════════ */
  if (view === 'own') {
    return (
      <div className="space-y-5">
        {/* Breadcrumb back to choice */}
        <button type="button" onClick={handleBackToChoice}
          className="inline-flex items-center gap-1.5 text-xs hover:underline cursor-pointer"
          style={{ color: 'var(--text-tertiary)' }}>
          <ArrowLeft size={12} /> Choose a different option
        </button>

        {/* Header */}
        <div className="rounded-xl border p-4 sm:p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
              <UserCheck size={16} />
            </div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Your Insurance Details</h3>
          </div>
          <p className="text-xs leading-relaxed ml-[42px]" style={{ color: 'var(--text-tertiary)' }}>
            We'll keep these on file with your rental agreement. Please make sure your policy is active for your rental dates.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border p-4 sm:p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Insurance Company *</label>
                <input className={inputClass('company')} style={{ ...inputStyle, ...borderStyle('company') }}
                  value={own.company} onChange={e => updateOwn({ company: e.target.value })} placeholder="State Farm" />
                {fieldErrors.company && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{fieldErrors.company}</p>}
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Policy Number *</label>
                <input className={inputClass('policyNumber')} style={{ ...inputStyle, ...borderStyle('policyNumber') }}
                  value={own.policyNumber} onChange={e => updateOwn({ policyNumber: e.target.value })} placeholder="POL-123456" />
                {fieldErrors.policyNumber && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{fieldErrors.policyNumber}</p>}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Policy Expiration Date *</label>
              <input type="date" className={inputClass('expiry')} style={{ ...inputStyle, ...borderStyle('expiry') }}
                value={own.expiry} onChange={e => updateOwn({ expiry: e.target.value })} />
              {fieldErrors.expiry && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{fieldErrors.expiry}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Agent Name <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input className={inputClass('agentName')} style={{ ...inputStyle, ...borderStyle('agentName') }}
                  value={own.agentName} onChange={e => updateOwn({ agentName: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Agent Phone <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input className={inputClass('agentPhone')} style={{ ...inputStyle, ...borderStyle('agentPhone') }}
                  value={own.agentPhone} onChange={e => updateOwn({ agentPhone: e.target.value })} placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={handleBackToChoice}
            className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
            Back
          </button>
          <button type="button" onClick={handleContinue}
            className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
            Continue to Payment
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     View 3 — Bonzah tier selection (CDW Essential mandatory within this path)
     ════════════════════════════════════════════════════════ */

  if (configLoading) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={handleBackToChoice}
          className="inline-flex items-center gap-1.5 text-xs hover:underline cursor-pointer"
          style={{ color: 'var(--text-tertiary)' }}>
          <ArrowLeft size={12} /> Choose a different option
        </button>
        <div className="rounded-xl border p-6 flex items-center justify-center gap-2.5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <Loader2 className="animate-spin" size={18} style={{ color: 'var(--accent-color)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading insurance options…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb back to choice */}
      <button type="button" onClick={handleBackToChoice}
        className="inline-flex items-center gap-1.5 text-xs hover:underline cursor-pointer"
        style={{ color: 'var(--text-tertiary)' }}>
        <ArrowLeft size={12} /> Choose a different option
      </button>

      {/* Header */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <Shield size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Bonzah Coverage</h3>
        </div>
        <p className="text-xs leading-relaxed ml-[42px]" style={{ color: 'var(--text-tertiary)' }}>
          Essential CDW is the minimum included. Upgrade to Standard or Complete for liability and personal accident protection.
        </p>
      </div>

      {/* Mandatory-within-Bonzah notice */}
      <div className="rounded-xl border p-3 flex items-start gap-2.5"
        style={{ backgroundColor: 'rgba(200,169,126,0.08)', borderColor: 'rgba(200,169,126,0.25)' }}>
        <ShieldAlert size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <strong>CDW Essential is included in every Bonzah policy.</strong> It's the minimum collision damage waiver — Essential is pre-selected and you can upgrade to a higher tier below.
        </p>
      </div>

      {/* Eligibility / exclusion notices */}
      {!configError && config && !ageOk && driverAge !== null && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah insurance requires drivers 21 or older. You may use your own insurance instead — click "Choose a different option" above.
        </div>
      )}
      {!configError && config && stateBlocked && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
          Bonzah is not available for rentals picked up in {stateName}. You may use your own insurance instead — click "Choose a different option" above.
        </div>
      )}
      {configError && (
        <div className="rounded-xl border p-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {configError} — Please contact us at (772) 207-1655 or use your own insurance.
        </div>
      )}

      {/* Aggregate-failure banner */}
      {bonzahAvailable
        && visibleTiers.length > 0
        && visibleTiers.every(t => tierErrors[t.id])
        && !visibleTiers.some(t => tierLoading[t.id]) && (
        <div className="rounded-xl border p-3 text-xs flex items-start gap-2"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold">Bonzah pricing is unavailable for this booking.</p>
            <p className="opacity-90 mt-0.5 break-words">{tierErrors[visibleTiers[0].id]}</p>
            <p className="opacity-75 mt-1">Please use your own insurance or contact us at (772) 207-1655.</p>
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
                    Essential is included · upgrade for more protection
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
                            Included
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
        <button type="button" onClick={handleBackToChoice}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button type="button" onClick={handleContinue}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          Continue to Payment
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
