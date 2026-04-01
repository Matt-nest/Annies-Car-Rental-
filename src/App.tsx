import React, { useState, useEffect, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Vehicle } from './types';
import { EASE, DURATION } from './utils/motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FleetGrid from './components/FleetGrid';
import QuickViewModal from './components/QuickViewModal';
import HowItWorks from './components/HowItWorks';
import TrustSection from './components/TrustSection';
import ReviewsSection from './components/ReviewsSection';
import InsuranceSection from './components/InsuranceSection';
import FAQ from './components/FAQ';
import ContactSection from './components/ContactSection';
import MobileStickyCTA from './components/MobileStickyCTA';
import Footer from './components/Footer';
import VehicleDetailPage from './components/VehicleDetailPage';
import ConfirmBooking from './components/ConfirmBooking';

// Theme context
type Theme = 'dark' | 'light';
export const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'dark',
  toggleTheme: () => {},
});
export const useTheme = () => useContext(ThemeContext);

type Page = 'home' | 'detail' | 'confirm';

/** Must stay in sync with .theme-transition CSS duration (index.css) */
const THEME_TRANSITION_MS = 600;

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return window.location.pathname === '/confirm' ? 'confirm' : 'home';
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleTheme = () => {
    setIsTransitioning(true);
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => setIsTransitioning(false), THEME_TRANSITION_MS);
  };

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
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSelectedVehicle(null);
    setTimeout(() => {
      const el = document.getElementById('fleet');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const scrollToSection = (section: string) => {
    if (currentPage !== 'home') {
      setCurrentPage('home');
      setSelectedVehicle(null);
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
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        className={`min-h-screen font-sans transition-colors duration-500 ${theme} ${
          isTransitioning ? 'theme-transition' : ''
        }`}
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <AnimatePresence mode="wait">
          {currentPage === 'confirm' ? (
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
      </div>
    </ThemeContext.Provider>
  );
}
