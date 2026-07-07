// SPA routing: vercel.json rewrites all paths to index.html
import { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence, motion } from 'motion/react';
import { Vehicle, RateMode } from './types';
import { EASE, SPRING } from './utils/motion';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/layout/Navbar';
import Hero from './components/home/Hero';
import FleetGrid from './components/home/FleetGrid';
import QuickViewModal from './components/vehicle/QuickViewModal';
import HowItWorks from './components/home/HowItWorks';
import TrustSection from './components/home/TrustSection';
import ReviewsSection from './components/home/ReviewsSection';
import InsuranceSection from './components/home/InsuranceSection';
import FAQ from './components/home/FAQ';
import LongTermSection from './components/home/LongTermSection';
import ContactSection from './components/home/ContactSection';
import MobileStickyCTA from './components/home/MobileStickyCTA';
import Footer from './components/layout/Footer';
import CustomCursor from './components/home/CustomCursor';
import OfflineBanner from './components/common/OfflineBanner';
import { useScrollRestoration } from './hooks/useScrollRestoration';

/* Heavy / off-home routes are lazy-loaded so the homepage chunk stays small.
   Each becomes its own Rollup chunk, fetched only on navigation:
   - ConfirmBooking pulls in the payment SDK + signature_pad
   - CustomerPortal pulls in its own subtree
   - Legal/Status/Agreement are seldom-trafficked  */
const VehicleDetailPage   = lazy(() => import('./components/vehicle/VehicleDetailPage'));
const ConfirmBooking      = lazy(() => import('./components/booking/ConfirmBooking'));
const RentalAgreementPage = lazy(() => import('./components/booking/RentalAgreementPage'));
const BookingStatusPage   = lazy(() => import('./components/booking/BookingStatusPage'));
const CustomerPortal      = lazy(() => import('./components/portal/CustomerPortal'));
const PrivacyPolicy       = lazy(() => import('./components/legal/PrivacyPolicy'));
const TermsOfService      = lazy(() => import('./components/legal/TermsOfService'));

// Minimal fallback for lazy routes - matches the existing 100dvh hygiene pattern.
function RouteFallback() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
    >
      <div className="text-sm opacity-60">Loading…</div>
    </div>
  );
}

type Page = 'home' | 'detail' | 'confirm' | 'rental-agreement' | 'booking-status' | 'portal' | 'privacy' | 'terms';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const path = window.location.pathname;
    if (path === '/confirm' || path === '/booking') return 'confirm';
    if (path === '/rental-agreement') return 'rental-agreement';
    if (path === '/booking-status') return 'booking-status';
    if (path === '/portal') return 'portal';
    if (path === '/privacy') return 'privacy';
    if (path === '/terms') return 'terms';
    return 'home';
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
  const [rateMode, setRateMode] = useState<RateMode>('daily');
  const { markPop } = useScrollRestoration<Page>(currentPage);

  useEffect(() => {
    const handlePop = () => {
      // Flag this as a POP so useScrollRestoration restores the saved
      // scrollY for the page we're landing on instead of leaving the
      // window at wherever the previous page left off.
      markPop();
      const path = window.location.pathname;
      if (path === '/confirm' || path === '/booking') setCurrentPage('confirm');
      else if (path === '/rental-agreement') setCurrentPage('rental-agreement');
      else if (path === '/booking-status') setCurrentPage('booking-status');
      else if (path === '/portal') setCurrentPage('portal');
      else { setCurrentPage('home'); setSelectedVehicle(null); }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [markPop]);

  // Quick-view: fleet card click opens modal (desktop only, bypasses to detail on mobile)
  const handleQuickView = (vehicle: Vehicle) => {
    if (window.innerWidth < 768) {
      handleOpenDetail(vehicle);
    } else {
      setQuickViewVehicle(vehicle);
      document.body.style.overflow = 'hidden';
    }
  };

  const closeQuickView = () => {
    setQuickViewVehicle(null);
    document.body.style.overflow = '';
  };

  // Full detail page
  const handleOpenDetail = (vehicle: Vehicle) => {
    closeQuickView();
    setSelectedVehicle(vehicle);
    setCurrentPage('detail');
    window.history.pushState(null, '', `/detail?vin=${vehicle.vin}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSelectedVehicle(null);
    window.history.pushState(null, '', '/');
    setTimeout(() => {
      const el = document.getElementById('fleet');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const scrollToSection = (section: string) => {
    if (currentPage !== 'home') {
      setCurrentPage('home');
      setSelectedVehicle(null);
      window.history.pushState(null, '', '/');
      setTimeout(() => {
        if (section === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
        else document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      if (section === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
      else document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBrowseFleet = () => scrollToSection('fleet');

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <OfflineBanner />
      <AnimatePresence mode="wait">
        {currentPage === 'portal' ? (
          <motion.div
            key="portal"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <CustomerPortal />
            </Suspense>
          </motion.div>
        ) : currentPage === 'booking-status' ? (
          <motion.div
            key="booking-status"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <BookingStatusPage onBack={() => { setCurrentPage('home'); window.history.pushState({}, '', '/'); }} />
            </Suspense>
          </motion.div>
        ) : currentPage === 'privacy' ? (
          <motion.div
            key="privacy"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <PrivacyPolicy />
            </Suspense>
          </motion.div>
        ) : currentPage === 'terms' ? (
          <motion.div
            key="terms"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <TermsOfService />
            </Suspense>
          </motion.div>
        ) : currentPage === 'rental-agreement' ? (
          <motion.div
            key="rental-agreement"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <RentalAgreementPage />
            </Suspense>
          </motion.div>
        ) : currentPage === 'confirm' ? (
          <motion.div
            key="confirm"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <ConfirmBooking />
            </Suspense>
          </motion.div>
        ) : currentPage === 'detail' && selectedVehicle ? (
          <motion.div
            key="detail"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.natural}
          >
            <Suspense fallback={<RouteFallback />}>
              <VehicleDetailPage vehicle={selectedVehicle} onBack={handleBackToHome} />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="home"
            className="app-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE.standard }}
          >
            <Navbar onNavigate={scrollToSection} isHomePage />
            <Hero onBrowseFleet={handleBrowseFleet} />
            <HowItWorks />
            <FleetGrid onSelectVehicle={handleQuickView} rateMode={rateMode} onRateModeChange={setRateMode} />
            <TrustSection />
            <LongTermSection />
            <ReviewsSection />
            <InsuranceSection />
            <FAQ />
            <ContactSection onBrowseFleet={handleBrowseFleet} />
            <Footer />
            <MobileStickyCTA />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom cursor - outside page transitions, desktop-only */}
      <CustomCursor />

      {/* Quick-view modal - outside page transitions so it works on both pages */}
      <AnimatePresence>
        {quickViewVehicle && (
          <QuickViewModal
            vehicle={quickViewVehicle}
            onClose={closeQuickView}
            onViewDetails={handleOpenDetail}
          />
        )}
      </AnimatePresence>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
