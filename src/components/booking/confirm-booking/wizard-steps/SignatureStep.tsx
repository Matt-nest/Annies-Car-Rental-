import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Eraser } from 'lucide-react';
import SignaturePad from 'signature_pad';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

export default function SignatureStep({ draft, onUpdate, onContinue, onBack, theme }: Props) {
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [sigMode, setSigMode] = useState<'draw' | 'type'>(draft.signature.mode || 'draw');
  const [typedSig, setTypedSig] = useState(draft.signature.mode === 'type' ? draft.signature.data : '');

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  // Init signature pad
  useEffect(() => {
    if (!canvasRef.current || sigMode !== 'draw') return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    sigPadRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: theme === 'dark' ? '#e8e1d5' : '#1a1a1a',
      minWidth: 1.5,
      maxWidth: 3,
    });

    // Restore if we have saved data
    if (draft.signature.mode === 'draw' && draft.signature.data) {
      try {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
        };
        img.src = draft.signature.data;
      } catch {}
    }

    return () => { sigPadRef.current?.off(); };
  }, [sigMode, theme]);

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setTypedSig('');
    setError('');
  };

  const getSignatureData = (): string => {
    if (sigMode === 'draw') {
      if (sigPadRef.current?.isEmpty()) return '';
      return sigPadRef.current!.toDataURL('image/png');
    } else {
      if (!typedSig.trim()) return '';
      // Generate a canvas from typed text
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 600;
      tempCanvas.height = 150;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, 600, 150);
      ctx.font = 'italic 48px "Dancing Script", "Brush Script MT", cursive';
      ctx.fillStyle = theme === 'dark' ? '#e8e1d5' : '#1a1a1a';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedSig, 20, 75);
      return tempCanvas.toDataURL('image/png');
    }
  };

  const handleContinue = () => {
    const sigData = getSignatureData();
    if (!sigData) {
      setError(sigMode === 'draw' ? 'Please sign the agreement' : 'Please type your signature');
      return;
    }
    onUpdate({ signature: { mode: sigMode, data: sigData } });
    onContinue();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <PenTool size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Your Signature</h3>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-3">
          <button type="button" onClick={() => { setSigMode('draw'); clearSignature(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${sigMode === 'draw' ? 'text-amber-200' : ''}`}
            style={{
              backgroundColor: sigMode === 'draw' ? 'rgba(200,169,126,0.2)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: sigMode === 'draw' ? 'var(--accent-color)' : 'var(--text-tertiary)',
            }}>
            ✍️ Draw
          </button>
          <button type="button" onClick={() => { setSigMode('type'); clearSignature(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${sigMode === 'type' ? 'text-amber-200' : ''}`}
            style={{
              backgroundColor: sigMode === 'type' ? 'rgba(200,169,126,0.2)' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: sigMode === 'type' ? 'var(--accent-color)' : 'var(--text-tertiary)',
            }}>
            ⌨️ Type
          </button>
        </div>

        {sigMode === 'draw' ? (
          <div>
            <div
              className="relative rounded-xl overflow-hidden border-2 border-dashed"
              style={{
                borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafaf8',
              }}
            >
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair touch-none"
                style={{ height: '140px' }}
              />
              <button
                type="button"
                onClick={clearSignature}
                className="absolute top-2 right-2 p-1.5 rounded-full transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: 'var(--text-tertiary)',
                }}
              >
                <Eraser size={14} />
              </button>
            </div>
            <p className="text-[10px] mt-1 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Sign with your finger or mouse above
            </p>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={typedSig}
              onChange={e => { setTypedSig(e.target.value); setError(''); }}
              placeholder="Type your full legal name"
              className={`w-full px-4 py-4 rounded-xl border text-2xl focus:outline-none transition-all appearance-none ${error ? 'border-red-500/60' : ''}`}
              style={{
                ...inputStyle,
                borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
                fontFamily: '"Dancing Script", "Brush Script MT", cursive',
                fontStyle: 'italic',
              }}
            />
            <p className="text-[10px] mt-1 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Your typed name will serve as your electronic signature
            </p>
          </div>
        )}
        {error && <p className="text-red-400 text-xs mt-1 ml-0.5">{error}</p>}

        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By signing, you agree to all terms and conditions of this Rental Agreement. This electronic signature is legally binding
          under the ESIGN Act (15 U.S.C. § 7001) and Florida's Uniform Electronic Transactions Act (Ch. 668, F.S.).
        </p>
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
          Continue to Insurance
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}
