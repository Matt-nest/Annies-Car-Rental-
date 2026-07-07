import { Star, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import { brand } from '../../config/brand';

interface HeroProps {
  onBrowseFleet: () => void;
}

export default function Hero({ onBrowseFleet }: HeroProps) {
  const { theme } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const { scrollY } = useScroll();

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduceMotion(mobile || prefersReduced);
  }, []);

  const y = useTransform(scrollY, (v) => (reduceMotion ? 0 : v * 0.25));
  const opacity = useTransform(scrollY, (v) => (reduceMotion ? 1 : Math.max(0, 1 - v / 600)));

  return (
    <section className="relative min-h-dvh min-h-svh flex flex-col overflow-x-clip overflow-y-hidden">
      {/* Background */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y, opacity }}
      >
        <video
          className="w-full h-full object-cover object-[65%_center] sm:object-[72%_center]"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero-poster.jpg"
          aria-label={`Clean, reliable vehicles in Tradition Town Center — ${brand.name}`}
        >
          <source src="/hero-motion.mp4" type="video/mp4" />
        </video>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.75) 25%, rgba(10,10,10,0) 70%)'
              : 'linear-gradient(to right, rgba(250,250,248,0.95) 0%, rgba(250,250,248,0.75) 25%, rgba(250,250,248,0) 70%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-36 pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to bottom, rgba(10,10,10,0.75) 0%, transparent 100%)'
              : 'linear-gradient(to bottom, rgba(250,250,248,0.75) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[88%] sm:h-[60%] pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to top, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.8) 35%, transparent 100%)'
              : 'linear-gradient(to top, rgba(250,250,248,0.98) 0%, rgba(250,250,248,0.8) 35%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* Content — bottom-anchored on mobile; only reserve bottom space for sticky CTA */}
      <div
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 safe-x mt-auto min-w-0"
        style={{
          paddingBottom: 'max(7.5rem, calc(env(safe-area-inset-bottom) + 6.5rem))',
        }}
      >
        <div className="max-w-2xl w-full min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE.standard, delay: 0.3 }}
            className="mb-4 sm:mb-6"
          >
            <img
              src="/logo.png"
              alt={`${brand.name}: Your Trusted Vehicle Rental`}
              className="h-14 sm:h-[84px] md:h-[100px] w-auto max-w-[min(100%,280px)] object-contain object-left"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE.standard, delay: 0.4 }}
            className="flex items-center gap-3 mb-5 sm:mb-8"
          >
            <div className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
              <span className="absolute w-full h-full rounded-full bg-green-500 opacity-40 animate-ping" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-green-500" />
            </div>
            <span
              className="text-[11px] sm:text-sm font-semibold tracking-wide uppercase leading-snug"
              style={{ color: 'var(--text-secondary)' }}
            >
              Available locally in Port St. Lucie
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, ease: EASE.dramatic, delay: 0.5 }}
            className="text-[2.35rem] sm:text-7xl md:text-8xl font-light tracking-tight leading-[0.95] mb-5 sm:mb-8 max-w-full"
            style={{ color: 'var(--text-primary)' }}
          >
            Your ride,<br />
            <span className="italic font-serif font-normal" style={{ color: 'var(--accent-color)' }}>your way.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 0.7 }}
            className="text-[15px] sm:text-xl md:text-2xl font-light leading-relaxed mb-8 sm:mb-12 max-w-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="block font-medium mb-1" style={{ color: theme === 'dark' ? '#ffffff' : 'var(--accent-color)' }}>
              Daily · Weekly · All Season.
            </span>
            Clean, reliable vehicles delivered directly to you across the Port St. Lucie / Treasure Coast area.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 0.9 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-10 w-full min-w-0"
          >
            <button
              onClick={onBrowseFleet}
              className="group relative w-full sm:w-auto px-8 py-4 sm:px-10 sm:py-5 rounded-full font-medium transition-transform duration-500 hover:scale-[1.02] active:scale-95 text-base sm:text-lg flex items-center justify-center gap-3 overflow-hidden shadow-xl shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <span className="relative z-10 whitespace-nowrap">Reserve a Vehicle</span>
              <ArrowRight size={18} className="relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-3 shrink-0">
                {[
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&h=64&q=80',
                ].map((url, i) => (
                  <img
                    key={`avatar-hero-${i}`}
                    src={url}
                    alt=""
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-[3px] ring-0 object-cover shadow-sm"
                    style={{
                      border: '2px solid rgba(255,255,255,0.1)',
                      zIndex: 3 - i,
                      marginLeft: i > 0 ? -10 : 0,
                    }}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} fill="var(--accent-color)" stroke="var(--accent-color)" />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium mt-0.5 leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
                  Trusted by 1,200+ local renters
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="hidden sm:flex absolute bottom-0 right-6 sm:right-12 flex-col items-center pointer-events-none"
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
