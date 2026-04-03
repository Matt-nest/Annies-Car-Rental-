import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search, CheckCircle2, Clock, XCircle, Car, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatTime } from '../../utils/formatting';
import { API_URL } from '../../config';

interface BookingStatus {
  booking_code: string;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string;
  return_time: string;
  pickup_location: string;
  vehicle: string | null;
  next_step: { label: string; detail: string };
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; bg: string }> = {
  pending_approval: { color: 'text-amber-500',  icon: Clock,         bg: 'bg-amber-50' },
  approved:         { color: 'text-blue-500',   icon: AlertCircle,   bg: 'bg-blue-50' },
  confirmed:        { color: 'text-blue-600',   icon: CheckCircle2,  bg: 'bg-blue-50' },
  active:           { color: 'text-green-600',  icon: CheckCircle2,  bg: 'bg-green-50' },
  returned:         { color: 'text-purple-600', icon: CheckCircle2,  bg: 'bg-purple-50' },
  completed:        { color: 'text-green-700',  icon: CheckCircle2,  bg: 'bg-green-50' },
  declined:         { color: 'text-red-500',    icon: XCircle,       bg: 'bg-red-50' },
  cancelled:        { color: 'text-red-500',    icon: XCircle,       bg: 'bg-red-50' },
};

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}



interface Props {
  onBack: () => void;
}

export default function BookingStatusPage({ onBack }: Props) {
  const { theme } = useTheme();
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || '';
  });
  const [result, setResult] = useState<BookingStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-lookup if code came from URL
  useEffect(() => {
    if (code.length >= 4) handleLookup();
  }, []);

  async function handleLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/bookings/status/${code.trim().toUpperCase()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Booking not found.');
      } else {
        setResult(await res.json());
      }
    } catch {
      setError('Could not connect. Please try again or call (772) 985-6667.');
    }
    setLoading(false);
  }

  const cfg = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG.pending_approval) : null;
  const StatusIcon = cfg?.icon || Clock;

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-subtle)',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span style={{ color: 'var(--border-subtle)' }}>·</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Annie's Car Rental</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Check Booking Status</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enter the reference code from your confirmation</p>
          </div>

          {/* Lookup form */}
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB7X"
              maxLength={8}
              className="flex-1 px-4 h-12 rounded-xl border text-sm font-mono tracking-widest focus:outline-none transition-all uppercase"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="h-12 px-5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <Search size={16} />
              {loading ? 'Looking…' : 'Look up'}
            </button>
          </form>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl border text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <XCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && cfg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}
            >
              {/* Status banner */}
              <div className={`px-5 py-4 ${cfg.bg} border-b`} style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2.5">
                  <StatusIcon size={18} className={cfg.color} />
                  <div>
                    <p className={`font-semibold text-sm ${cfg.color}`}>{result.next_step.label}</p>
                    <p className="text-xs text-stone-600 mt-0.5">{result.next_step.detail}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Booking code */}
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Reference</span>
                  <span className="font-mono font-bold tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>{result.booking_code}</span>
                </div>

                {result.vehicle && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      <Car size={13} />
                      <span className="text-xs">Vehicle</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{result.vehicle}</span>
                  </div>
                )}

                <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      <Calendar size={13} />
                      <span className="text-xs">Pickup</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(result.pickup_date)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatTime(result.pickup_time)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      <Calendar size={13} />
                      <span className="text-xs">Return</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(result.return_date)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatTime(result.return_time)}</p>
                    </div>
                  </div>
                  {result.pickup_location && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        <MapPin size={13} />
                        <span className="text-xs">Location</span>
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.pickup_location}</span>
                    </div>
                  )}
                </div>

                {/* CTA for approved status */}
                {result.status === 'approved' && (
                  <a
                    href={`/confirm?code=${result.booking_code}`}
                    className="block w-full text-center py-3 rounded-xl font-medium text-sm transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    Complete Your Booking →
                  </a>
                )}
              </div>
            </motion.div>
          )}

          <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Need help? Call us at{' '}
            <a href="tel:+17729856667" className="underline">(772) 985-6667</a>
          </p>
        </div>
      </div>
    </div>
  );
}
