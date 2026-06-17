import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE, STAGGER } from '../../utils/motion';
import { faqs } from '../../data/faq';

export default function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 max-w-3xl mx-auto">
      <div className="mb-10 sm:mb-14 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
          style={{ color: 'var(--accent-color)' }}
        >
          Questions & Answers
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight"
        >
          Common Questions
        </motion.h2>
      </div>
      <div className="space-y-3 sm:space-y-4">
        {faqs.map((faq, i) => (
          <motion.details
            key={i}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * STAGGER.fast, ease: EASE.standard }}
            className="group rounded-2xl border overflow-hidden transition-all duration-300 hover:border-[var(--border-medium)]"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <summary
              className="p-5 sm:p-6 cursor-pointer flex justify-between items-center list-none font-medium text-[14px] sm:text-[15px] transition-colors duration-300"
            >
              {faq.q}
              <ChevronRight
                size={16}
                className="transition-transform duration-300 group-open:rotate-90 shrink-0 ml-4"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </summary>
            <div
              className="px-5 sm:px-6 pb-5 sm:pb-6 leading-relaxed text-[14px] sm:text-[15px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {faq.a}
            </div>
          </motion.details>
        ))}
      </div>
    </section>
  );
}
