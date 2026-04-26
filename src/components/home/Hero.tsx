import { Star, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import RateToggle from './RateToggle';
import { RateMode } from '../../types';

interface HeroProps {
  onBrowseFleet: () => void;
  rateMode: RateMode;
  onRateModeChange: (mode: RateMode) => void;
}

export default function Hero({ onBrowseFleet, rateMode, onRateModeChange }: HeroProps) {
  const { theme } = useTheme();
  const { scrollY } = useScroll();
  
  // Subtle parallax effect on scroll
  const y = useTransform(scrollY, [0, 1000], [0, 250]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);

  return (
    <section className="relative h-screen flex flex-col justify-center sm:justify-end overflow-hidden pt-20 sm:pt-0 pb-16 sm:pb-32">
      {/* Background Image & Parallax Container */}
      <motion.div 
        className="absolute inset-0 z-0 origin-right"
        style={{ y, opacity }}
      >
        <img
          src="/hero-sentra-front.png"
          alt="Clean, reliable Nissan Sentra — Annie's Car Rental"
          className="w-full h-full object-cover animate-slow-zoom object-[60%_center] sm:object-[90%_center]"
          fetchPriority="high"
          decoding="async"
        />
        
        {/* Deep Studio Fade: Anchors left for readability */}
        <div
          className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.75) 25%, rgba(10,10,10,0) 70%)'
              : 'linear-gradient(to right, rgba(250,250,248,0.95) 0%, rgba(250,250,248,0.75) 25%, rgba(250,250,248,0) 70%)',
          }}
        />
        {/* Navbar Guardian Fade: Anchors top for nav contrast */}
        <div
          className="absolute inset-x-0 top-0 h-32 transition-opacity duration-700 pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to bottom, rgba(10,10,10,0.6) 0%, transparent 100%)'
              : 'linear-gradient(to bottom, rgba(250,250,248,0.6) 0%, transparent 100%)',
          }}
        />
        {/* Deep Studio Fade: Anchors bottom for framing & contrast on mobile */}
        <div
          className="absolute inset-x-0 bottom-0 h-[85%] sm:h-[60%] transition-opacity duration-700 pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to top, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.75) 30%, transparent 100%)'
              : 'linear-gradient(to top, rgba(250,250,248,0.98) 0%, rgba(250,250,248,0.75) 30%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* Content Container — Bottom-Left Anchored for Cinema Feel */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8">
        <div className="max-w-2xl">
          
          {/* Brand Logo */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE.standard, delay: 0.3 }}
            className="mb-6"
          >
            <img
              src="/logo.png"
              alt="Annie's & Co — Your Trusted Vehicle Rental"
              className="h-[72px] sm:h-[84px] md:h-[100px] w-auto object-contain"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
            />
          </motion.div>

          {/* Status Indicator (Trust & Availability) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE.standard, delay: 0.4 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <span className="absolute w-full h-full rounded-full bg-green-500 opacity-40 animate-ping" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-green-500" />
            </div>
            <span 
              className="text-xs sm:text-sm font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-secondary)' }}
            >
              Available locally in Port St. Lucie
            </span>
          </motion.div>

          {/* Headline — Familiar, elegant, structured */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, ease: EASE.dramatic, delay: 0.5 }}
            className="text-5xl sm:text-7xl md:text-8xl font-light tracking-tight leading-[0.9] mb-8"
            style={{
              color: 'var(--text-primary)',
            }}
          >
            Your ride,<br />
            <span className="italic font-serif font-normal" style={{ color: 'var(--accent-color)' }}>your way.</span>
          </motion.h1>

          {/* Subtitle — Pragmatic, Trust-Building */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 0.7 }}
            className="text-base sm:text-xl md:text-2xl font-light leading-relaxed mb-12 max-w-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            Skip the rental lines. Clean, reliable vehicles delivered directly to you across the Port St. Lucie area.
          </motion.p>

          {/* Rate Toggle — controls the fleet grid below */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 0.8 }}
            className="mb-8"
          >
            <RateToggle value={rateMode} onChange={onRateModeChange} />
          </motion.div>

          {/* Action Row — CTA flanked tightly by Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 1.0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10"
          >
            <button
              onClick={onBrowseFleet}
              className="group relative px-8 py-4 sm:px-10 sm:py-5 rounded-full font-medium transition-transform duration-500 hover:scale-[1.02] active:scale-95 text-base sm:text-lg flex items-center justify-center gap-3 overflow-hidden shadow-xl"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <span className="relative z-10 whitespace-nowrap">Reserve a Vehicle</span>
              <ArrowRight size={18} className="relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
            </button>

            {/* Native Trust Strip — replaces heavy floating badge */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {[
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&h=64&q=80',
                ].map((url, i) => (
                  <img
                    key={`avatar-hero-${i}`}
                    src={url}
                    alt="Happy Customer"
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-[3px] ring-0 object-cover shadow-sm transition-transform duration-300 hover:scale-110 hover:z-10"
                    style={{
                      border: '2px solid rgba(255,255,255,0.1)',
                      zIndex: 3 - i,
                      marginLeft: i > 0 ? -12 : 0,
                    }}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="var(--accent-color)" stroke="var(--accent-color)" />
                  ))}
                </div>
                <span className="text-sm font-medium mt-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                  Trusted by 500+<br className="hidden sm:block" /> local renters
                </span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
      
      {/* Scroll indicator - Minimal, cinematic drop-line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-0 right-6 sm:right-12 sm:bottom-0 flex flex-col items-center"
      >
        <motion.div
          className="w-px h-24 origin-top"
          style={{ backgroundColor: 'var(--text-primary)' }}
          animate={{ scaleY: [0, 1, 0], y: [0, 10, 20], opacity: [0, 0.4, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  );
}
