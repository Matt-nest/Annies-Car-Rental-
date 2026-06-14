import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ScanLine, CheckCircle2, AlertTriangle, Sun, Square, Maximize, ImageOff, Camera, PenLine, RotateCcw } from 'lucide-react';
import { API_URL } from '../constants';
import { compressImage } from '../../../../utils/compressImage';
import type { ParsedLicense } from '../../../../utils/aamva';
import type { WizardDraft } from '../constants';

interface Props {
  draft: WizardDraft;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  onEdit: () => void;
  theme: string;
  bookingName?: string;
}

type Mode = 'live' | 'analyzing' | 'success' | 'error' | 'denied';
type ScannerControls = { stop: () => void } | null;

const TIPS = [
  { icon: Sun, label: 'Good light' },
  { icon: Square, label: 'Flat surface' },
  { icon: Maximize, label: 'Fill the frame' },
  { icon: ImageOff, label: 'Avoid glare' },
];

/** Loose name compare: does each scanned token appear in the booking name? */
function compareName(p: ParsedLicense, bookingName?: string): 'match' | 'mismatch' | null {
  const scanned = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  if (!scanned || !bookingName) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const book = norm(bookingName);
  const tokens = norm(scanned);
  if (!tokens.length || !book.length) return null;
  const hit = tokens.filter(t => t.length > 1 && book.some(b => b === t || b.startsWith(t) || t.startsWith(b)));
  return hit.length >= 1 ? 'match' : 'mismatch';
}

