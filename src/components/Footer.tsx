import { useTheme } from '../App';

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer
      className="py-16 px-6"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
          {/* Brand lockup */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div
                className="absolute inset-0 border rounded-lg rotate-45"
                style={{ borderColor: 'var(--border-strong)' }}
              />
              <span className="relative text-sm font-serif italic" style={{ color: 'var(--text-primary)' }}>A</span>
            </div>
            <div className="flex flex-col -space-y-0.5">
              <span className="text-sm font-light tracking-wider" style={{ color: 'var(--text-primary)' }}>Annie's</span>
              <span className="text-[9px] font-medium tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Car Rental
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            {['Terms of Service', 'Privacy Policy', 'Rental Agreement'].map((link) => (
              <a
                key={link}
                href="#"
                className="nav-link"
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div
          className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
          <p>© {new Date().getFullYear()} Annie's Car Rental. All rights reserved.</p>
          <p>Port St. Lucie, FL · Treasure Coast</p>
        </div>
      </div>
    </footer>
  );
}
