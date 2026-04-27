import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Calendar, MapPin, Key, Camera, Check, AlertCircle,
  Loader2, Shield, DollarSign, MessageSquare, ArrowRight,
  Fuel, Gauge, ChevronRight, ChevronDown, ExternalLink, X, Star, Phone, Receipt, CreditCard,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import { API_URL } from '../../config';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import PhotoUploader from './PhotoUploader';
import SlotPhotoUploader, { type PhotoSlots } from './SlotPhotoUploader';
import CrispWidget, { openCrispChat } from './CrispWidget';

/* ── Helpers ────────────────────────────────────────────── */
const fmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};
const fmtTime = (t: string) => {
  if (!t?.includes(':')) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch { return true; }
}

/* ── Styles (inline to match main site) ─────────────────── */
const card = (theme: string) => ({
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '16px',
  overflow: 'hidden' as const,
});

/* ── Collapsible section ─────────────────────────────────── */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  rightHint,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightHint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
          <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        {rightHint && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{rightHint}</span>}
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease',
          }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE.smooth }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export default function CustomerPortal() {
  const { theme } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const initialBookingCode = params.get('code') || params.get('ref') || '';
  const initialEmail = params.get('email') || '';
  const codeFromUrl = !!initialBookingCode;

  const [bookingCode, setBookingCode] = useState(initialBookingCode);
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');

  // Check-in/out form state
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('full');
  const [conditionConfirmed, setConditionConfirmed] = useState(false);
  const [keyReturned, setKeyReturned] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [lockbox, setLockbox] = useState<string | null>(null);

  // Photo uploads
  const [checkinPhotos, setCheckinPhotos] = useState<string[]>([]);
  const [checkoutPhotos, setCheckoutPhotos] = useState<string[]>([]);
  const [disputePhotos, setDisputePhotos] = useState<string[]>([]);

  // Slot-based check-in photos (new)
  const [photoSlots, setPhotoSlots] = useState<PhotoSlots>({});
  const [allSlotsReady, setAllSlotsReady] = useState(false);

  // Dispute form
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const scrollToSection = (section: string) => {
    if (section === 'home') window.location.href = '/';
    else window.location.href = `/#${section}`;
  };

  /* ── Auth ── */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCode || !email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/portal/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setToken(data.token);
      setView('dashboard');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  /* ── Load Booking ── */
  const loadBooking = useCallback(async () => {
    if (!token) return;
    if (isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/portal/booking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBooking(data);

      // Load lockbox only when check-in is complete (active status)
      // Lockbox is gated behind check-in — not available during ready_for_pickup
      if (data.status === 'active') {
        const lb = await fetch(`${API_URL}/portal/lockbox`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).catch(() => null);
        if (lb?.lockbox_code) setLockbox(lb.lockbox_code);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => { loadBooking(); }, [loadBooking]);

  /* ── Self-Service Check-In ── */
  const handleCheckIn = async () => {
    if (!conditionConfirmed || !allSlotsReady) return;
    if (!odometer || isNaN(Number(odometer)) || Number(odometer) <= 0) {
      setError('Please enter a valid odometer reading');
      return;
    }
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          odometer: Number(odometer),
          fuelLevel: fuel,
          photoSlots,
          conditionConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // The lockbox code is returned on successful check-in — reveal it
      if (data.lockbox_code) {
        setLockbox(data.lockbox_code);
      }

      setActionSuccess('Check-in complete! Your lockbox code is below — grab your keys and drive safe! 🚗');
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  /* ── Self-Service Check-Out ── */
  const handleCheckOut = async () => {
    if (!keyReturned) return;
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          photoUrls: checkoutPhotos.length > 0 ? checkoutPhotos : undefined,
          keyReturned: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionSuccess('Check-out complete! Thank you for renting with Annie\'s. We\'ll inspect the vehicle and process your deposit shortly.');
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  /* ── Dispute ── */
  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setDisputeSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/portal/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: disputeReason, photoUrls: disputePhotos.length > 0 ? disputePhotos : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDisputeSuccess(true);
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setDisputeSubmitting(false);
  };

  /* ═══════════════════════════════════════════════════════
     LOGIN VIEW
     ═══════════════════════════════════════════════════════ */
  if (view === 'login') {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <main className="min-h-screen px-4 sm:px-6" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
              className="text-center mb-10"
            >
              <h1 className="text-3xl sm:text-4xl font-light mb-3" style={{ color: 'var(--text-primary)' }}>
                Rental{' '}
                <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>Portal</span>
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Access your booking details, check in, and check out.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-6 sm:p-8">
                {codeFromUrl && (
                  <div className="mb-6 text-center">
                    <span
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: 'var(--accent-glow)',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--accent-color)',
                      }}
                    >
                      Booking: <span className="font-mono font-bold tracking-wider">{bookingCode}</span>
                    </span>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  {!codeFromUrl && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Booking Code
                      </label>
                      <input
                        type="text"
                        required
                        autoCapitalize="characters"
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono tracking-wider transition-all duration-200"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                        placeholder="e.g. BK-20260427-MJS3"
                        value={bookingCode}
                        onChange={e => setBookingCode(e.target.value.trim())}
                        onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                      />
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        Find this in your confirmation email or text.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                      placeholder="Enter the email used for your booking"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                    }}>
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !bookingCode || !email}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: '#1c1917',
                    }}
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                    ) : (
                      <><ArrowRight size={16} /> Access My Booking</>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD VIEW
     ═══════════════════════════════════════════════════════ */
  if (!booking) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
        </main>
      </>
    );
  }

  const { status, customers: c, vehicles: v } = booking;
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending_approval: { label: 'Pending Approval', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    approved: { label: 'Approved', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    confirmed: { label: 'Confirmed', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    ready_for_pickup: { label: 'Ready for Pickup', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
    active: { label: 'Active Rental', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    returned: { label: 'Returned — Under Inspection', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    declined: { label: 'Declined', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };
  const sc = statusConfig[status] || { label: status, color: 'var(--text-secondary)', bg: 'var(--bg-card-hover)' };

  return (
    <>
      <Navbar onNavigate={scrollToSection} />
      <main className="min-h-screen px-4 sm:px-6" style={{ paddingTop: '100px', paddingBottom: '80px' }}>
        <div className="max-w-lg mx-auto space-y-5">

          {/* Compact identity header — name + booking code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="text-center"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-3"
              style={{ backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.color}30` }}
            >
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: sc.color }} />
              {sc.label}
            </div>
            <h1 className="text-xl sm:text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
              {c?.first_name} {c?.last_name}
            </h1>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {booking.booking_code}
            </p>
          </motion.div>

          {/* Success Message */}
          <AnimatePresence>
            {actionSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-xl text-sm font-medium flex items-start gap-3"
                style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}
              >
                <Check size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1">{actionSuccess}</div>
                <button onClick={() => setActionSuccess('')}><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl text-sm flex items-start gap-3" style={{
              backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button onClick={() => setError('')}><X size={14} /></button>
            </div>
          )}

          {/* ── Unified Rental Card: photo + vehicle + dates + progress bar ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            style={card(theme)}
          >
            {/* Vehicle hero photo */}
            {v?.vehicle_code && (
              <div
                className="aspect-[16/9] flex items-center justify-center p-4"
                style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f5f5f4', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <img
                  src={`/fleet/${v.vehicle_code}/hero.png`}
                  alt={`${v.year} ${v.make} ${v.model}`}
                  className="max-w-full max-h-full object-contain"
                  style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Vehicle name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                  <Car size={18} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v?.year} {v?.make} {v?.model}</p>
                  <p className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{v?.vehicle_code}</p>
                </div>
              </div>

              {/* Dates + location */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Pickup</p>
                    <p>{fmt(booking.pickup_date)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtTime(booking.pickup_time)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Return</p>
                    <p>{fmt(booking.return_date)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtTime(booking.return_time)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span>{booking.pickup_location}</span>
              </div>

              {/* Trimmed 4-step progress bar — only the milestones the customer experiences */}
              {(() => {
                const steps = [
                  { key: 'confirmed', label: 'Confirmed' },
                  { key: 'ready', label: 'Ready' },
                  { key: 'active', label: 'Active' },
                  { key: 'returned', label: 'Returned' },
                ];
                const statusToStep: Record<string, number> = {
                  pending_approval: 0, approved: 0, confirmed: 0,
                  ready_for_pickup: 1, active: 2, returned: 3, completed: 3,
                  cancelled: -1, declined: -1,
                };
                const current = statusToStep[status] ?? 0;
                if (current < 0) return null;

                return (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      Rental Progress
                    </p>
                    <div className="flex items-center gap-0" style={{ overflow: 'hidden' }}>
                      {steps.map((step, i) => {
                        const done = i <= current;
                        const isCurrent = i === current;
                        return (
                          <div key={step.key} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
                            <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
                              <div
                                className="flex items-center justify-center rounded-full transition-all"
                                style={{
                                  width: isCurrent ? 28 : 20,
                                  height: isCurrent ? 28 : 20,
                                  backgroundColor: done ? (isCurrent ? 'var(--accent-color)' : '#22c55e') : 'var(--bg-card-hover)',
                                  border: done ? 'none' : '2px solid var(--border-subtle)',
                                  boxShadow: isCurrent ? '0 0 12px rgba(212,175,55,0.4)' : 'none',
                                }}
                              >
                                {done && !isCurrent && <Check size={10} color="#fff" strokeWidth={3} />}
                                {isCurrent && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1c1917' }} />}
                              </div>
                              <span
                                className="text-[10px] font-semibold mt-1.5 whitespace-nowrap"
                                style={{ color: isCurrent ? 'var(--accent-color)' : done ? '#22c55e' : 'var(--text-tertiary)' }}
                              >
                                {step.label}
                              </span>
                            </div>
                            {i < steps.length - 1 && (
                              <div
                                style={{
                                  flex: 1,
                                  height: 2,
                                  backgroundColor: i < current ? '#22c55e' : 'var(--border-subtle)',
                                  marginTop: -14,
                                  minWidth: 8,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>

          {/* ── Add-Ons (collapsed) ───────────────────────────── */}
          {(booking.unlimited_miles || booking.unlimited_tolls || (booking.addons && booking.addons.length > 0)) && (
            <CollapsibleSection title="Your add-ons" icon={Gauge}>
              <div className="space-y-2 pt-3">
                <div className="space-y-2">
                  {(booking.unlimited_miles || booking.addons.some((a: any) => a.addon_type === 'unlimited_miles')) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                        <Gauge size={16} style={{ color: '#22c55e' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unlimited Miles</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No mileage restrictions — drive as far as you want</p>
                      </div>
                    </div>
                  )}
                  {(booking.unlimited_tolls || booking.addons.some((a: any) => a.addon_type === 'unlimited_tolls')) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
                        <Shield size={16} style={{ color: '#3b82f6' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unlimited Tolls</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>SunPass/toll coverage included</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Pickup Guide (ready_for_pickup only) ──────────── */}
          {status === 'ready_for_pickup' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease: EASE.standard }}
              className="rounded-2xl overflow-hidden"
              style={{ border: '2px solid rgba(6,182,212,0.2)', backgroundColor: 'rgba(6,182,212,0.04)' }}
            >
              <div className="p-5 space-y-4">
                {/* Pickup Address */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={18} style={{ color: '#06b6d4' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#06b6d4' }}>
                      Pickup Location
                    </h3>
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    1422 SW Giverny Ln (back of building)
                  </p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Port Saint Lucie, FL 34953
                  </p>
                  <a
                    href="https://maps.google.com/?q=1422+SW+Giverny+Ln+Port+Saint+Lucie+FL+34953"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}
                  >
                    <ExternalLink size={12} />
                    Open in Maps
                  </a>
                </div>

                {/* Step-by-step */}
                <div style={{ borderTop: '1px solid rgba(6,182,212,0.15)', paddingTop: 16 }}>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#06b6d4' }}>
                    How Pickup Works
                  </h4>
                  <div className="space-y-3">
                    {[
                      { num: '1', text: 'Walk to the back of the building' },
                      { num: '2', text: `Find your ${v?.year || ''} ${v?.make || ''} ${v?.model || ''} — it's parked and ready` },
                      { num: '3', text: 'Inspect the vehicle and complete the check-in form below' },
                      { num: '4', text: 'Once submitted, your lockbox code will be revealed' },
                      { num: '5', text: 'Open the lockbox, grab the key, and you\'re off!' },
                    ].map((step) => (
                      <div key={step.num} className="flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
                        >
                          {step.num}
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {step.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why photos */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <Camera size={12} className="inline mr-1 -mt-0.5" style={{ color: '#f59e0b' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>Why we ask for photos:</strong> They document the vehicle's condition at pickup, protecting you from being charged for any pre-existing damage.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Admin Vehicle Prep Report (ready_for_pickup) ──── */}
          {status === 'ready_for_pickup' && booking.checkinRecords && (() => {
            const prepRecord = booking.checkinRecords.find((r: any) => r.record_type === 'admin_prep');
            if (!prepRecord) return null;
            const fuelLabels: Record<string, string> = { full: 'Full', three_quarter: '¾ Tank', half: '½ Tank', quarter: '¼ Tank', empty: 'Empty' };
            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ease: EASE.standard }}
                style={card(theme)}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
                      <Shield size={16} style={{ color: '#22c55e' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Vehicle Prep Report</h3>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Your vehicle has been inspected and prepared</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {prepRecord.fuel_level && (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Fuel size={10} className="inline mr-1" />Fuel Level
                        </p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {fuelLabels[prepRecord.fuel_level] || prepRecord.fuel_level}
                        </p>
                      </div>
                    )}
                    {prepRecord.odometer && (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Gauge size={10} className="inline mr-1" />Odometer
                        </p>
                        <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {Number(prepRecord.odometer).toLocaleString()} mi
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin prep photos */}
                  {prepRecord.photo_urls && prepRecord.photo_urls.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        <Camera size={10} className="inline mr-1" />Inspection Photos
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {prepRecord.photo_urls.slice(0, 4).map((url: string, i: number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            <img src={url} alt={`Prep ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* ── Customer Check-In Record (collapsed; active / returned / completed) ── */}
          {['active', 'returned', 'completed'].includes(status) && booking.checkinRecords && (() => {
            const customerCheckin = booking.checkinRecords.find((r: any) => r.record_type === 'customer_checkin');
            if (!customerCheckin) return null;
            const allPhotos = customerCheckin.photo_urls || [];
            const fuelLabels: Record<string, string> = { full: 'Full', three_quarter: '¾ Tank', half: '½ Tank', quarter: '¼ Tank', empty: 'Empty' };

            return (
              <CollapsibleSection
                title="Your check-in record"
                icon={Camera}
                rightHint={customerCheckin.created_at ? fmt(customerCheckin.created_at) : undefined}
              >
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Gauge size={10} className="inline mr-1" />Odometer
                      </p>
                      <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                        {customerCheckin.odometer ? Number(customerCheckin.odometer).toLocaleString() : '—'} mi
                      </p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Fuel size={10} className="inline mr-1" />Fuel Level
                      </p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fuelLabels[customerCheckin.fuel_level] || customerCheckin.fuel_level || '—'}
                      </p>
                    </div>
                  </div>

                  {allPhotos.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        Pickup photos
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {allPhotos.map((url: string, i: number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            <img src={url} alt={`Check-in ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Self-Service Check-In (ready_for_pickup) */}
          {status === 'ready_for_pickup' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-5 space-y-5">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Check size={20} style={{ color: '#22c55e' }} /> Start Your Rental
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Inspect the vehicle, take photos from each angle, record the odometer and fuel level, then confirm to start your rental.
                </p>

                {/* Photo Slots */}
                {token && (
                  <SlotPhotoUploader
                    token={token}
                    onSlotsChange={(slots, ready) => {
                      setPhotoSlots(slots);
                      setAllSlotsReady(ready);
                    }}
                  />
                )}

                {/* Odometer + Fuel */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <Gauge size={12} className="inline mr-1" />Odometer *
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="e.g. 42350"
                      value={odometer}
                      onChange={e => setOdometer(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <Fuel size={12} className="inline mr-1" />Fuel Level *
                    </label>
                    <select
                      value={fuel}
                      onChange={e => setFuel(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        appearance: 'none' as const,
                      }}
                    >
                      <option value="full">Full</option>
                      <option value="three_quarter">¾ Tank</option>
                      <option value="half">½ Tank</option>
                      <option value="quarter">¼ Tank</option>
                      <option value="empty">Empty</option>
                    </select>
                  </div>
                </div>

                {/* Condition Confirmation */}
                <label className="flex items-start gap-3 cursor-pointer py-3 px-4 rounded-xl transition-all" style={{
                  backgroundColor: conditionConfirmed ? 'rgba(34,197,94,0.08)' : 'var(--bg-card-hover)',
                  border: conditionConfirmed ? '2px solid rgba(34,197,94,0.3)' : '2px solid var(--border-subtle)',
                }}>
                  <input type="checkbox" checked={conditionConfirmed} onChange={e => setConditionConfirmed(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#22c55e] mt-0.5 shrink-0" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    I've inspected the vehicle and confirm it's in acceptable condition. I understand these photos document its state at pickup.
                  </span>
                </label>

                {/* Submit */}
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || !conditionConfirmed || !allSlotsReady || !odometer}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#22c55e', color: '#fff', minHeight: '52px' }}
                >
                  {actionLoading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><ArrowRight size={16} /> Start My Rental</>}
                </button>

                {!allSlotsReady && (
                  <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                    Upload all 4 required photos to enable check-in
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Lockbox Code — only revealed AFTER successful check-in */}
          <AnimatePresence>
            {lockbox && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, ease: EASE.dramatic }}
                className="p-6 sm:p-8 rounded-2xl text-center"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.25)' }}
              >
                <Key size={36} className="mx-auto mb-4" style={{ color: '#f59e0b' }} />
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#f59e0b' }}>
                  Your Lockbox Code
                </p>
                <p className="text-5xl sm:text-6xl font-black tracking-[0.4em] font-mono mb-4" style={{ color: 'var(--text-primary)' }}>
                  {lockbox}
                </p>
                <button
                  onClick={() => { navigator.clipboard.writeText(lockbox); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  Tap to Copy
                </button>
                <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
                  Use this code to retrieve the key from the lockbox at the pickup location.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Emergency tap-to-call (active, always visible) ── */}
          {status === 'active' && (
            <motion.a
              href="tel:+17729856667"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, ease: EASE.standard }}
              className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <Phone size={16} style={{ color: '#ef4444' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#ef4444' }}>Emergency · Tap to call</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>(772) 985-6667</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
            </motion.a>
          )}

          {/* ── Safety & return guide (active, collapsed) ── */}
          {status === 'active' && (
            <CollapsibleSection title="Safety & return guide" icon={Shield}>
              <div className="space-y-2 pt-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>
                    <AlertCircle size={11} className="inline mr-1 -mt-0.5" /> If You're in an Accident
                  </p>
                  <ol className="text-xs leading-relaxed space-y-0.5 pl-4" style={{ color: 'var(--text-secondary)', listStyleType: 'decimal' }}>
                    <li>Ensure everyone is safe — call 911 if needed</li>
                    <li>Exchange info with the other driver</li>
                    <li>Take photos of all vehicles and the scene</li>
                    <li>Call Annie at (772) 985-6667 immediately</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    <Key size={11} className="inline mr-1 -mt-0.5" style={{ color: 'var(--accent-color)' }} /> Returning the Vehicle
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Park at the pickup location, place the key back in the lockbox, and complete the return form below.
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Self-Service Check-Out (active) */}
          {status === 'active' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Car size={20} style={{ color: 'var(--accent-color)' }} /> Return Your Vehicle
                </h3>
                <div className="p-4 rounded-xl text-sm space-y-2" style={{
                  backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                }}>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Return Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Park the vehicle in the designated spot</li>
                    <li>Place the key back in the lockbox</li>
                    <li>Take a few photos of the vehicle (optional)</li>
                    <li>Confirm the return below</li>
                  </ol>
                </div>
                {token && (
                  <PhotoUploader
                    token={token}
                    onPhotosChange={setCheckoutPhotos}
                    maxPhotos={10}
                    label="Return Condition Photos"
                    hint="Take a few photos of the vehicle as you leave it — this protects you in case of disputes"
                  />
                )}
                <label className="flex items-start gap-3 cursor-pointer py-3 px-4 rounded-xl transition-all" style={{
                  backgroundColor: keyReturned ? 'rgba(200,169,126,0.08)' : 'var(--bg-card-hover)',
                  border: keyReturned ? '2px solid rgba(200,169,126,0.3)' : '2px solid var(--border-subtle)',
                }}>
                  <input type="checkbox" checked={keyReturned} onChange={e => setKeyReturned(e.target.checked)}
                    className="w-5 h-5 rounded accent-[var(--accent-color)] mt-0.5 shrink-0" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    I have returned the key to the lockbox and the vehicle is parked
                  </span>
                </label>
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading || !keyReturned}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917', minHeight: '52px' }}
                >
                  {actionLoading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Check size={16} /> Complete Return</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* Deposit & Invoice (returned / completed) */}
          {['returned', 'completed'].includes(status) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <DollarSign size={20} style={{ color: 'var(--accent-color)' }} /> Settlement
                </h3>

                {/* Deposit */}
                {booking.deposit && (
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{
                    backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Security Deposit</p>
                      <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {money(booking.deposit.amount)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full capitalize" style={{
                      backgroundColor: booking.deposit.status === 'refunded' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      color: booking.deposit.status === 'refunded' ? '#22c55e' : '#f59e0b',
                    }}>
                      {booking.deposit.status}
                    </span>
                  </div>
                )}

                {/* Invoice */}
                {booking.invoice && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Invoice</p>
                    {(booking.invoice.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
                        <span className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(item.amount)}</span>
                      </div>
                    ))}
                    {booking.invoice.amount_due > 0 && (
                      <div className="flex justify-between font-semibold pt-2" style={{ color: 'var(--text-primary)' }}>
                        <span>Amount Due</span>
                        <span className="tabular-nums">{money(booking.invoice.amount_due)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dispute */}
                {booking.invoice && !disputeSuccess && (
                  <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Disagree with a charge?
                    </p>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-xl text-sm resize-none mb-3"
                      rows={3}
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="Explain what you disagree with…"
                      value={disputeReason}
                      onChange={e => setDisputeReason(e.target.value)}
                    />
                    {token && (
                      <PhotoUploader
                        token={token}
                        onPhotosChange={setDisputePhotos}
                        maxPhotos={5}
                        label="Supporting Photos"
                        hint="Upload photos that support your dispute (optional)"
                      />
                    )}
                    <button
                      onClick={handleDispute}
                      disabled={disputeSubmitting || !disputeReason.trim()}
                      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      <MessageSquare size={13} />
                      {disputeSubmitting ? 'Submitting…' : 'Submit Dispute'}
                    </button>
                  </div>
                )}

                {disputeSuccess && (
                  <div className="p-3 rounded-xl text-sm" style={{
                    backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e',
                  }}>
                    <Check size={14} className="inline mr-2" />
                    Your dispute has been submitted. We'll review it and follow up within 24 hours.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Review prompt — completed rentals only */}
          {status === 'completed' && !reviewDone && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Star size={16} style={{ color: '#D4AF37' }} /> How was your rental?
                </h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewRating(n)}
                      className="transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                    >
                      <Star
                        size={28}
                        fill={n <= reviewRating ? '#D4AF37' : 'none'}
                        stroke={n <= reviewRating ? '#D4AF37' : 'var(--text-tertiary)'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Tell Annie how it went…"
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
                <button
                  disabled={reviewSubmitting || !reviewComment.trim()}
                  onClick={async () => {
                    setReviewSubmitting(true);
                    try {
                      await fetch(`${API_URL}/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          booking_code: bookingCode,
                          reviewer_name: booking?.customer_name || 'Guest',
                          rating: reviewRating,
                          comment: reviewComment.trim(),
                          vehicle_name: booking?.vehicle_name || undefined,
                        }),
                      });
                    } catch { /* show success regardless */ }
                    setReviewDone(true);
                    setReviewSubmitting(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: '#D4AF37', color: '#0a0a0a' }}
                >
                  {reviewSubmitting ? 'Sending…' : 'Submit Review'}
                </button>
              </div>
            </motion.div>
          )}
          {status === 'completed' && reviewDone && (
            <div className="rounded-2xl p-4 text-center text-sm" style={{
              backgroundColor: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37',
            }}>
              Thank you — Annie appreciates the feedback!
            </div>
          )}

          {/* ── Itemized Receipt (collapsed) ──────────────────── */}
          {(() => {
            const fmtMoney = (n: any) => `$${Number(n || 0).toFixed(2)}`;
            const rentalPayment = (booking.payments || []).find((p: any) => p.payment_type === 'rental' && p.status === 'completed');
            const depositPayment = (booking.payments || []).find((p: any) => p.payment_type === 'deposit' && p.status === 'completed');
            const totalPaid = (booking.payments || [])
              .filter((p: any) => p.status === 'completed')
              .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            const paidAt = rentalPayment?.paid_at || depositPayment?.paid_at;
            const methodLabel = rentalPayment
              ? (rentalPayment.method === 'stripe' ? 'Card via Stripe' : rentalPayment.method)
              : null;
            const totalHint = totalPaid > 0 ? fmtMoney(totalPaid) : fmtMoney(booking.total_cost);

            return (
              <CollapsibleSection title="Itemized receipt" icon={Receipt} rightHint={totalHint}>
                <div className="space-y-4 pt-3 text-sm">
                  {/* Payment header */}
                  {(methodLabel || paidAt) && (
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                        <CreditCard size={14} style={{ color: 'var(--accent-color)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{methodLabel || 'Payment on file'}</p>
                        {paidAt && (
                          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            Paid {fmt(paidAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Charges */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Rental Charges</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>{fmtMoney(booking.daily_rate)}/day × {booking.rental_days} day{booking.rental_days !== 1 ? 's' : ''}</span>
                        <span>{fmtMoney(booking.subtotal)}</span>
                      </div>
                      {Number(booking.delivery_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Delivery fee</span>
                          <span>{fmtMoney(booking.delivery_fee)}</span>
                        </div>
                      )}
                      {Number(booking.mileage_addon_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Unlimited miles add-on</span>
                          <span>{fmtMoney(booking.mileage_addon_fee)}</span>
                        </div>
                      )}
                      {Number(booking.toll_addon_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Unlimited tolls add-on</span>
                          <span>{fmtMoney(booking.toll_addon_fee)}</span>
                        </div>
                      )}
                      {Number(booking.discount_amount) > 0 && (
                        <div className="flex justify-between" style={{ color: '#22c55e' }}>
                          <span>Discount</span>
                          <span>-{fmtMoney(booking.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>FL sales tax</span>
                        <span>{fmtMoney(booking.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2" style={{
                        borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                      }}>
                        <span>Rental total</span>
                        <span>{fmtMoney(booking.total_cost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit */}
                  {Number(booking.deposit_amount) > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Security Deposit</p>
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>Refundable hold</span>
                        <span>{fmtMoney(booking.deposit_amount)}</span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Returned 3–5 business days after vehicle inspection.
                      </p>
                    </div>
                  )}

                  {/* Total charged */}
                  {totalPaid > 0 && (
                    <div className="flex justify-between font-bold pt-3" style={{
                      borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }}>
                      <span>Total charged</span>
                      <span className="font-mono">{fmtMoney(totalPaid)}</span>
                    </div>
                  )}

                  {/* Payment ledger */}
                  {(booking.payments || []).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Payment History</p>
                      <div className="space-y-1.5">
                        {booking.payments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span className="capitalize">{p.payment_type} · {p.status}{p.paid_at ? ` · ${fmt(p.paid_at)}` : ''}</span>
                            <span className="font-mono">{fmtMoney(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Contact footer */}
          <div className="flex flex-col items-center gap-3 py-5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <button
              onClick={() => {
                try { openCrispChat(); }
                catch { window.location.href = 'tel:+17729856667'; }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
              style={{ backgroundColor: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}
            >
              <MessageSquare size={14} />
              Message Annie
            </button>
            <span>
              Or call <a href="tel:+17729856667" style={{ color: 'var(--accent-color)' }}>(772) 985-6667</a>
            </span>
          </div>
        </div>
      </main>
      <Footer />
      {view === 'dashboard' && <CrispWidget booking={booking} />}
    </>
  );
}
