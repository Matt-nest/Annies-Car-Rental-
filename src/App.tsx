// SPA routing: vercel.json rewrites all paths to index.html
import { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence, motion } from 'motion/react';
import { Vehicle } from './types';
import { EASE } from './utils/motion';
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
import ContactSection from './components/home/ContactSection';
import MobileStickyCTA from './components/home/MobileStickyCTA';
import Footer from './components/layout/Footer';
import VehicleDetailPage from './components/vehicle/VehicleDetailPage';
import ConfirmBooking from './components/booking/ConfirmBooking';
import RentalAgreementPage from './components/booking/RentalAgreementPage';
import BookingStatusPage from './components/booking/BookingStatusPage';
import CustomerPortal from './components/portal/CustomerPortal';
import CustomCursor from './components/home/CustomCursor';

type Page = 'home' | 'detail' | 'confirm' | 'rental-agreement' | 'booking-status' | 'portal';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const path = window.location.pathname;
    if (path === '/confirm') return 'confirm';
    if (path === '/rental-agreement') return 'rental-agreement';
    if (path === '/booking-status') return 'booking-status';
    if (path === '/portal') return 'portal';
    return 'home';
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      if (path === '/confirm') setCurrentPage('confirm');
      else if (path === '/rental-agreement') setCurrentPage('rental-agreement');
      else if (path === '/booking-status') setCurrentPage('booking-status');
      else if (path === '/portal') setCurrentPage('portal');
      else { setCurrentPage('home'); setSelectedVehicle(null); }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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
      <AnimatePresence mode="wait">
        {currentPage === 'portal' ? (
          <motion.div
            key="portal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.dramatic }}
          >
            <CustomerPortal />
          </motion.div>
        ) : currentPage === 'booking-status' ? (
          <motion.div
            key="booking-status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.dramatic }}
          >
            <BookingStatusPage onBack={() => { setCurrentPage('home'); window.history.pushState({}, '', '/'); }} />
          </motion.div>
        ) : currentPage === 'rental-agreement' ? (
          <motion.div
            key="rental-agreement"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.dramatic }}
          >
            <RentalAgreementPage />
          </motion.div>
        ) : currentPage === 'confirm' ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.dramatic }}
          >
            <ConfirmBooking />
          </motion.div>
        ) : currentPage === 'detail' && selectedVehicle ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.dramatic }}
          >
            <VehicleDetailPage vehicle={selectedVehicle} onBack={handleBackToHome} />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE.standard }}
          >
            <Navbar onNavigate={scrollToSection} isHomePage />
            <Hero onBrowseFleet={handleBrowseFleet} />
            <HowItWorks />
            <FleetGrid onSelectVehicle={handleQuickView} />
            <TrustSection />
            <ReviewsSection />
            <InsuranceSection />
            <FAQ />
            <ContactSection onBrowseFleet={handleBrowseFleet} />
            <Footer />
            <MobileStickyCTA />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom cursor — outside page transitions, desktop-only */}
      <CustomCursor />

      {/* Quick-view modal — outside page transitions so it works on both pages */}
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
