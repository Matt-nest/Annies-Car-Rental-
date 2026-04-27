import { Phone, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, STAGGER } from '../../utils/motion';

const rideshareDriverImg = new URL('/rideshare-driver.jpeg', import.meta.url).href;
const uberImg = new URL('/UBER.png', import.meta.url).href;
const doordashImg = new URL('/Doordash.png', import.meta.url).href;
const lyftImg = new URL('/Lyft.png', import.meta.url).href;

const appLogos = [
  { src: uberImg, alt: 'Uber' },
  { src: doordashImg, alt: 'DoorDash' },
  { src: lyftImg, alt: 'Lyft' },
];

const bullets = [
  { label: 'Snowbird Season Ready', desc: 'A few weeks to the full season — extend any time.' },
  { label: 'Rideshare Partner Plans', desc: 'We partner with Uber, DoorDash, and Lyft drivers.' },
  { label: 'Between Vehicles', desc: 'Reliable wheels while you wait.' },
];

export default function LongTermSection() {
  const { theme } = useTheme();

  return (
    <section id="longterm" className="py-16 sm:py-28 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

        {/* Image — LEFT, landscape crop so face + hand are visible */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE.dramatic }}
          className="relative order-last md:order-first"
        >
          <div
            className="rounded-2xl sm:rounded-[2rem] overflow-hidden border shadow-xl"
            style={{ borderColor: 'var(--border-subtle)', aspectRatio: '4/3' }}
          >
            <img
              src={rideshareDriverImg}
              alt="Rideshare driver checking their phone"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              style={{ objectPosition: '55% 20%' }}
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Floating app logos card — bottom-RIGHT, centered layout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE.standard }}
            className="absolute -bottom-7 -right-5 hidden lg:block rounded-2xl border shadow-2xl"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(18,18,18,0.97)' : '#ffffff',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
              boxShadow: theme === 'dark'
                ? '0 16px 48px rgba(0,0,0,0.55)'
                : '0 16px 48px rgba(0,0,0,0.12)',
              padding: '18px 28px',
              minWidth: '200px',
            }}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              {appLogos.map((logo, i) => (
                <motion.img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="w-13 h-13 rounded-2xl object-cover"
                  style={{ width: 52, height: 52, borderRadius: 14 }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                />
              ))}
            </div>
            <p className="text-[13px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
              We partner with rideshare drivers
            </p>
            <p className="text-[11px] text-center mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Weekly plans · Unlimited mileage
            </p>
          </motion.div>
        </motion.div>

        {/* Text — RIGHT column */}
        <div>
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Long-Term &amp; Rideshare
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: EASE.standard }}
            className="text-3xl sm:text-4xl md:text-5xl font-light mb-5 leading-tight"
          >
            Let's work<br />
            <span className="italic font-serif">something out.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            className="text-base sm:text-lg leading-relaxed mb-7"
            style={{ color: 'var(--text-secondary)' }}
          >
            Monthly rates are personal — every situation is different.
            Call Annie, tell her what you need, and she'll put together
            a rate that makes sense. No platform fees. No fine print.
            Just a fair deal, directly with the owner.
          </motion.p>

          {/* Bullet fragments */}
          <div className="space-y-3 mb-8">
            {bullets.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * STAGGER.normal, duration: 0.5, ease: EASE.standard }}
                className="flex items-start gap-3"
              >
                <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
                <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  {' '}— {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Glassmorphic CTA card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35, duration: 0.6, ease: EASE.standard }}
            className="rounded-2xl p-5 border backdrop-blur-sm"
            style={{
              background: theme === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.025)',
              borderColor: theme === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.07)',
            }}
          >
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <a
                href="tel:+17729856667"
                className="flex-1 py-3.5 rounded-full font-medium transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                <Phone size={14} />
                Call Annie — (772) 985-6667
              </a>
              <a
                href="sms:+17729856667"
                className="flex-1 py-3.5 rounded-full font-medium border transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
                style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
              >
                <MessageSquare size={14} />
                Text Us
              </a>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              We respond same day · Serving Port St. Lucie and the Treasure Coast
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
