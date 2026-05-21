import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { SPRING_NATURAL } from '../../lib/animation';

/**
 * Banner that drops in from the top when the device loses network and
 * dismisses itself when it comes back. Matches the iOS Mail / native-app
 * convention of a thin amber/red bar at the very top, sized to fit safely
 * within the iOS notch area.
 *
 * Rendered globally in DashboardLayout so it's visible on every page.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={SPRING_NATURAL}
          className="fixed inset-x-0 top-0 z-[100000] safe-top safe-x flex items-center justify-center gap-2 py-2 px-4 text-[13px] font-medium"
          style={{
            backgroundColor: '#B45309',  // amber-700 — readable on light + dark
            color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
          role="status"
          aria-live="polite"
        >
          <WifiOff size={14} strokeWidth={2.2} />
          <span>You're offline — showing cached data</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
