import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ACKNOWLEDGEMENTS } from '../../../../data/rentalTerms';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

export default function AcknowledgementsStep({ draft, onUpdate, onContinue, onBack, theme }: Props) {
  const [error, setError] = React.useState('');

  // Initialize acknowledgements array if not yet set
  const acks = draft.acknowledgements.length === ACKNOWLEDGEMENTS.length
    ? draft.acknowledgements
    : ACKNOWLEDGEMENTS.map(() => false);

  const toggleAck = (idx: number) => {
    const newAcks = [...acks];
    newAcks[idx] = !newAcks[idx];
    onUpdate({ acknowledgements: newAcks });
    setError('');
  };

  const handleContinue = () => {
    if (!acks.every(Boolean)) {
      setError('All acknowledgements are required');
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <CheckCircle2 size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Acknowledgements</h3>
        </div>

        <div className="space-y-3">
          {ACKNOWLEDGEMENTS.map((text, idx) => (
            <label
              key={idx}
              className="flex items-start gap-3 cursor-pointer group"
              onClick={() => toggleAck(idx)}
            >
              <div
                className="w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: acks[idx] ? 'var(--accent-color)' : 'transparent',
                  borderColor: acks[idx] ? 'var(--accent-color)' : error ? 'rgba(239,68,68,0.5)' : 'var(--border-medium)',
                }}
              >
                {acks[idx] && <CheckCircle2 size={12} style={{ color: 'var(--accent-fg)' }} />}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-red-400 text-xs mt-2 ml-0.5">{error}</p>}
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
