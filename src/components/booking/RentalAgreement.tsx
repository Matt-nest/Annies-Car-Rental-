import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  FileText, MapPin, Car, Calendar, DollarSign, Shield, PenTool,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, ChevronDown, ChevronUp, Eraser,
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import { RENTAL_TERMS, ACKNOWLEDGEMENTS, US_STATES } from '../../data/rentalTerms';
import { API_URL } from '../../config';

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */
interface AgreementData {
  alreadySigned: boolean;
  autoFilled: {
    customerName: string;
    phone: string;
    email: string;
    dateOut: string;
    dateDueIn: string;
    pickupTime: string;
    returnTime: string;
    pickupLocation: string;
    vehicle: string;
    vin: string;
    licensePlate: string;
    vehicleState: string;
    color: string;
    dailyRate: number;
    weeklyRate: number | null;
    milesPerDay: number;
    rentalDays: number;
    subtotal: number;
    deliveryFee: number;
    discountAmount: number;
    taxAmount: number;
    totalCost: number;
  };
  customerDefaults: Record<string, string>;
}

interface Props {
  bookingCode: string;
  theme: string;
  onSigned: () => void;
}

/* ────────────────────────────────────────────────────────
   Styled micro-components
   ──────────────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}
      >
        <Icon size={16} />
      </div>
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] mb-1 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <div
        className="px-3.5 py-2.5 rounded-xl text-sm"
        style={{
          backgroundColor: 'rgba(200,169,126,0.06)',
          border: '1px solid rgba(200,169,126,0.15)',
          color: 'var(--text-primary)',
        }}
      >
        {value || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────── */
