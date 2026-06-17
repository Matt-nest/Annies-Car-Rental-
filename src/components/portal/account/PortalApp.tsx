/**
 * PortalApp — entry point for the customer portal at /portal.
 *
 * Account-first: renders the login → (forced password reset) → tabbed app.
 * Legacy fallback: a /portal?code=XXXX deep link (from booking notification
 * emails / one-off public bookings) still renders the original code+email
 * CustomerPortal, so no existing link breaks.
 *
 * Phase 3a ships the shell (auth, bottom-nav, Trips + Profile). Trip detail,
 * payments, and messaging tabs are added in later phases.
 */
import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, User, CreditCard, Loader2 } from 'lucide-react';
import { AccountAuthProvider, useAccountAuth } from './AccountAuthContext';
import LoginScreen from './LoginScreen';
import SetPasswordScreen from './SetPasswordScreen';
import TripsScreen from './screens/TripsScreen';
import TripDetailScreen from './screens/TripDetailScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import { brand } from '../../../config/brand';

const LegacyPortal = lazy(() => import('../CustomerPortal'));

type TabKey = 'trips' | 'wallet' | 'profile';
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'trips', label: 'Trips', icon: Car },
  { key: 'wallet', label: 'Wallet', icon: CreditCard },
  { key: 'profile', label: 'Profile', icon: User },
];

function FullScreenLoader() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
    >
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function AuthedShell() {
  const [tab, setTab] = useState<TabKey>('trips');
  // Trip detail is a push-on-top view over the Trips tab.
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const accent = brand.colors.accent;

  // Tapping a tab always returns to its root.
  function selectTab(next: TabKey) {
    setOpenTripId(null);
    setTab(next);
  }

  const viewKey = openTripId ? `trip-${openTripId}` : tab;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Scrollable content with bottom padding so the nav never overlaps it */}
      <div className="pb-24 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {openTripId ? (
              <TripDetailScreen tripId={openTripId} onBack={() => setOpenTripId(null)} />
            ) : tab === 'trips' ? (
              <TripsScreen onOpenTrip={setOpenTripId} />
            ) : tab === 'wallet' ? (
              <WalletScreen />
            ) : (
              <ProfileScreen />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom tab bar (Turo-style) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="max-w-md mx-auto flex">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => selectTab(key)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5"
                style={{ color: active ? accent : 'var(--text-tertiary)' }}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function PortalGate() {
  const { token, loading, mustChangePassword } = useAccountAuth();

  if (loading) return <FullScreenLoader />;
  if (!token) return <LoginScreen />;
  if (mustChangePassword) return <SetPasswordScreen />;
  return <AuthedShell />;
}

export default function PortalApp() {
  // Legacy deep link: /portal?code=XXXX → original code+email portal.
  const params = new URLSearchParams(window.location.search);
  const hasBookingCode = !!(params.get('code') || params.get('ref'));

  if (hasBookingCode) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <LegacyPortal />
      </Suspense>
    );
  }

  return (
    <AccountAuthProvider>
      <PortalGate />
    </AccountAuthProvider>
  );
}
