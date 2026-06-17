/**
 * LoginScreen — account-first portal login (username + password).
 * Username = FirstName + Last initial; first password = phone number (handed
 * over by the admin). Mobile-first, Turo-style centered card.
 */
import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Loader2, Eye, EyeOff, Car } from 'lucide-react';
import { useAccountAuth } from './AccountAuthContext';
import { brand } from '../../../config/brand';

export default function LoginScreen() {
  const { login } = useAccountAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Could not sign in');
      setBusy(false);
    }
    // On success the provider flips state and this screen unmounts.
  }

  const accent = brand.colors.accent;

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: accent, boxShadow: `0 8px 24px ${accent}40` }}
          >
            <Car size={26} color="#0a0a0a" />
          </div>
          <h1 className="text-xl font-semibold">{brand.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Sign in to manage your rentals
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Username
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. johns"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your phone number to start"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: accent, color: '#0a0a0a', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-center mt-6 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          First time? Your username and temporary password were provided by {brand.name}.
          Need help? Call{' '}
          <a href={`tel:${brand.phone}`} style={{ color: accent }}>{brand.phone}</a>.
        </p>
      </motion.div>
    </div>
  );
}
