import { Car, Infinity, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, STAGGER } from '../../utils/motion';

const rideshareDriverImg = new URL('/rideshare-driver.jpeg', import.meta.url).href;

// App icon component — uses brand colors + initial letters
function AppIcon({ label, bg, text, letter }: { label: string; bg: string; text: string; letter: string }) {
  return (
    <div
      title={label}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
      style={{ backgroundColor: bg, color: text }}
    >
      {letter}
    </div>
  );
}

export default function LongTermSection() {
  const { theme } = useTheme();

  const points = [
    {
      icon: Car,
      title: 'Snowbird Season Ready',
      desc: 'October through April, we specialize in stays from a few weeks to the full season. Extend any time — no platform restrictions, no 30-day cap.',
    },
    {
      icon: Infinity,
      title: 'Rideshare Partner Plans',
      desc: 'We partner with Uber, Lyft, and DoorDash drivers. Weekly rates, unlimited mileage, and a reliable vehicle that keeps you earning.',
    },
    {
      icon: DollarSign,
      title: 'No Platform Fees',
      desc: 'Book directly with Annie. No Turo, no middleman, no 20% surcharge. A fair deal, negotiated personally.',
    },
  ];

  return (
    <section id="longterm" className="py-16 sm:py-28 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

        {/* Image — LEFT column */}
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
            {/* CSS overlay to cover bottom-left shield icon in the source photo */}
            <div
              className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(10,10,10,0.95) 30%, transparent 100%)'
                  : 'linear-gradient(135deg, rgba(240,240,240,0.95) 30%, transparent 100%)',
              }}
            />
          </div>

          {/* Floating app icons card — bottom-RIGHT */}
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
              padding: '16px 20px',
            }}
          >
            <div className="flex items-center gap-2.5">
              <AppIcon label="Uber" bg="#000000" text="#ffffff" letter="U" />
              <AppIcon label="Lyft" bg="#FF00BF" text="#ffffff" letter="L" />
              <AppIcon label="DoorDash" bg="#FF3008" text="#ffffff" letter="D" />
            </div>
            <p className="text-sm mt-3 font-medium" style={{ color: 'var(--text-primary)' }}>
              We partner with rideshare drivers
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
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
            Staying the season.<br />
            <span className="italic font-serif">Working the apps.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            className="text-base sm:text-lg leading-relaxed mb-8 sm:mb-10"
            style={{ color: 'var(--text-secondary)' }}
          >
            Every long-term rental is personal — every situation is different.
            Whether you're a snowbird settling in for the winter, between vehicles and
            need reliable wheels, or a rideshare driver who runs Uber, Lyft, or DoorDash,
            Annie puts together a rate that actually makes sense. No platform fees. No fine print.
            Just a fair deal, directly with the owner. We'll remember you next season.
          </motion.p>

          <div className="space-y-7">
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

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, ease: EASE.standard }}
            className="flex flex-col sm:flex-row gap-3 mt-10 sm:mt-12 pt-8"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <a
              href="tel:+17729856667"
              className="px-8 py-4 rounded-full font-medium transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Call Annie — (772) 985-6667
            </a>
            <a
              href="sms:+17729856667"
              className="px-8 py-4 rounded-full font-medium border transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
              style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
            >
              Text Us
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
