import React from 'react';
import { MapPin } from 'lucide-react';
import { US_STATES } from '../../../../data/rentalTerms';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

export default function AddressStep({ draft, onUpdate, onContinue, onBack, theme }: Props) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  const inputClass = (field: string) =>
    `w-full px-3.5 min-h-[46px] rounded-xl border text-sm focus:outline-none transition-all placeholder:opacity-40 appearance-none ${errors[field] ? 'border-red-500/60' : ''}`;

  const borderStyle = (field: string): React.CSSProperties => ({
    borderColor: errors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  const updateAddress = (key: string, value: string) => {
    onUpdate({ address: { ...draft.address, [key]: value } });
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.address.line1.trim()) errs.line1 = 'Required';
    if (!draft.address.city.trim()) errs.city = 'Required';
    if (!draft.address.state) errs.state = 'Required';
    if (!draft.address.zip.trim()) errs.zip = 'Required';
    if (!draft.dob) errs.dob = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validate()) onContinue();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <MapPin size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Your Address</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Street Address *</label>
            <input className={inputClass('line1')} style={{ ...inputStyle, ...borderStyle('line1') }}
              value={draft.address.line1} onChange={e => updateAddress('line1', e.target.value)} placeholder="123 Main St" />
            {errors.line1 && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{errors.line1}</p>}
          </div>

          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>City *</label>
              <input className={inputClass('city')} style={{ ...inputStyle, ...borderStyle('city') }}
                value={draft.address.city} onChange={e => updateAddress('city', e.target.value)} placeholder="Port St. Lucie" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>State *</label>
              <select className={inputClass('state')} style={{ ...inputStyle, ...borderStyle('state') }}
                value={draft.address.state} onChange={e => updateAddress('state', e.target.value)}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Zip *</label>
              <input className={inputClass('zip')} style={{ ...inputStyle, ...borderStyle('zip') }}
                value={draft.address.zip} onChange={e => updateAddress('zip', e.target.value)} placeholder="34952" inputMode="numeric" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Date of Birth *</label>
            <input type="date" className={inputClass('dob')} style={{ ...inputStyle, ...borderStyle('dob') }}
              value={draft.dob} onChange={e => { onUpdate({ dob: e.target.value }); if (errors.dob) setErrors(prev => { const n = { ...prev }; delete n.dob; return n; }); }} />
            {errors.dob && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{errors.dob}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button type="button" onClick={handleContinue}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          Continue
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}
