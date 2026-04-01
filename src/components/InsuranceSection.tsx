import { motion } from 'motion/react';
import { EASE, STAGGER } from '../utils/motion';

export default function InsuranceSection() {
  const cards = [
    { title: 'Protection Options', desc: 'Choose from multiple coverage levels to match your comfort and needs.' },
    { title: '24/7 Assistance', desc: 'Round-the-clock support for any mechanical issues or emergencies on the road.' },
    { title: 'No Upfront Requirements', desc: 'Insurance details are finalized after your request is approved. No surprise charges.' },
  ];

  return (
    <section
      className="section-inverted py-20 sm:py-28 border-y"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="flex items-center justify-center mx-auto mb-6 sm:mb-8"
        >
          <img
            src="/logo-icon.png"
            alt="Annie's Car Rental"
            className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] object-contain"
          />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="text-2xl sm:text-3xl md:text-5xl font-light mb-4 sm:mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          Drive With Confidence
        </motion.h2>
        <p
          className="text-base sm:text-lg mb-10 sm:mb-12 leading-relaxed max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Every rental includes the option for comprehensive protection coverage.
          We make insurance simple — you'll review your options after your request is approved.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-left">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * STAGGER.normal, ease: EASE.standard }}
              className="p-5 sm:p-6 rounded-2xl border transition-all duration-500 hover:scale-[1.02] hover:border-[var(--border-medium)]"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <h4 className="font-medium mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                {card.title}
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
