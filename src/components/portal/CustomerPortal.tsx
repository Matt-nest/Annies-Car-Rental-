import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Calendar, MapPin, Key, Camera, Check, AlertCircle,
  Loader2, Shield, Clock, DollarSign, MessageSquare, ArrowRight,
  Fuel, Gauge, ChevronRight, ExternalLink, X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import { API_URL } from '../../config';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import PhotoUploader from './PhotoUploader';

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

/* ── Main Component ─────────────────────────────────────── */
export default function CustomerPortal() {
  const { theme } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const bookingCode = params.get('code') || params.get('ref') || '';
  const initialEmail = params.get('email') || '';

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

  // Dispute form
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

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

      // Load lockbox if applicable
      if (['ready_for_pickup', 'active'].includes(data.status)) {
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
    if (!conditionConfirmed) return;
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
          odometer: odometer ? Number(odometer) : undefined,
          fuelLevel: fuel,
          photoUrls: checkinPhotos.length > 0 ? checkinPhotos : undefined,
          conditionConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionSuccess('Check-in complete! Your rental is now active. Drive safe! 🚗');
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
          odometer: odometer ? Number(odometer) : undefined,
          fuelLevel: fuel,
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
                {bookingCode ? (
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
                ) : (
                  <div className="mb-6 p-4 rounded-xl text-sm" style={{
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444',
                  }}>
                    <AlertCircle size={16} className="inline mr-2" />
                    No booking code found. Please use the link from your confirmation email.
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
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

          {/* Status Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="text-center"
          >
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold mb-4"
              style={{ backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.color}30` }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: sc.color }} />
              {sc.label}
            </div>
            <h1 className="text-2xl sm:text-3xl font-light mb-1" style={{ color: 'var(--text-primary)' }}>
              Booking <span className="font-mono font-bold" style={{ color: 'var(--accent-color)' }}>{booking.booking_code}</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {c?.first_name} {c?.last_name}
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

          {/* Vehicle Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            style={card(theme)}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-glow)' }}>
                  <Car size={22} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v?.year} {v?.make} {v?.model}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{v?.vehicle_code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Pickup</p>
                    <p>{fmt(booking.pickup_date)} · {fmtTime(booking.pickup_time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Return</p>
                    <p>{fmt(booking.return_date)} · {fmtTime(booking.return_time)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span>{booking.pickup_location}</span>
              </div>
            </div>
          </motion.div>

          {/* Lockbox Code (ready_for_pickup or active) */}
          {lockbox && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, ease: EASE.smooth }}
              className="p-5 rounded-2xl text-center"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <Key size={28} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>
                Lockbox Code
              </p>
              <p className="text-4xl font-bold tracking-[0.3em] font-mono" style={{ color: 'var(--text-primary)' }}>
                {lockbox}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Use this code to retrieve the key from the lockbox at the pickup location
              </p>
            </motion.div>
          )}

          {/* Self-Service Check-In (ready_for_pickup) */}
          {status === 'ready_for_pickup' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Check size={20} style={{ color: '#22c55e' }} /> Self-Service Check-In
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Confirm the vehicle condition and start your rental.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Starting Odometer</label>
                    <input type="number" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{
                      backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }} placeholder="e.g. 45320" value={odometer} onChange={e => setOdometer(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Fuel Level</label>
                    <select className="w-full px-3 py-2.5 rounded-xl text-sm" style={{
                      backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }} value={fuel} onChange={e => setFuel(e.target.value)}>
                      {['full', '3/4', '1/2', '1/4', 'empty'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                {token && (
                  <PhotoUploader
                    token={token}
                    onPhotosChange={setCheckinPhotos}
                    maxPhotos={10}
                    label="Vehicle Condition Photos"
                    hint="Take photos of the vehicle's exterior and interior before driving"
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <input type="checkbox" checked={conditionConfirmed} onChange={e => setConditionConfirmed(e.target.checked)}
                    className="w-5 h-5 rounded accent-[var(--accent-color)]" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    I confirm the vehicle is in acceptable condition
                  </span>
                </label>
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || !conditionConfirmed}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#22c55e', color: '#fff' }}
                >
                  {actionLoading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Check size={16} /> Complete Check-In</>}
                </button>
              </div>
            </motion.div>
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
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Park the vehicle, return the key to the lockbox, and complete your check-out below.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Ending Odometer</label>
                    <input type="number" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{
                      backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }} placeholder="e.g. 46120" value={odometer} onChange={e => setOdometer(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Fuel Level</label>
                    <select className="w-full px-3 py-2.5 rounded-xl text-sm" style={{
                      backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }} value={fuel} onChange={e => setFuel(e.target.value)}>
                      {['full', '3/4', '1/2', '1/4', 'empty'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                {token && (
                  <PhotoUploader
                    token={token}
                    onPhotosChange={setCheckoutPhotos}
                    maxPhotos={10}
                    label="Return Condition Photos"
                    hint="Take photos of the vehicle as you're returning it — exterior, interior, and parking spot"
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <input type="checkbox" checked={keyReturned} onChange={e => setKeyReturned(e.target.checked)}
                    className="w-5 h-5 rounded accent-[var(--accent-color)]" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    I have returned the key to the lockbox
                  </span>
                </label>
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading || !keyReturned}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}
                >
                  {actionLoading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Check size={16} /> Complete Check-Out</>}
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

          {/* Pricing Summary (always visible) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease: EASE.standard }}
            style={card(theme)}
          >
            <div className="p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Pricing</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>${booking.daily_rate}/day × {booking.rental_days} days</span>
                  <span>${booking.subtotal}</span>
                </div>
                {Number(booking.delivery_fee) > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Delivery</span><span>${booking.delivery_fee}</span>
                  </div>
                )}
                {Number(booking.discount_amount) > 0 && (
                  <div className="flex justify-between" style={{ color: '#22c55e' }}>
                    <span>Discount</span><span>-${booking.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>Tax</span><span>${booking.tax_amount}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2" style={{
                  borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                }}>
                  <span>Total</span><span>${booking.total_cost}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact footer */}
          <div className="text-center text-xs py-4" style={{ color: 'var(--text-tertiary)' }}>
            Questions? Call <a href="tel:+17729856667" style={{ color: 'var(--accent-color)' }}>(772) 985-6667</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
