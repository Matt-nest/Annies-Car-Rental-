import { Phone, Menu, X, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from 'motion/react';
import { useTheme } from '../App';
import { EASE, DURATION } from '../utils/motion';
import blackLogoSrc from '../assets/Black-ACR-logo svg.svg';

interface NavbarProps {
  onNavigate: (section: string) => void;
  isHomePage?: boolean;
}

export default function Navbar({ onNavigate, isHomePage = false }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heroLogoGone, setHeroLogoGone] = useState(false);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 50);
    // The hero logo sits at roughly 200-350px from top.
    // By ~350px of scroll it's fully off-screen.
    if (isHomePage) {
      setHeroLogoGone(latest > 350);
    }
  });

  // On non-home pages, the navbar logo should always be visible
  const showNavLogo = isHomePage ? heroLogoGone : true;

  const navLinks = [
    { label: 'Fleet', section: 'fleet' },
    { label: 'Process', section: 'how-it-works' },
    { label: 'About', section: 'trust' },
    { label: 'FAQ', section: 'faq' },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE.dramatic, delay: 0.3 }}
        className={`fixed top-0 inset-x-0 z-[100] transition-[padding,background-color,border-color] duration-500 ${
          isScrolled
            ? 'py-3 md:backdrop-blur-2xl shadow-lg'
            : 'py-5 md:py-6'
        }`}
        style={{
          backgroundColor: isScrolled
            ? theme === 'dark' ? 'rgba(10,10,10,0.97)' : 'rgba(250,250,249,0.97)'
            : 'transparent',
          borderBottom: isScrolled ? `1px solid var(--border-subtle)` : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Logo — fades in/out based on hero logo visibility; crossfades between themes */}
          <button onClick={() => onNavigate('home')} className="flex items-center group cursor-pointer">
            <div className="relative inline-flex h-[32px] md:h-[40px]">
              {/* White logo (dark mode) — also acts as layout spacer */}
              <img
                src="/logo.png"
                alt="Annie's Car Rental"
                className="h-full w-auto object-contain group-hover:brightness-110"
                style={{
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
                  opacity: showNavLogo ? (theme !== 'light' ? 1 : 0) : 0,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: showNavLogo ? 'auto' : 'none',
                }}
              />
              {/* Black logo (light mode) — absolutely overlaid */}
              <img
                src={blackLogoSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-auto object-contain"
                style={{
                  opacity: showNavLogo ? (theme === 'light' ? 1 : 0) : 0,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </button>

          {/* Desktop Nav — CSS hover via .nav-link class replaces JS handlers */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLinks.map((link) => (
              <button
                key={link.section}
                onClick={() => onNavigate(link.section)}
                className="nav-link relative py-1 group"
              >
                {link.label}
                <span
                  className="absolute -bottom-0.5 left-0 w-0 h-[1px] group-hover:w-full transition-all duration-500"
                  style={{ backgroundColor: 'var(--text-primary)' }}
                />
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 hover:scale-110"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              aria-label="Toggle theme"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: DURATION.fast, ease: EASE.smooth }}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </motion.div>
              </AnimatePresence>
            </button>

            <a
              href="tel:+17729856667"
              className="cta-glow hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Phone size={13} /> Call Now
            </a>
            <button
              className="w-11 h-11 flex items-center justify-center -mr-2 md:hidden transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.smooth }}
            className="fixed inset-0 z-[200] flex flex-col p-8"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(10,10,10,0.98)' : 'rgba(250,250,249,0.98)' }}
          >
            <div className="flex justify-end">
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="w-12 h-12 flex items-center justify-center -mr-4 transition-opacity hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                <X size={28} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-10">
              {navLinks.map((link, i) => (
                <motion.button
                  key={link.section}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 + 0.2, ease: EASE.standard }}
                  onClick={() => { onNavigate(link.section); setMobileOpen(false); }}
                  className="text-3xl font-light tracking-tight transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {link.label}
                </motion.button>
              ))}
              <motion.a
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, ease: EASE.standard }}
                href="tel:+17729856667"
                className="cta-glow mt-6 px-10 py-4 rounded-full font-medium text-lg"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Call Now
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
