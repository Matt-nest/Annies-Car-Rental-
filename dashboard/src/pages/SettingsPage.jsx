import { useState, useEffect } from 'react';
import {
  User, Users, Server, Save, Eye, EyeOff, Plus, Shield,
  ChevronDown, Check, X, RefreshCw, Lock, Mail, Phone, Info,
  ExternalLink, AlertCircle, Plug, Zap, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import { bonzahApi } from '../api/bonzah';
import { useAuth } from '../auth/AuthProvider';
import DashboardLayoutSettings from '../components/settings/DashboardLayoutSettings';
import DataError from '../components/shared/DataError';

/* ─── Role badge colors ───────────────────────────────── */
const ROLE_COLORS = {
  owner: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
  admin: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' },
  staff: { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.25)' },
  viewer: { bg: 'rgba(107, 114, 128, 0.12)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.25)' },
};

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {role}
    </span>
  );
}

/* ─── Avatar ──────────────────────────────────────────── */
function Avatar({ firstName, lastName, size = 40 }) {
  const initials = `${(firstName || '?')[0]}${(lastName || '')[0] || ''}`.toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: 'linear-gradient(135deg, #465FFF 0%, #7c3aed 100%)',
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Tab Button ──────────────────────────────────────── */
function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'text-[var(--sidebar-active-text)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
      style={active ? { backgroundColor: 'var(--sidebar-active-bg)' } : {}}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════════════════
   PROFILE TAB
   ════════════════════════════════════════════════════════ */
function ProfileTab() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Password
  const [showPwSection, setShowPwSection] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.updateMyProfile(form);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (newPw.length < 8) return setPwMsg('Password must be at least 8 characters');
    if (!/\\d/.test(newPw)) return setPwMsg('Password must contain at least one number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPw)) return setPwMsg('Password must contain at least one special character');
    if (newPw !== confirmPw) return setPwMsg('Passwords do not match');
    setPwSaving(true);
    setPwMsg('');
    try {
      await api.changePassword(newPw);
      setPwMsg('Password updated ✓');
      setNewPw('');
      setConfirmPw('');
      setShowPwSection(false);
    } catch (e) {
      setPwMsg(e.message);
    } finally {
      setPwSaving(false);
    }
  }

  if (!profile) return <div className="text-[var(--text-secondary)] text-sm">Loading profile…</div>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Avatar + role */}
      <div className="flex items-center gap-4">
        <Avatar firstName={profile.first_name} lastName={profile.last_name} size={64} />
        <div>
          <p className="text-lg font-bold text-[var(--text-primary)]">
            {profile.first_name} {profile.last_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <RoleBadge role={profile.role} />
            <span className="text-xs text-[var(--text-tertiary)]">{profile.email}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Profile Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">First Name</label>
            <input
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF] transition-colors"
              value={form.first_name}
              onChange={e => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Last Name</label>
            <input
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF] transition-colors"
              value={form.last_name}
              onChange={e => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            <Phone size={12} className="inline mr-1" />Phone
          </label>
          <input
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF] transition-colors"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="(xxx) xxx-xxxx"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            <Mail size={12} className="inline mr-1" />Email
          </label>
          <input
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] outline-none cursor-not-allowed"
            value={profile.email}
            disabled
          />
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Email cannot be changed here.</p>
        </div>

        <DataError error={error} />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #465FFF, #3B4BDB)', boxShadow: '0 4px 14px rgba(70,95,255,0.3)' }}
        >
          {saved ? <><Check size={14} /> Saved</> : saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>

      {/* Password */}
      <div className="card p-5 space-y-4">
        <button
          onClick={() => setShowPwSection(!showPwSection)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
        >
          <Lock size={14} />
          Change Password
          <ChevronDown size={14} className={`transition-transform ${showPwSection ? 'rotate-180' : ''}`} />
        </button>

        {showPwSection && (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
            />
            {pwMsg && <p className={`text-xs ${pwMsg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>{pwMsg}</p>}
            <button
              onClick={handlePasswordChange}
              disabled={pwSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#465FFF] hover:bg-[#3B4BDB] transition-colors disabled:opacity-50"
            >
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TEAM TAB
   ════════════════════════════════════════════════════════ */
function TeamTab() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', phone: '', role: 'staff', password: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    try {
      const result = await api.inviteUser(inviteForm);
      setInviteResult(result);
      setInviteForm({ email: '', first_name: '', last_name: '', phone: '', role: 'staff', password: '' });
      loadUsers();
    } catch (err) {
      setInviteResult({ error: err.message });
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.updateUserRole(userId, newRole);
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeactivate(userId) {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.deactivateUser(userId);
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleReactivate(userId) {
    try {
      await api.reactivateUser(userId);
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  }

  const isOwner = myProfile?.role === 'owner';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Team Members</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => { setShowInvite(!showInvite); setInviteResult(null); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #465FFF, #3B4BDB)', boxShadow: '0 4px 14px rgba(70,95,255,0.3)' }}
          >
            <Plus size={14} />
            Invite User
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="card p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Plus size={14} /> Invite New Team Member
          </h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              placeholder="Email *"
              type="email"
              required
              value={inviteForm.email}
              onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <input
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              placeholder="Temporary Password *"
              required
              value={inviteForm.password}
              onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
            />
            <input
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              placeholder="First Name"
              value={inviteForm.first_name}
              onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })}
            />
            <input
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              placeholder="Last Name"
              value={inviteForm.last_name}
              onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })}
            />
            <input
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              placeholder="Phone"
              value={inviteForm.phone}
              onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })}
            />
            <select
              className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#465FFF]"
              value={inviteForm.role}
              onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {inviteResult && (
            <div className={`text-xs p-3 rounded-lg ${inviteResult.error ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
              {inviteResult.error || inviteResult.message}
              {inviteResult.temp_password && (
                <p className="mt-1 font-mono">Temp password: {inviteResult.temp_password}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#465FFF] hover:bg-[#3B4BDB] transition-colors disabled:opacity-50"
            >
              {inviting ? 'Inviting…' : 'Send Invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Loading team…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                {isOwner && <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={u.first_name} lastName={u.last_name} size={32} />
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isOwner && u.id !== myProfile?.id ? (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="text-xs font-semibold uppercase px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none cursor-pointer"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                      {u.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      {u.id !== myProfile?.id && (
                        u.is_active ? (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u.id)}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors"
                          >
                            Reactivate
                          </button>
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role descriptions */}
      <div className="card p-5 space-y-3">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Shield size={12} /> Permission Levels
        </h4>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            { role: 'owner', desc: 'Full access — manage users, settings, all operations' },
            { role: 'admin', desc: 'Full operations — approve, fleet, settings (no user mgmt)' },
            { role: 'staff', desc: 'Day-to-day — manage bookings (no approvals or fleet)' },
            { role: 'viewer', desc: 'Read-only — view all data, no modifications' },
          ].map(r => (
            <div key={r.role} className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--bg-card)]">
              <RoleBadge role={r.role} />
              <span className="text-[var(--text-secondary)] leading-snug">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SYSTEM TAB
   ════════════════════════════════════════════════════════ */
function SystemTab() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await api.getSystemHealth();
        if (mounted) setHealth(res);
      } catch (err) {
        if (mounted) setHealth({ status: 'offline', error: err.message });
      } finally {
        if (mounted) setChecking(false);
      }
    };
    check();
    const intval = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(intval);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="System Status" description="Database connection & latency">
        <div className="card p-4 flex items-center gap-4 bg-[var(--bg-card)]">
          {checking && !health ? (
            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
              <RefreshCw size={14} className="animate-spin" /> Checking...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${health?.status === 'operational' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-semibold text-[var(--text-primary)] capitalize">
                  {health?.status || 'Offline'}
                </span>
              </div>
              {health?.latency_ms !== undefined && (
                <div className="text-xs text-[var(--text-tertiary)] border-l border-[var(--border-subtle)] pl-4">
                  Latency: <span className="font-mono text-[var(--text-primary)]">{health.latency_ms}ms</span>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      <div className="flex items-start gap-2.5 bg-[rgba(99,179,237,0.07)] border border-[rgba(99,179,237,0.15)] rounded-xl p-4 text-sm text-[#63b3ed]">
        <Info size={15} className="mt-0.5 shrink-0 text-[#63b3ed]" />
        <div>
          <p className="font-medium">Settings are environment variables</p>
          <p className="text-[#63b3ed] mt-0.5 text-xs">
            To change any value, update it in your{' '}
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
              Vercel dashboard <ExternalLink size={10} />
            </a>{' '}
            under the backend project → Settings → Environment Variables, then redeploy.
          </p>
        </div>
      </div>

      <Section title="Notifications" description="Email & SMS delivery services">
        <div className="space-y-0">
          <EnvRow label="Resend API Key" envKey="RESEND_API_KEY" note="Transactional emails (resend.com)" />
          <EnvRow label="From Address" envKey="EMAIL_FROM" note="e.g. Annie's Car Rental <noreply@anniescarrental.com>" />
          <EnvRow label="Twilio Account SID" envKey="TWILIO_ACCOUNT_SID" note="SMS delivery" />
          <EnvRow label="Twilio Auth Token" envKey="TWILIO_AUTH_TOKEN" />
          <EnvRow label="Twilio Phone" envKey="TWILIO_FROM_NUMBER" note="Outbound SMS number" />
          <EnvRow label="Site URL" envKey="SITE_URL" note="Used in email links and confirmation URLs" />
        </div>
      </Section>

      <Section title="Stripe" description="Payment processing">
        <div className="space-y-0">
          <EnvRow label="Secret Key" envKey="STRIPE_SECRET_KEY" note="Backend only — never expose to frontend" />
          <EnvRow label="Webhook Secret" envKey="STRIPE_WEBHOOK_SECRET" note="From Stripe dashboard → Webhooks" />
          <EnvRow label="Publishable Key" envKey="VITE_STRIPE_PUBLISHABLE_KEY" note="Frontend (customer site)" />
        </div>
      </Section>

      <Section title="Booking Automation" description="Timing for auto-expire and reminders (configured in cron)">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-[var(--bg-card)] rounded-lg p-3">
            <p className="font-medium text-[var(--text-primary)]">24 hours</p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">Approval reminder sent to admin</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg p-3">
            <p className="font-medium text-[var(--text-primary)]">48 hours</p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">Unapproved booking auto-declined</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg p-3">
            <p className="font-medium text-[var(--text-primary)]">Daily at 7 AM ET</p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">Day-of-pickup SMS reminder</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg p-3">
            <p className="font-medium text-[var(--text-primary)]">Daily at 9 AM ET</p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">Return reminder + auto-expire cron</p>
          </div>
        </div>
      </Section>

      <DashboardLayoutSettings />
    </div>
  );
}

/* ─── Shared helpers ──────────────────────────────────── */
function Section({ title, description, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function EnvRow({ label, envKey, note }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-subtle)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">{envKey}</p>
        {note && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   BONZAH TIER EDITOR — collapsible JSON editor with validation
   ════════════════════════════════════════════════════════ */
function BonzahTierEditor({ tiers, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(tiers, null, 2));
  const [parseError, setParseError] = useState('');

  // Re-sync from props when caller resets (e.g. after Save)
  useEffect(() => {
    setText(JSON.stringify(tiers, null, 2));
    setParseError('');
  }, [tiers]);

  function validateAndApply(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
      // Light schema check — each tier needs id, label, coverages
      for (const [i, t] of parsed.entries()) {
        if (!t.id || typeof t.id !== 'string') throw new Error(`Tier ${i}: missing string "id"`);
        if (!t.label || typeof t.label !== 'string') throw new Error(`Tier ${i}: missing string "label"`);
        if (!Array.isArray(t.coverages) || !t.coverages.length) throw new Error(`Tier ${i}: "coverages" must be a non-empty array`);
        const allowed = ['cdw', 'rcli', 'sli', 'pai'];
        for (const c of t.coverages) {
          if (!allowed.includes(c)) throw new Error(`Tier ${i}: unknown coverage "${c}". Allowed: ${allowed.join(', ')}`);
        }
        if (t.coverages.includes('sli') && !t.coverages.includes('rcli')) {
          throw new Error(`Tier ${i}: SLI requires RCLI (Bonzah constraint)`);
        }
      }
      setParseError('');
      onChange(parsed);
    } catch (e) {
      setParseError(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Tiers</label>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
        >
          {expanded ? 'Hide editor' : 'Edit JSON'}
        </button>
      </div>

      <div className="space-y-2">
        {tiers.map((t, i) => (
          <div key={t.id || i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">{t.label}</span>
              {t.recommended && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(70,95,255,0.15)] text-[#465FFF] font-semibold">Recommended</span>}
              {t.default && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[#22c55e] font-semibold">Default</span>}
            </div>
            <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{(t.coverages || []).join(' · ').toUpperCase()}</span>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input text-xs font-mono w-full"
            rows={Math.max(8, text.split('\n').length)}
            value={text}
            onChange={e => {
              setText(e.target.value);
              validateAndApply(e.target.value);
            }}
          />
          {parseError ? (
            <p className="text-[11px] text-[#ef4444] flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </p>
          ) : (
            <p className="text-[11px] text-[#22c55e] flex items-center gap-1">
              <Check size={12} /> Valid — click Save Changes below to persist.
            </p>
          )}
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Schema: <code className="font-mono">{`[{ id, label, coverages: ["cdw"|"rcli"|"sli"|"pai"], default?, recommended? }]`}</code>. SLI requires RCLI (Bonzah constraint, enforced).
          </p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   INTEGRATIONS TAB — Bonzah configuration + activity log
   ════════════════════════════════════════════════════════ */
function IntegrationsTab() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  async function loadSettings() {
    setLoading(true);
    setLoadErr('');
    try {
      const data = await bonzahApi.getSettings();
      setSettings(data);
      setDraft(data);
    } catch (e) {
      setLoadErr(e.message || 'Failed to load Bonzah settings');
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    setEventsLoading(true);
    try {
      const { events: rows } = await bonzahApi.getEvents({ limit: 20 });
      setEvents(rows || []);
    } catch (e) {
      console.warn('[Bonzah] events load failed:', e.message);
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => { loadSettings(); loadEvents(); }, []);

  const dirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  async function handleSave() {
    setSaving(true);
    try {
      await bonzahApi.putSettings(draft);
      setSettings(draft);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await bonzahApi.health();
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
      loadEvents(); // health check appears in event log
    }
  }

  if (loading) {
    return <div className="card p-6 flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 size={16} className="animate-spin" /> Loading Bonzah settings…</div>;
  }
  if (loadErr) {
    return <DataError message={loadErr} onRetry={loadSettings} />;
  }

  const enabled = !!draft.bonzah_enabled;
  const tiers = Array.isArray(draft.bonzah_tiers) ? draft.bonzah_tiers : [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Bonzah master card */}
      <div className="card p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(70,95,255,0.1)', color: '#465FFF' }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Bonzah Insurance</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Real-time rental insurance via the Bonzah (Insillion) API. Customer pays Annie's; Annie's settles with Bonzah monthly.
              </p>
            </div>
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5 shrink-0"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Test Connection
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
            testResult.ok
              ? 'bg-[rgba(34,197,94,0.07)] border border-[rgba(34,197,94,0.2)] text-[#22c55e]'
              : 'bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]'
          }`}>
            {testResult.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
            <div className="min-w-0">
              {testResult.ok ? (
                <p>Connected — Bonzah returned {testResult.states_returned} states in {testResult.duration_ms}ms.</p>
              ) : (
                <p>Connection failed: {testResult.error}{testResult.bonzah_txt ? ` (Bonzah: ${testResult.bonzah_txt})` : ''}</p>
              )}
              <p className="text-[10px] opacity-70 mt-0.5 font-mono">{testResult.base_url}</p>
            </div>
          </div>
        )}

        {/* Kill switch */}
        <div className="flex items-start justify-between gap-4 py-3 border-y border-[var(--border-subtle)]">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Enable Bonzah</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Master switch. When off, the customer wizard hides Bonzah entirely and falls through to "use my own insurance".
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setDraft({ ...draft, bonzah_enabled: !enabled })}
            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-[#22c55e]' : 'bg-[var(--bg-elevated)]'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Markup */}
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Markup %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.bonzah_markup_percent ?? 0}
              onChange={e => setDraft({ ...draft, bonzah_markup_percent: Number(e.target.value) })}
              className="input text-sm mt-1"
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Added on top of Bonzah's premium before the customer sees the price. We pay Bonzah the base, keep the markup.</p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Excluded States (no Bonzah)</label>
            <input
              type="text"
              value={(draft.bonzah_excluded_states || []).join(', ')}
              onChange={e => setDraft({
                ...draft,
                bonzah_excluded_states: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              })}
              className="input text-sm mt-1"
              placeholder="Michigan, New York, Pennsylvania"
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Comma-separated full state names. Wizard hides the Bonzah path when pickup is in one of these.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">PAI-Excluded States (hide Complete tier)</label>
            <input
              type="text"
              value={(draft.bonzah_pai_excluded_states || []).join(', ')}
              onChange={e => setDraft({
                ...draft,
                bonzah_pai_excluded_states: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              })}
              className="input text-sm mt-1"
              placeholder="(empty)"
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Personal Accident Insurance is not legal in some states. Customers in these states will see Essential and Standard only.</p>
          </div>
        </div>

        {/* Tiers — read-only summary + JSON editor */}
        <BonzahTierEditor tiers={tiers} onChange={(next) => setDraft({ ...draft, bonzah_tiers: next })} />

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedAt && <span className="text-xs text-[#22c55e] flex items-center gap-1"><Check size={12} /> Saved</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              dirty && !saving
                ? 'bg-[#465FFF] text-white hover:opacity-90'
                : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] cursor-not-allowed'
            }`}
          >
            {saving ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving…</span> : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Event log */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Activity</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Last 20 Bonzah API calls. Errors highlighted.</p>
          </div>
          <button
            onClick={loadEvents}
            disabled={eventsLoading}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
          >
            <RefreshCw size={12} className={eventsLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">No Bonzah activity yet. Hit "Test Connection" to verify auth.</p>
        ) : (
          <div className="space-y-1">
            {events.map(ev => (
              <div key={ev.id} className={`flex items-start gap-3 py-2 px-3 rounded-lg text-xs ${
                ev.error_text ? 'bg-[rgba(239,68,68,0.06)]' : 'hover:bg-[var(--bg-elevated)]'
              }`}>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                  ev.error_text ? 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}>
                  {ev.event_type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[var(--text-secondary)]">
                      {ev.error_text ? <span className="text-[#ef4444]">{ev.error_text}</span> : `HTTP ${ev.status_code} · ${ev.duration_ms}ms`}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 font-mono">
                      {new Date(ev.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {ev.booking_id && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono">booking: {ev.booking_id}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SETTINGS PAGE (root)
   ════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState('profile');

  const tabs = [
    { key: 'profile', label: 'My Profile', icon: User },
    ...(hasRole('owner', 'admin') ? [{ key: 'team', label: 'Team', icon: Users }] : []),
    ...(hasRole('owner', 'admin') ? [{ key: 'system', label: 'System', icon: Server }] : []),
    ...(hasRole('owner', 'admin') ? [{ key: 'integrations', label: 'Integrations', icon: Plug }] : []),
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Manage your profile, team, and system configuration.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)] pb-px">
        {tabs.map(t => (
          <TabButton key={t.key} active={tab === t.key} icon={t.icon} label={t.label} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'system' && <SystemTab />}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}
