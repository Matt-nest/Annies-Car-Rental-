import { Phone, Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../App';
import { EASE, DURATION } from '../utils/motion';

interface NavbarProps {
  onNavigate: (section: string) => void;
}

export default function Navbar({ onNavigate }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group cursor-pointer">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div
                className="absolute inset-0 border rounded-lg rotate-45 group-hover:rotate-[135deg] transition-transform duration-700"
                style={{ borderColor: 'var(--border-strong)' }}
              />
              <span className="relative text-xl font-serif italic" style={{ color: 'var(--text-primary)' }}>A</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-lg font-light tracking-wider" style={{ color: 'var(--text-primary)' }}>Annie's</span>
              <span className="text-[10px] font-medium tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Car Rental
              </span>
            </div>
          </button>

          {/* Desktop Nav — CSS hover via .nav-link class replaces JS handlers */}
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium">
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
              href="tel:+1234567890"
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95"
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
              <button onClick={() => setMobileOpen(false)} className="w-12 h-12 flex items-center justify-center -mr-4 transition-opacity hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
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
                href="tel:+1234567890"
                className="mt-6 px-10 py-4 rounded-full font-medium text-lg"
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
