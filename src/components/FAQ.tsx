import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { EASE, STAGGER } from '../utils/motion';

export default function FAQ() {
  const { theme } = useTheme();

  const faqs = [
    { q: 'How does the booking process work?', a: "Browse our fleet, select a vehicle, and submit a request with your preferred dates. We'll review availability and get back to you quickly. No charge is made until your request is confirmed." },
    { q: 'What are the driver requirements?', a: "Drivers must be at least 25 years old, hold a valid driver's license, and provide proof of active personal auto insurance." },
    { q: 'Is there a mileage limit?', a: 'Standard rentals include 150 miles per day. Additional miles can be discussed when your request is confirmed.' },
    { q: 'Do you offer delivery?', a: 'Yes, we offer delivery and pickup for your convenience. Arrangements are made after your request is approved.' },
    { q: 'How does insurance work?', a: "Protection options are available for every rental. We'll discuss coverage details with you after your request is approved — no insurance purchase is required at the time of your initial request." },
    { q: 'What is your cancellation policy?', a: 'Full refunds are provided for cancellations made at least 48 hours before the scheduled start time.' },
    { q: 'Do you offer weekly rates?', a: 'Yes — all vehicles are available for daily or weekly rental. Weekly rates are displayed on each vehicle listing and typically offer meaningful savings.' },
  ];

  return (
    <section id="faq" className="py-28 px-6 max-w-3xl mx-auto">
      <div className="mb-14 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Questions & Answers
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="text-3xl md:text-5xl font-light tracking-tight"
        >
          Common Questions
        </motion.h2>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <motion.details
            key={i}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * STAGGER.fast, ease: EASE.standard }}
            className="group rounded-2xl border overflow-hidden transition-all duration-300"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <summary
              className="p-6 cursor-pointer flex justify-between items-center list-none font-medium text-[15px] transition-colors duration-300"
            >
              {faq.q}
              <ChevronRight
                size={16}
                className="transition-transform duration-300 group-open:rotate-90 shrink-0 ml-4"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </summary>
            <div
              className="px-6 pb-6 leading-relaxed text-[15px]"
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
