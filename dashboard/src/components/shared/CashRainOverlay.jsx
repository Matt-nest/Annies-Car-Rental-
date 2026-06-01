import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * CashRainOverlay — celebratory animation that rains 💵 from the top to the
 * bottom of the viewport when an active-rental alert is acknowledged.
 *
 * Respects `prefers-reduced-motion` (renders nothing in that case).
 * Caps the run at ~2 seconds; auto-unmounts via the parent's `active` flag.
 */
export default function CashRainOverlay({ active, onComplete }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      // No animation — finish immediately so the parent can dismiss.
      const t = setTimeout(() => onComplete?.(), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => onComplete?.(), 2000);
    return () => clearTimeout(t);
  }, [active, reduced, onComplete]);

  if (!active || reduced) return null;

  // Pre-computed bills: each gets a random column, delay, drift, rotation.
  const bills = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 80,
    rotate: (Math.random() - 0.5) * 360,
    size: 22 + Math.round(Math.random() * 18),
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 pointer-events-none z-[999998]"
        aria-hidden="true"
      >
        {bills.map(bill => (
          <motion.div
            key={bill.id}
            initial={{ y: -80, x: 0, opacity: 0, rotate: 0 }}
            animate={{
              y: window.innerHeight + 80,
              x: bill.drift,
              opacity: [0, 1, 1, 0],
              rotate: bill.rotate,
            }}
            transition={{ duration: 1.6, delay: bill.delay, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              top: 0,
              left: `${bill.left}%`,
              fontSize: bill.size,
            }}
          >
            💵
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
