import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { TOTAL_REVIEW_COUNT } from '../data/reviews';
import { VEHICLES } from '../data/vehicles';
import { useTheme } from '../App';
import { EASE, STAGGER } from '../utils/motion';
const happyDriverImg = new URL('/happy-driver.png', import.meta.url).href;

export default function TrustSection() {
  const { theme } = useTheme();

  const trustPoints = [
    { title: 'Professionally Maintained', desc: 'Every vehicle is inspected and detailed before each rental at our Port St. Lucie facility.' },
    { title: 'Direct Communication', desc: 'You deal with us directly — personal, responsive, local service. No middleman, no corporate runaround.' },
    { title: 'Flexible Terms', desc: 'Daily or weekly rentals with easy extensions and clear pricing for the Treasure Coast area.' },
  ];

  return (
    <section id="trust" className="py-28 px-6 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Why Annie's
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: EASE.standard }}
            className="text-4xl md:text-5xl font-light mb-10 leading-tight"
          >
            Port St. Lucie's trusted <br />
            <span className="italic font-serif">private rental</span>
          </motion.h2>
          <div className="space-y-8">
            {trustPoints.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * STAGGER.normal, duration: 0.6, ease: EASE.standard }}
                className="flex gap-4 group"
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 transition-all duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
                >
                  <CheckCircle2 size={14} style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <h4 className="text-lg font-medium mb-1">{item.title}</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Real stats */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, ease: EASE.standard }}
            className="flex gap-10 mt-12 pt-8"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {[
              { val: VEHICLES.length.toString(), label: 'Vehicles' },
              { val: '1,823', label: 'Trips Completed' },
              { val: '4 yrs', label: 'Serving PSL' },
            ].map((stat, i) => (
              <div key={i}>
                <span className="text-3xl font-light">{stat.val}</span>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE.dramatic }}
          className="relative"
        >
          <div
            className="aspect-[4/5] rounded-[2rem] overflow-hidden border shadow-xl"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <img
              src={happyDriverImg}
              alt="Happy customer in a rental car"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Floating social proof card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE.standard }}
            className="absolute -bottom-8 -left-8 hidden lg:block rounded-2xl border shadow-2xl"
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
              {/* Avatar cluster — real photos */}
              <div className="flex -space-x-2.5">
                {[
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&h=64&q=80',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&h=64&q=80',
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border-2"
                    style={{
                      borderColor: theme === 'dark' ? '#141414' : '#ffffff',
                      zIndex: 4 - i,
                      position: 'relative',
                    }}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>4.9</span>
                <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>/5</span>
              </div>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Trusted by 500+ local clients
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
