import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Eye, EyeOff, AlertCircle, ChevronLeft, Shield } from 'lucide-react';

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError(err.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#111928' }}>
      {/* ─── Left panel: form ──────────────────────────────────────── */}
      <div
        className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-20 py-12 relative"
        style={{ backgroundColor: '#111928' }}
      >
        {/* Back link */}
        <a
          href="https://www.anniescarrental.com"
          className="absolute top-8 left-8 sm:left-16 lg:left-20 flex items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: '#465FFF' }}
          onMouseEnter={e => e.currentTarget.style.color = '#6B7FFF'}
          onMouseLeave={e => e.currentTarget.style.color = '#465FFF'}
        >
          <ChevronLeft size={16} />
          Back to site
        </a>

        <div className="max-w-[380px] w-full mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="h-16 w-auto mb-6"
            />
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: '#F1F5F9' }}
            >
              Sign In
            </h1>
            <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>
              Enter your credentials to access the admin portal.
            </p>
          </div>

          {/* Divider — "Admin Access" */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px" style={{ backgroundColor: '#313D4F' }} />
            <div className="flex items-center gap-1.5">
              <Shield size={11} style={{ color: '#465FFF' }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
                Admin Access
              </span>
            </div>
            <div className="flex-1 h-px" style={{ backgroundColor: '#313D4F' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#CBD5E1' }}>
                Email<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  backgroundColor: '#1F2A37',
                  border: '1px solid #313D4F',
                  color: '#F1F5F9',
                }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@anniescarrental.com"
                required
                autoFocus
                onFocus={e => {
                  e.target.style.borderColor = '#465FFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(70, 95, 255, 0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#313D4F';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#CBD5E1' }}>
                Password<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{
                    backgroundColor: '#1F2A37',
                    border: '1px solid #313D4F',
                    color: '#F1F5F9',
                  }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  onFocus={e => {
                    e.target.style.borderColor = '#465FFF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(70, 95, 255, 0.15)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#313D4F';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94A3B8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Keep me logged in + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  style={{
                    accentColor: '#465FFF',
                    backgroundColor: '#1F2A37',
                    borderColor: '#313D4F',
                  }}
                  defaultChecked
                />
                <span className="text-sm" style={{ color: '#94A3B8' }}>Keep me logged in</span>
              </label>
              <button
                type="button"
                className="text-sm font-medium transition-colors"
                style={{ color: '#465FFF' }}
                onMouseEnter={e => e.currentTarget.style.color = '#6B7FFF'}
                onMouseLeave={e => e.currentTarget.style.color = '#465FFF'}
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 text-sm p-3 rounded-xl"
                style={{
                  color: '#EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                }}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #465FFF 0%, #3B4BDB 100%)',
                boxShadow: '0 4px 14px rgba(70, 95, 255, 0.3)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(70, 95, 255, 0.45)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(70, 95, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* ─── Right panel: branding ─────────────────────────────────── */}
      <div
        className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: '#1A222C' }}
      >
        {/* Ambient gradient orbs */}
        <div
          className="absolute"
          style={{
            width: 500, height: 500,
            top: '10%', left: '20%',
            background: 'radial-gradient(circle, rgba(70,95,255,0.12) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: 400, height: 400,
            bottom: '10%', right: '15%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Floating glass card */}
        <div className="relative z-10 text-center px-12">
          {/* Glass container */}
          <div
            className="rounded-3xl px-12 py-14 mx-auto max-w-[360px]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}
          >
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="w-full max-w-[220px] h-auto mx-auto mb-8"
            />
            <div
              className="h-px mx-8 mb-6"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(70,95,255,0.3), transparent)' }}
            />
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Fleet Management & Admin
              <br />
              Dashboard Portal
            </p>

            {/* Status indicators */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: '#22C55E',
                    boxShadow: '0 0 6px rgba(34, 197, 94, 0.4)',
                  }}
                />
                <span className="text-[10px] font-medium" style={{ color: '#6B7280' }}>
                  Systems Online
                </span>
              </div>
              <div style={{ width: 1, height: 12, backgroundColor: '#313D4F' }} />
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: '#465FFF',
                    boxShadow: '0 0 6px rgba(70, 95, 255, 0.4)',
                  }}
                />
                <span className="text-[10px] font-medium" style={{ color: '#6B7280' }}>
                  Secure
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Corner decorations */}
        <div className="absolute top-6 right-6 flex gap-2 opacity-40">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#465FFF' }} />
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(70,95,255,0.5)' }} />
        </div>
        <div className="absolute bottom-6 left-6 flex gap-2 opacity-40">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(70,95,255,0.5)' }} />
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#465FFF' }} />
        </div>
      </div>
    </div>
  );
}
