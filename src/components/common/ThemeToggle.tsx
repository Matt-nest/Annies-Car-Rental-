import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';

interface ThemeToggleProps {
  size?: number;
  className?: string;
}

/**
 * Animated theme toggle button.
 * Extracted from Navbar and VehicleDetailPage where the same
 * Sun/Moon AnimatePresence pattern was duplicated.
 */
export default function ThemeToggle({ size = 15, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 hover:scale-110 ${className}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: DURATION.fast, ease: EASE.smooth }}
        >
          {theme === 'dark' ? <Sun size={size} /> : <Moon size={size} />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
