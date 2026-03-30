import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { EASE, STAGGER } from '../utils/motion';

export default function InsuranceSection() {
  const { theme } = useTheme();

  const cards = [
    { title: 'Protection Options', desc: 'Choose from multiple coverage levels to match your comfort and needs.' },
    { title: '24/7 Assistance', desc: 'Round-the-clock support for any mechanical issues or emergencies on the road.' },
    { title: 'No Upfront Requirements', desc: 'Insurance details are finalized after your request is approved. No surprise charges.' },
  ];

  return (
    <section
      className="section-inverted py-28 border-y"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-8 border"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Shield size={28} style={{ color: 'var(--text-secondary)' }} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="text-3xl md:text-5xl font-light mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          Drive With Confidence
        </motion.h2>
        <p
          className="text-lg mb-12 leading-relaxed max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Every rental includes the option for comprehensive protection coverage.
          We make insurance simple — you'll review your options after your request is approved.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 text-left">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * STAGGER.normal, ease: EASE.standard }}
              className="p-6 rounded-2xl border transition-all duration-500 hover:scale-[1.02]"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <h4 className="font-medium mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                {card.title}
              </h4>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
