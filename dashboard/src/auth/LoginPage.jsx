import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Eye, EyeOff, AlertCircle, ChevronLeft } from 'lucide-react';

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
    <div className="min-h-screen flex">
      {/* ─── Left panel: form ──────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-20 py-12 bg-white relative">
        {/* Back link */}
        <a
          href="https://www.anniescarrental.com"
          className="absolute top-8 left-8 sm:left-16 lg:left-20 flex items-center gap-1 text-sm text-[#4F46E5] hover:text-[#3730A3] transition-colors font-medium"
        >
          <ChevronLeft size={16} />
          Back to site
        </a>

        <div className="max-w-[380px] w-full mx-auto">
          {/* Heading */}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sign In</h1>
          <p className="text-sm text-gray-500 mt-2 mb-8">
            Enter your email and password to sign in!
          </p>

          {/* Divider — "Or" */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">Admin Access</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email<span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="info@gmail.com"
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password<span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
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
                  className="w-4 h-4 rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]/20"
                  defaultChecked
                />
                <span className="text-sm text-gray-600">Keep me logged in</span>
              </label>
              <button
                type="button"
                className="text-sm text-[#4F46E5] hover:text-[#3730A3] font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm p-3 rounded-xl text-red-600 bg-red-50 border border-red-100">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60"
              style={{ backgroundColor: '#4F46E5' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#4338CA')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4F46E5')}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* ─── Right panel: branding ─────────────────────────────────── */}
      <div
        className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: '#1E2875' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(45deg, rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(-45deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Decorative corner blocks — top right */}
        <div className="absolute top-8 right-8 flex gap-2">
          <div className="w-8 h-8 rounded bg-white/[0.06]" />
          <div className="w-8 h-8 rounded bg-white/[0.04]" />
        </div>
        <div className="absolute top-[52px] right-8">
          <div className="w-8 h-8 rounded bg-white/[0.03]" />
        </div>

        {/* Decorative bottom blocks */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-8 h-8 rounded bg-white/[0.06]" />
          <div className="w-8 h-8 rounded bg-white/[0.04]" />
          <div className="w-8 h-8 rounded bg-white/[0.03]" />
        </div>

        {/* Logo + tagline */}
        <div className="relative z-10 text-center px-12">
          <img
            src="/logo-light.png"
            alt="Annie's & Co"
            className="h-[100px] w-auto mx-auto mb-6"
          />
          <p className="text-white/60 text-sm leading-relaxed max-w-[280px] mx-auto">
            Secure Fleet Management & Admin
            <br />
            Dashboard Portal
          </p>
        </div>
      </div>
    </div>
  );
}
