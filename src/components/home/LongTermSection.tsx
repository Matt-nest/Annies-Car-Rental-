import { Car, Infinity, DollarSign } from 'lucide-react';
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

const points = [
  {
    icon: Car,
    title: 'Snowbird Season Ready',
    desc: 'October through April, we specialize in stays from a few weeks to the full season. Extend any time — no platform restrictions, no 30-day cap.',
  },
  {
    icon: Infinity,
    title: 'Rideshare Partner Plans',
    desc: 'We partner with Uber, DoorDash, and Lyft drivers. Weekly rates, unlimited mileage, and a reliable vehicle that keeps you earning.',
  },
  {
    icon: DollarSign,
    title: 'No Platform Fees',
    desc: 'Book directly with Annie. No Turo, no middleman, no 20% surcharge. A fair deal, negotiated personally.',
  },
];

export default function LongTermSection() {
  const { theme } = useTheme();

  return (
    <section id="longterm" className="py-16 sm:py-28 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

        {/* Image — LEFT column (mirrors TrustSection but image first) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE.dramatic }}
          className="relative order-last md:order-first"
        >
          <div
            className="aspect-[3/4] sm:aspect-[4/5] rounded-2xl sm:rounded-[2rem] overflow-hidden border shadow-xl"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <img
              src={rideshareDriverImg}
              alt="Rideshare driver ready to work"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Floating app logos card — bottom-RIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE.standard }}
            className="absolute -bottom-8 -right-8 hidden lg:block rounded-2xl border shadow-2xl"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(20,20,20,0.97)' : '#ffffff',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              boxShadow: theme === 'dark'
                ? '0 12px 40px rgba(0,0,0,0.5)'
                : '0 12px 40px rgba(0,0,0,0.1)',
              padding: '16px 24px',
            }}
          >
            <div className="flex items-center gap-3">
              {appLogos.map((logo, i) => (
                <motion.img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="w-10 h-10 rounded-xl object-contain"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.35,
                  }}
                />
              ))}
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              We partner with rideshare drivers
            </p>
          </motion.div>
        </motion.div>

        {/* Text — RIGHT column (mirrors TrustSection left column exactly) */}
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
            className="text-3xl sm:text-4xl md:text-5xl font-light mb-8 sm:mb-10 leading-tight"
          >
            Staying the season.<br />
            <span className="italic font-serif">Working the apps.</span>
          </motion.h2>

          <div className="space-y-8">
            {points.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * STAGGER.normal, duration: 0.6, ease: EASE.standard }}
                className="flex gap-4 group"
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 transition-all duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)' }}
                >
                  <item.icon size={14} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div>
                  <h4 className="text-lg font-medium mb-1">{item.title}</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats row — matches TrustSection exactly */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, ease: EASE.standard }}
            className="flex gap-6 sm:gap-10 mt-10 sm:mt-12 pt-6 sm:pt-8"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {[
              { val: '30–90 days', label: 'Avg Long-Term Stay' },
              { val: '∞ miles', label: 'Weekly & Monthly' },
              { val: 'No fees', label: 'Book Direct' },
            ].map((stat, i) => (
              <div key={i}>
                <span className="text-3xl font-light">{stat.val}</span>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
