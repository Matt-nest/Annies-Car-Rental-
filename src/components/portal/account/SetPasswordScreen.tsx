/**
 * SetPasswordScreen — forced first-login password reset.
 * Shown whenever mustChangePassword is true (the account still has the phone#
 * temporary password). Also reusable for a voluntary password change later.
 */
import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAccountAuth } from './AccountAuthContext';
import { brand } from '../../../config/brand';

export default function SetPasswordScreen({ onDone }: { onDone?: () => void }) {
  const { setPassword, logout } = useAccountAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await setPassword(pw);
      onDone?.();
    } catch (err: any) {
      setError(err?.message || 'Could not update password');
      setBusy(false);
    }
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
        <div className="flex flex-col items-center mb-7 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: accent, boxShadow: `0 8px 24px ${accent}40` }}
          >
            <ShieldCheck size={26} color="#0a0a0a" />
          </div>
          <h1 className="text-xl font-semibold">Set your password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Choose a new password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              required
            />
          </div>

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: accent, color: '#0a0a0a', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full text-xs text-center mt-5"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Sign out
        </button>
      </motion.div>
    </div>
  );
}
