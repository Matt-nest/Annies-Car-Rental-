import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { brand } from '../config/brand';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

/** Must stay in sync with .theme-transition CSS duration (index.css) */
const THEME_TRANSITION_MS = 600;

/**
 * Convert a hex color to rgba() with the given alpha.
 * Falls back to the original string if parsing fails.
 */
function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace('#', '').match(/.{1,2}/g);
  if (!match || match.length < 3) return hex;
  const [r, g, b] = match.map(c => parseInt(c, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleTheme = useCallback(() => {
    setIsTransitioning(true);
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => setIsTransitioning(false), THEME_TRANSITION_MS);
  }, []);

  // Resolve accent color per theme mode
  const accentColor = theme === 'dark' ? brand.colors.accent : brand.colors.accentDark;
  const glowAlpha = theme === 'dark' ? 0.15 : 0.1;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        className={`min-h-screen font-sans transition-colors duration-500 ${theme} ${
          isTransitioning ? 'theme-transition' : ''
        }`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          // Override accent colors from brand config
          '--accent-color': accentColor,
          '--accent-glow': hexToRgba(accentColor, glowAlpha),
        } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