export default function RentalAgreement({ bookingCode, theme, onSigned }: Props) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<AgreementData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form fields
  const [form, setForm] = useState({
    address_line1: '', city: '', state: '', zip: '',
    date_of_birth: '',
    driver_license_number: '', driver_license_state: '', driver_license_expiry: '',
    insurance_company: '', insurance_policy_number: '', insurance_expiry: '',
    insurance_agent_name: '', insurance_agent_phone: '', insurance_vehicle_description: '',
  });
  const [acks, setAcks] = useState<boolean[]>(ACKNOWLEDGEMENTS.map(() => false));
  const [termsExpanded, setTermsExpanded] = useState(false);

  // Signature
  const [sigMode, setSigMode] = useState<'draw' | 'type'>('draw');
  const [typedSig, setTypedSig] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  // Validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Fetch agreement data ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/agreements/${bookingCode}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load agreement');
        setData(json);

        if (json.alreadySigned) {
          onSigned();
          return;
        }

        // Pre-fill form from customer defaults
        if (json.customerDefaults) {
          setForm(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(json.customerDefaults).filter(([, v]) => v)
            ),
          }));
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingCode]);

  // ── Init signature pad ────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || loading || data?.alreadySigned) return;

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

    return () => { sigPadRef.current?.off(); };
  }, [loading, data?.alreadySigned, sigMode, theme]);

  // ── Form handlers ─────────────────────────────────────────────────────
  const updateField = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  }, [fieldErrors]);

  const toggleAck = (idx: number) => {
    setAcks(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setTypedSig('');
  };

  // ── Validation ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.address_line1.trim()) errs.address_line1 = 'Required';
    if (!form.city.trim()) errs.city = 'Required';
    if (!form.state) errs.state = 'Required';
    if (!form.zip.trim()) errs.zip = 'Required';
    if (!form.date_of_birth) errs.date_of_birth = 'Required';
    if (!form.driver_license_number.trim()) errs.driver_license_number = 'Required';
    if (!form.driver_license_state) errs.driver_license_state = 'Required';
    if (!form.driver_license_expiry) errs.driver_license_expiry = 'Required';

    if (!acks.every(Boolean)) errs._acks = 'All acknowledgements are required';

    if (sigMode === 'draw' && sigPadRef.current?.isEmpty()) {
      errs._signature = 'Please sign the agreement';
    }
    if (sigMode === 'type' && !typedSig.trim()) {
      errs._signature = 'Please type your signature';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');

    let signatureData: string;
    if (sigMode === 'draw') {
      signatureData = sigPadRef.current!.toDataURL('image/png');
    } else {
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
      signatureData = tempCanvas.toDataURL('image/png');
    }

    try {
      const res = await fetch(`${API_URL}/agreements/${bookingCode}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          signature_data: signatureData,
          signature_type: sigMode === 'draw' ? 'drawn' : 'typed',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit agreement');

      onSigned();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  const inputClass = (field: string) =>
    `w-full px-3.5 min-h-[46px] rounded-xl border text-sm focus:outline-none transition-all placeholder:opacity-40 appearance-none ${
      fieldErrors[field] ? 'border-red-500/60' : ''
    }`;

  const borderStyle = (field: string): React.CSSProperties => ({
    borderColor: fieldErrors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ── Loading / Error ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="animate-spin" size={22} style={{ color: 'var(--accent-color)' }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading rental agreement…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <span>{error || 'Could not load rental agreement'}</span>
      </div>
    );
  }

  const af = data.autoFilled;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ════════════ BOOKING SUMMARY (Read-only) ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <SectionHeader icon={Car} title="Rental Summary" />
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Customer" value={af.customerName} />
          <ReadOnlyField label="Vehicle" value={af.vehicle} />
          <ReadOnlyField label="Pickup Date" value={formatDate(af.dateOut)} />
          <ReadOnlyField label="Return Date" value={formatDate(af.dateDueIn)} />
          <ReadOnlyField label="VIN" value={af.vin || 'On file'} />
          <ReadOnlyField label="License Plate" value={af.licensePlate || 'On file'} />
        </div>

        {/* Pricing */}
        <div className="mt-4 pt-3 space-y-1.5"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>{af.rentalDays} day{af.rentalDays !== 1 ? 's' : ''} × {fmt(af.dailyRate)}/day</span>
            <span style={{ color: 'var(--text-primary)' }}>{fmt(af.subtotal)}</span>
          </div>
          {af.deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Delivery fee</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(af.deliveryFee)}</span>
            </div>
          )}
          {af.taxAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(af.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-1.5"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-primary)' }}>Total</span>
            <span style={{ color: 'var(--accent-color)' }}>{fmt(af.totalCost)}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Miles allowed: {af.milesPerDay}/day
          </p>
        </div>
      </div>

      {/* ════════════ CUSTOMER INFORMATION ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <SectionHeader icon={MapPin} title="Your Information" />

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Street Address *</label>
            <input className={inputClass('address_line1')} style={{ ...inputStyle, ...borderStyle('address_line1') }}
              value={form.address_line1} onChange={e => updateField('address_line1', e.target.value)} placeholder="123 Main St" />
            {fieldErrors.address_line1 && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{fieldErrors.address_line1}</p>}
          </div>

          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>City *</label>
              <input className={inputClass('city')} style={{ ...inputStyle, ...borderStyle('city') }}
                value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="Port St. Lucie" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>State *</label>
              <select className={inputClass('state')} style={{ ...inputStyle, ...borderStyle('state') }}
                value={form.state} onChange={e => updateField('state', e.target.value)}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Zip *</label>
              <input className={inputClass('zip')} style={{ ...inputStyle, ...borderStyle('zip') }}
                value={form.zip} onChange={e => updateField('zip', e.target.value)} placeholder="34952" inputMode="numeric" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Date of Birth *</label>
            <input type="date" className={inputClass('date_of_birth')} style={{ ...inputStyle, ...borderStyle('date_of_birth') }}
              value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} />
            {fieldErrors.date_of_birth && <p className="text-red-400 text-xs mt-0.5 ml-0.5">{fieldErrors.date_of_birth}</p>}
          </div>

          <div className="pt-1">
            <p className="text-[10px] uppercase tracking-[0.15em] mb-2 ml-0.5 font-semibold" style={{ color: 'var(--text-tertiary)' }}>Driver's License</p>
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>License # *</label>
                <input className={inputClass('driver_license_number')} style={{ ...inputStyle, ...borderStyle('driver_license_number') }}
                  value={form.driver_license_number} onChange={e => updateField('driver_license_number', e.target.value)} placeholder="S530-123-45-678-0" />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>State *</label>
                <select className={inputClass('driver_license_state')} style={{ ...inputStyle, ...borderStyle('driver_license_state') }}
                  value={form.driver_license_state} onChange={e => updateField('driver_license_state', e.target.value)}>
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Expires *</label>
                <input type="date" className={inputClass('driver_license_expiry')} style={{ ...inputStyle, ...borderStyle('driver_license_expiry') }}
                  value={form.driver_license_expiry} onChange={e => updateField('driver_license_expiry', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ INSURANCE (Optional) ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <SectionHeader icon={Shield} title="Insurance Information" />
        <p className="text-xs mb-3 -mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Optional — fill in if you have your own auto insurance. You can also purchase coverage from Bonzah in the next step.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Insurance Company</label>
              <input className={inputClass('insurance_company')} style={{ ...inputStyle, ...borderStyle('insurance_company') }}
                value={form.insurance_company} onChange={e => updateField('insurance_company', e.target.value)} placeholder="State Farm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Policy #</label>
              <input className={inputClass('insurance_policy_number')} style={{ ...inputStyle, ...borderStyle('insurance_policy_number') }}
                value={form.insurance_policy_number} onChange={e => updateField('insurance_policy_number', e.target.value)} placeholder="POL-123456" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Expires</label>
              <input type="date" className={inputClass('insurance_expiry')} style={{ ...inputStyle, ...borderStyle('insurance_expiry') }}
                value={form.insurance_expiry} onChange={e => updateField('insurance_expiry', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Agent</label>
              <input className={inputClass('insurance_agent_name')} style={{ ...inputStyle, ...borderStyle('insurance_agent_name') }}
                value={form.insurance_agent_name} onChange={e => updateField('insurance_agent_name', e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Agent Phone</label>
              <input className={inputClass('insurance_agent_phone')} style={{ ...inputStyle, ...borderStyle('insurance_agent_phone') }}
                value={form.insurance_agent_phone} onChange={e => updateField('insurance_agent_phone', e.target.value)} placeholder="(772) 555-0200" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] mb-1 block ml-0.5" style={{ color: 'var(--text-tertiary)' }}>Insured Vehicle (Year/Make/Model/Color)</label>
            <input className={inputClass('insurance_vehicle_description')} style={{ ...inputStyle, ...borderStyle('insurance_vehicle_description') }}
              value={form.insurance_vehicle_description} onChange={e => updateField('insurance_vehicle_description', e.target.value)} placeholder="2020 Toyota Camry Silver" />
          </div>
        </div>
      </div>

      {/* ════════════ TERMS & CONDITIONS ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader icon={FileText} title="Terms & Conditions" />
          <button
            type="button"
            onClick={() => setTermsExpanded(!termsExpanded)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: 'var(--text-secondary)',
            }}
          >
            {termsExpanded ? 'Collapse' : 'Read Full Terms'}
            {termsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {!termsExpanded ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            By signing below, you agree to all 12 sections of the Rental Agreement Terms and Conditions including definitions, indemnity, vehicle condition,
            damage responsibility, prohibited uses, insurance, charges, deposit policy, property disclaimers, breach terms, modifications, and miscellaneous provisions.
            Click "Read Full Terms" to review in detail.
          </p>
        ) : (
          <div
            className="max-h-[400px] overflow-y-auto pr-2 space-y-4 text-xs leading-relaxed scrollbar-thin"
            style={{ color: 'var(--text-secondary)' }}
          >
            <h4 className="text-sm font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
              Rental Agreement Terms and Conditions
            </h4>
            {RENTAL_TERMS.map(term => (
              <div key={term.number}>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {term.number}. {term.title}
                </p>
                <p className="text-[11px] leading-relaxed">{term.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════ ACKNOWLEDGEMENTS ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <SectionHeader icon={CheckCircle2} title="Acknowledgements" />

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
                  borderColor: acks[idx] ? 'var(--accent-color)' : fieldErrors._acks ? 'rgba(239,68,68,0.5)' : 'var(--border-medium)',
                }}
              >
                {acks[idx] && <CheckCircle2 size={12} style={{ color: 'var(--accent-fg)' }} />}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</span>
            </label>
          ))}
        </div>
        {fieldErrors._acks && <p className="text-red-400 text-xs mt-2 ml-0.5">{fieldErrors._acks}</p>}
      </div>

      {/* ════════════ SIGNATURE ════════════ */}
      <div className="rounded-xl border p-4 sm:p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <SectionHeader icon={PenTool} title="Your Signature" />

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
                borderColor: fieldErrors._signature ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
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
              onChange={e => setTypedSig(e.target.value)}
              placeholder="Type your full legal name"
              className={`w-full px-4 py-4 rounded-xl border text-2xl focus:outline-none transition-all appearance-none ${fieldErrors._signature ? 'border-red-500/60' : ''}`}
              style={{
                ...inputStyle,
                ...borderStyle('_signature'),
                fontFamily: '"Dancing Script", "Brush Script MT", cursive',
                fontStyle: 'italic',
              }}
            />
            <p className="text-[10px] mt-1 ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Your typed name will serve as your electronic signature
            </p>
          </div>
        )}
        {fieldErrors._signature && <p className="text-red-400 text-xs mt-1 ml-0.5">{fieldErrors._signature}</p>}

        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By signing, you agree to all terms and conditions of this Rental Agreement. This electronic signature is legally binding
          under the ESIGN Act (15 U.S.C. § 7001) and Florida's Uniform Electronic Transactions Act (Ch. 668, F.S.).
        </p>
      </div>

      {/* ════════════ SUBMIT ════════════ */}
      {submitError && (
        <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={`group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
          submitting ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
        whileTap={{ scale: 0.97 }}
      >
        {submitting ? (
          <><Loader2 className="animate-spin" size={18} /> Signing Agreement…</>
        ) : (
          <>Sign & Continue to Payment <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></>
        )}
      </motion.button>
    </div>
  );
}
