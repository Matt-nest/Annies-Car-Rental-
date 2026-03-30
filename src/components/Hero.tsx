import { Sparkles, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { EASE, DURATION } from '../utils/motion';

interface HeroProps {
  onBrowseFleet: () => void;
}

export default function Hero({ onBrowseFleet }: HeroProps) {
  const { theme } = useTheme();

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background image — Nissan Sentra hero */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-sentra.png"
          alt="Nissan Sentra — Annie's Car Rental, Port St. Lucie"
          className="w-full h-full object-cover animate-slow-zoom"
          style={{ objectPosition: 'center 70%' }}
          fetchPriority="high"
        />
        {/* Primary gradient — text contrast */}
        <div
          className="absolute inset-0"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to bottom, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.25) 35%, rgba(10,10,10,0.15) 50%, rgba(10,10,10,0.6) 85%, rgba(10,10,10,0.85) 100%)'
              : 'linear-gradient(to bottom, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.9) 100%)',
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: theme === 'dark'
              ? 'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.5) 100%)'
              : 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.08) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge — no filter blur animation (GPU-expensive) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE.standard, delay: 0.5 }}
        >
          <span
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full md:backdrop-blur-xl text-xs font-medium uppercase tracking-[0.2em] mb-8 border"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(20,20,20,0.85)' : 'rgba(0,0,0,0.08)',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#111111',
            }}
          >
            <Sparkles size={12} />
            Port St. Lucie · Private · Direct
          </span>
        </motion.div>

        {/* Headline — responsive sizing: mobile-first */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.cinematic, ease: EASE.dramatic, delay: 0.7 }}
          className="text-4xl sm:text-5xl md:text-7xl lg:text-9xl font-extralight tracking-tight leading-[0.95] mb-6 md:mb-8"
          style={{
            color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
            textShadow: theme === 'dark'
              ? '0 2px 40px rgba(0,0,0,0.5)'
              : '0 2px 30px rgba(255,255,255,0.8)',
          }}
        >
          Your ride, <br />
          <span className="italic font-serif font-normal">your way</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 1 }}
          className="text-sm sm:text-base md:text-xl max-w-xl mx-auto mb-10 md:mb-12 leading-relaxed px-2"
          style={{
            color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#111111',
            textShadow: theme === 'dark'
              ? '0 1px 20px rgba(0,0,0,0.4)'
              : '0 1px 16px rgba(255,255,255,0.6)',
          }}
        >
          Port St. Lucie's trusted private car rental.
          Quality vehicles, simple booking, responsive local service.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.standard, delay: 1.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <button
            onClick={onBrowseFleet}
            className="group w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-full font-medium transition-[transform,box-shadow] duration-500 hover:scale-[1.03] hover:shadow-2xl active:scale-95 text-base sm:text-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <span className="flex items-center justify-center gap-2">
              Browse Fleet
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </span>
          </button>
          <a
            href="tel:+1234567890"
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-full font-medium transition-[transform] duration-500 hover:scale-[1.03] active:scale-95 text-base sm:text-lg md:backdrop-blur-xl border text-center"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(20,20,20,0.85)' : 'rgba(240,240,240,0.85)',
              borderColor: 'var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          >
            Call or Text
          </a>
        </motion.div>

        {/* Social Proof Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.slow, ease: EASE.standard }}
          className="mt-10 md:mt-14 inline-flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl md:backdrop-blur-2xl border shadow-xl"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            boxShadow: theme === 'dark'
              ? '0 8px 32px rgba(0,0,0,0.4)'
              : '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          {/* Avatar cluster */}
          <div className="flex -space-x-2.5">
            {[
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80',
              'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&h=64&q=80',
              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&h=64&q=80'
            ].map((url, i) => (
              <img
                key={`avatar-hero-${i}`}
                src={url}
                alt="Reviewer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 ring-0 object-cover"
                style={{
                  borderColor: theme === 'dark' ? 'rgba(10,10,10,0.8)' : '#ffffff',
                  zIndex: 4 - i,
                }}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>4.9</span>
            <Star size={14} fill="var(--accent-color)" stroke="var(--accent-color)" />
          </div>
          <div className="h-5 w-px hidden sm:block" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <span className="text-xs sm:text-sm hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
            Trusted by 500+ local renters
          </span>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          className="w-px h-8 origin-top"
          style={{ backgroundColor: 'var(--text-primary)' }}
          animate={{ scaleY: [0, 1, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  );
}
