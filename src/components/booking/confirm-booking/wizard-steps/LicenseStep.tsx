import React from 'react';
import { CreditCard, Upload, X, CheckCircle } from 'lucide-react';
import { US_STATES } from '../../../../data/rentalTerms';
import { API_URL } from '../constants';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  theme: string;
}

type PhotoSide = 'front' | 'back';

export default function LicenseStep({ draft, onUpdate, onContinue, onBack, theme }: Props) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [uploading, setUploading] = React.useState<Record<PhotoSide, boolean>>({ front: false, back: false });
  const [previews, setPreviews] = React.useState<Record<PhotoSide, string | null>>({ front: null, back: null });
  const frontRef = React.useRef<HTMLInputElement>(null);
  const backRef = React.useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  const inputClass = (field: string) =>
    `w-full px-3.5 min-h-[46px] rounded-xl border text-sm focus:outline-none transition-all placeholder:opacity-40 appearance-none ${errors[field] ? 'border-red-500/60' : ''}`;

  const borderStyle = (field: string): React.CSSProperties => ({
    borderColor: errors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  const updateLicense = (key: string, value: string) => {
    onUpdate({ license: { ...draft.license, [key]: value } });
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handlePhotoUpload = async (side: PhotoSide, file: File) => {
    setUploading(prev => ({ ...prev, [side]: true }));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/uploads/id-photo`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const { url, path } = await res.json();

      const currentPaths = draft.licensePhotoPaths || [];
      // Replace existing slot for this side (front = index 0, back = index 1)
      const newPaths = [...currentPaths];
      const idx = side === 'front' ? 0 : 1;
      newPaths[idx] = path;
      onUpdate({ licensePhotoPaths: newPaths.filter(Boolean) });
      setPreviews(prev => ({ ...prev, [side]: url }));
    } catch {
      // silently fail — photos are optional
    } finally {
      setUploading(prev => ({ ...prev, [side]: false }));
    }
  };

  const removePhoto = (side: PhotoSide) => {
    const idx = side === 'front' ? 0 : 1;
    const newPaths = [...(draft.licensePhotoPaths || [])];
    newPaths[idx] = '';
    onUpdate({ licensePhotoPaths: newPaths.filter(Boolean) });
    setPreviews(prev => ({ ...prev, [side]: null }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.license.number.trim()) errs.number = 'Required';
    if (!draft.license.state) errs.state = 'Required';
    if (!draft.license.expiry) errs.expiry = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validate()) onContinue();
  };

  const PhotoUploadSlot = ({ side, label }: { side: PhotoSide; label: string }) => {
    const ref = side === 'front' ? frontRef : backRef;
    const preview = previews[side];
    const isUploading = uploading[side];

    return (
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.15em] mb-1.5 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        {preview ? (
          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--accent-color)', aspectRatio: '16/10' }}>
            <img src={preview} alt={`License ${side}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(side)}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              <X size={12} className="text-white" />
            </button>
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
              <CheckCircle size={12} style={{ color: 'var(--accent-color)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--accent-color)' }}>Uploaded</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={isUploading}
            className="w-full rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 py-4 transition-all cursor-pointer hover:opacity-80"
            style={{ borderColor: 'var(--border-subtle)', backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', aspectRatio: '16/10' }}
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }} />
            ) : (
              <Upload size={16} style={{ color: 'var(--text-tertiary)' }} />
            )}
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {isUploading ? 'Uploading…' : 'Tap to upload'}
            </span>
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(side, file);
            e.target.value = '';
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <CreditCard size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Driver's License</h3>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>License # *</label>
              <input className={inputClass('number')} style={{ ...inputStyle, ...borderStyle('number') }}
                value={draft.license.number} onChange={e => updateLicense('number', e.target.value)} placeholder="S530-123-45-678-0" />
              {errors.number && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{errors.number}</p>}
            </div>
            <div className="col-span-1">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>State *</label>
              <select className={inputClass('state')} style={{ ...inputStyle, ...borderStyle('state') }}
                value={draft.license.state} onChange={e => updateLicense('state', e.target.value)}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Expires *</label>
              <input type="date" className={inputClass('expiry')} style={{ ...inputStyle, ...borderStyle('expiry') }}
                value={draft.license.expiry} onChange={e => updateLicense('expiry', e.target.value)} />
              {errors.expiry && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{errors.expiry}</p>}
            </div>
          </div>

          {/* Photo upload — optional */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] mb-2 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
              License Photos <span className="normal-case opacity-60">(optional — speeds up check-in)</span>
            </p>
            <div className="flex gap-3">
              <PhotoUploadSlot side="front" label="Front" />
              <PhotoUploadSlot side="back" label="Back" />
            </div>
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