export default function ScanStep({ draft, onUpdate, onContinue, onBack, onEdit, theme, bookingName }: Props) {
  const reduce = useReducedMotion();
  const [mode, setMode] = React.useState<Mode>('live');
  const [scanned, setScanned] = React.useState<ParsedLicense | null>(null);
  const [nameMatch, setNameMatch] = React.useState<'match' | 'mismatch' | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<ScannerControls>(null);
  const frontRef = React.useRef<HTMLInputElement>(null);

  const stopCamera = React.useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
  }, []);

  const applyAndVerify = React.useCallback((p: ParsedLicense) => {
    onUpdate({
      license: {
        number: p.licenseNumber || draft.license.number,
        state: p.jurisdiction || draft.license.state,
        expiry: p.expiry || draft.license.expiry,
      },
      ...(p.dob ? { dob: p.dob } : {}),
      address: {
        line1: p.addressLine1 || draft.address.line1,
        city: p.city || draft.address.city,
        state: p.jurisdiction || draft.address.state,
        zip: p.zip || draft.address.zip,
      },
    });
    setScanned(p);
    setNameMatch(compareName(p, bookingName));
    setMode('success');
  }, [draft.address, draft.license, onUpdate, bookingName]);

  // Live rear-camera barcode decode. Auto-fires on the first readable frame.
  React.useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserPDF417Reader }, { parseAamva }] = await Promise.all([
          import('@zxing/browser'),
          import('../../../../utils/aamva'),
        ]);
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserPDF417Reader();
        const controls = await reader.decodeFromConstraints(
          // High-res rear stream — PDF417 is dense and won't resolve at default res.
          { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
          videoRef.current,
          (result) => {
            if (cancelled || !result) return;
            const parsed = parseAamva(result.getText());
            if (parsed.licenseNumber || parsed.lastName) {
              controls.stop();
              applyAndVerify(parsed);
            }
          }
        );
        controlsRef.current = controls;
        if (cancelled) controls.stop();
      } catch {
        if (!cancelled) setMode('denied');
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [mode, applyAndVerify, stopCamera]);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  // Server OCR (Azure) on a still. Returns true if it filled anything.
  const runAzure = async (file: File): Promise<boolean> => {
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append('file', compressed);
      const res = await fetch(`${API_URL}/uploads/scan-id`, { method: 'POST', body: form });
      const data = res.ok ? await res.json() : null;
      if (data?.ok && data.fields) {
        const fx = data.fields;
        applyAndVerify({
          firstName: fx.firstName, lastName: fx.lastName,
          licenseNumber: fx.licenseNumber, jurisdiction: fx.state,
          dob: fx.dob, expiry: fx.expiry,
          addressLine1: fx.addressLine1, city: fx.city, zip: fx.zip,
        });
        return true;
      }
    } catch { /* fall through */ }
    return false;
  };

  // Run a still through both decoders: barcode (back) first, then Azure (front).
  const processStill = async (file: File) => {
    setMode('analyzing');
    try {
      const { scanLicenseBarcode } = await import('../../../../utils/scanLicenseBarcode');
      const parsed = await scanLicenseBarcode(file);
      if (parsed) { applyAndVerify(parsed); return; }
    } catch { /* try Azure */ }
    const ok = await runAzure(file);
    if (!ok) {
      setErrorMsg("We couldn't read it. Fill the frame with the license — front or back — flat and in good light.");
      setMode('error');
    }
  };

  const handleFrontPhoto = (file: File) => { stopCamera(); void processStill(file); };

  // Grab a full-resolution still from the live feed (sharper than a live frame).
  const captureFrame = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.95));
    stopCamera();
    if (!blob) { setMode('live'); return; }
    void processStill(new File([blob], 'license.jpg', { type: 'image/jpeg' }));
  };

  const card: React.CSSProperties = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' };
  const firstName = (scanned?.firstName || '').split(/[ ,]/)[0];

  // ── Camera viewport (live) ──────────────────────────────────────────────────
  const viewport = (
    <div role="button" tabIndex={0} onClick={captureFrame}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') captureFrame(); }}
      aria-label="Tap to capture your license"
      className="relative w-full overflow-hidden rounded-2xl border cursor-pointer" style={{ borderColor: 'var(--accent-color)', aspectRatio: '1.586 / 1', backgroundColor: '#0b0b0d' }}>
      <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" aria-label="Live camera preview for scanning your license" />
      {/* dim mask + corner reticle */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0.28)' }} />
      <div className="absolute inset-[12%] pointer-events-none">
        {([['top','left'],['top','right'],['bottom','left'],['bottom','right']] as const).map(([v, h]) => (
          <span key={`${v}${h}`} className="absolute w-6 h-6" style={{
            [v]: -2, [h]: -2,
            borderTop: v === 'top' ? '3px solid var(--accent-color)' : undefined,
            borderBottom: v === 'bottom' ? '3px solid var(--accent-color)' : undefined,
            borderLeft: h === 'left' ? '3px solid var(--accent-color)' : undefined,
            borderRight: h === 'right' ? '3px solid var(--accent-color)' : undefined,
            borderTopLeftRadius: v === 'top' && h === 'left' ? 8 : 0,
            borderTopRightRadius: v === 'top' && h === 'right' ? 8 : 0,
            borderBottomLeftRadius: v === 'bottom' && h === 'left' ? 8 : 0,
            borderBottomRightRadius: v === 'bottom' && h === 'right' ? 8 : 0,
          } as React.CSSProperties} />
        ))}
        {!reduce && (
          <motion.div className="absolute left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)' }}
            initial={{ top: '0%' }} animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
        )}
      </div>
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <ScanLine size={13} style={{ color: 'var(--accent-color)' }} />
        <span className="text-[11px] font-medium text-white">Scanning…</span>
      </div>
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <span className="text-[11px] text-white/90">Auto-detecting — or tap to capture</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 sm:p-5" style={card}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
            <ScanLine size={16} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Scan your license</h3>
        </div>
        <p className="text-[13px] mb-4 ml-0.5" style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Point your camera at the barcode on the <strong>back</strong> — we'll fill in the rest. Your photo is read on your device.
        </p>

        <AnimatePresence mode="wait">
          {/* LIVE */}
          {mode === 'live' && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
              {viewport}
              <div className="grid grid-cols-4 gap-2">
                {TIPS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                      <Icon size={16} style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <span className="text-[10px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ANALYZING */}
          {mode === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-3 py-12">
              <span className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Reading your license…</p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {mode === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex flex-col items-center text-center py-2">
                <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--accent-glow)' }}>
                  <CheckCircle2 size={30} style={{ color: 'var(--accent-color)' }} />
                </motion.div>
                <h4 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {firstName ? `Got it, ${firstName}!` : 'Got it!'}
                </h4>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Your details are filled in below — just review and continue.</p>
              </div>

              <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {[
                  ['License', [scanned?.licenseNumber, scanned?.jurisdiction].filter(Boolean).join('  ·  ')],
                  ['Expires', scanned?.expiry],
                  ['Date of birth', scanned?.dob],
                  ['Address', [scanned?.addressLine1, scanned?.city, scanned?.zip].filter(Boolean).join(', ')],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <span className="text-[13px] font-medium text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {nameMatch === 'match' && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
                  <CheckCircle2 size={14} /> Matches your booking name.
                </div>
              )}
              {nameMatch === 'mismatch' && (
                <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(202,138,4,0.12)', color: '#b45309' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>The name on this ID differs from your booking ({bookingName}). That's okay — we'll verify at pickup.</span>
                </div>
              )}
              <button type="button" onClick={onEdit}
                className="w-full min-h-[44px] py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-colors duration-200 hover:opacity-90"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <PenLine size={14} /> Edit details
              </button>
            </motion.div>
          )}

          {/* ERROR */}
          {mode === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="flex flex-col items-center text-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={24} style={{ color: 'rgb(239,68,68)' }} />
              </div>
              <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{errorMsg}</p>
            </motion.div>
          )}

          {/* DENIED (no camera / permission) */}
          {mode === 'denied' && (
            <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                <Camera size={22} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Camera isn't available. Photograph the front of your license instead, or enter your details by hand.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden front-photo input (Azure fallback) */}
        <input ref={frontRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFrontPhoto(f); e.target.value = ''; }} />

        {/* Secondary actions */}
        {mode !== 'analyzing' && mode !== 'success' && (
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" onClick={() => frontRef.current?.click()}
              className="w-full min-h-[44px] py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-colors duration-200 hover:opacity-90"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <Camera size={15} /> {mode === 'error' ? 'Try the front of the license' : "Can't scan? Photograph the front"}
            </button>
            {mode === 'error' && (
              <button type="button" onClick={() => { setErrorMsg(''); setMode('live'); }}
                className="w-full min-h-[44px] py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-colors duration-200"
                style={{ color: 'var(--accent-color)' }}>
                <RotateCcw size={15} /> Scan again
              </button>
            )}
            <button type="button" onClick={onContinue}
              className="w-full min-h-[44px] py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer transition-colors duration-200"
              style={{ color: 'var(--text-tertiary)' }}>
              <PenLine size={14} /> Enter details manually
            </button>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Back
        </button>
        <button type="button" onClick={mode === 'live' ? captureFrame : onContinue} disabled={mode === 'analyzing'}
          className="flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          {mode === 'live' ? (<><Camera size={17} /> Capture license</>)
            : mode === 'success' ? (<>Looks good — continue <span>→</span></>)
            : (<>Continue <span>→</span></>)}
        </button>
      </div>
    </div>
  );
}
