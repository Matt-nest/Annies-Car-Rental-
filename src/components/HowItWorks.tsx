import { Car, Calendar, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { EASE, STAGGER } from '../utils/motion';

export default function HowItWorks() {
  const { theme } = useTheme();

  const steps = [
    { icon: <Car />, title: 'Browse & Choose', desc: 'Explore our fleet of 30 vehicles and find the right fit for your needs and budget.' },
    { icon: <Calendar />, title: 'Request Your Dates', desc: 'Submit a quick request with your preferred dates. We confirm availability promptly.' },
    { icon: <CheckCircle2 />, title: 'Get Confirmed & Drive', desc: "Once approved, we handle insurance details and coordinate pickup. No charge until confirmed." },
  ];

  return (
    <section
      id="how-it-works"
      className="pt-16 sm:pt-24 pb-12 sm:pb-16 border-t"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-12 sm:mb-16 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Simple Process
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: EASE.standard }}
            className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, ease: EASE.standard }}
            className="text-base sm:text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Simple, direct, and transparent. Three steps to get on the road.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * STAGGER.slow, duration: 0.6, ease: EASE.standard }}
              className="text-center group relative"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <motion.div
                  className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[1px] origin-left"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * STAGGER.slow + 0.4, duration: 0.8, ease: EASE.dramatic }}
                />
              )}

              <div className="relative mb-5 sm:mb-6 inline-block">
                <span
                  className="absolute -top-4 -left-4 text-[64px] sm:text-[80px] font-serif italic leading-none select-none pointer-events-none"
                  style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)' }}
                >
                  {i + 1}
                </span>
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto border transition-all duration-500 group-hover:scale-110 group-hover:border-[var(--border-strong)]"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {React.cloneElement(step.icon as React.ReactElement, { size: 24 })}
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3">{step.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed text-sm sm:text-[15px] max-w-[280px] mx-auto">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
