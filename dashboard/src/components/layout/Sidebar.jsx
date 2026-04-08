import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Car, Users, BookOpen,
  TrendingUp, Settings, X, LogOut, AlertTriangle, CreditCard, Landmark, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

const MAIN_NAV = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings',  label: 'Bookings',  icon: BookOpen, alertKey: 'pending_approvals' },
  { to: '/fleet',     label: 'Fleet',     icon: Car },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/calendar',  label: 'Calendar',  icon: Calendar },
  { to: '/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/revenue',   label: 'Revenue',   icon: TrendingUp },
  { to: '/messaging', label: 'Messaging',  icon: MessageSquare },
];

const SYSTEM_NAV = [
  { to: '/stripe',          label: 'Stripe',   icon: Landmark },
  { to: '/settings',        label: 'Settings',  icon: Settings },
  { to: '/webhook-failures', label: 'Webhooks', icon: AlertTriangle },
];

function NavItem({ to, label, icon: Icon, end, alertKey, alerts, onClose }) {
  const count = alertKey ? (alerts[alertKey] || 0) : 0;

  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClose}
        className={({ isActive }) =>
          `group relative flex items-center w-full gap-3 px-3 py-2 font-medium rounded-lg text-sm transition-colors duration-200 ${
            isActive
              ? 'bg-brand-50 text-brand-500 dark:bg-[rgba(30,58,95,0.12)] dark:text-[#00D4AA]'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              size={24}
              strokeWidth={1.5}
              className={
                isActive
                  ? 'text-brand-500 dark:text-[#00D4AA] shrink-0'
                  : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300 shrink-0'
              }
            />
            <span className="flex-1 truncate">{label}</span>
            {count > 0 && (
              <span className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 bg-red-500 text-white">
                {count}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar({ open, onClose, alerts = {} }) {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 h-screen
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out z-[99999] lg:z-[999]
          w-[230px]
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Logo — theme-aware, links home */}
        <div className="flex items-center justify-between py-5">
          <NavLink to="/" onClick={onClose} className="relative h-[70px] w-full block transition-opacity duration-200 hover:opacity-75">
            {/* Light mode: black text logo */}
            <img
              src="/logo-dark.png"
              alt="Annie's & Co"
              className="h-full w-auto object-contain dark:hidden"
            />
            {/* Dark mode: white text logo */}
            <img
              src="/logo-light.png"
              alt="Annie's & Co"
              className="h-full w-auto object-contain hidden dark:block"
            />
          </NavLink>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation — matches template flex flex-col overflow-y-auto */}
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Main menu */}
              <div>
                <h3 className="mb-4 text-xs uppercase leading-5 text-gray-400 dark:text-gray-500">
                  Menu
                </h3>
                <ul className="flex flex-col gap-1">
                  {MAIN_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
                  ))}
                </ul>
              </div>

              {/* System */}
              <div>
                <h3 className="mb-4 text-xs uppercase leading-5 text-gray-400 dark:text-gray-500">
                  System
                </h3>
                <ul className="flex flex-col gap-1">
                  {SYSTEM_NAV.map(item => (
                    <NavItem key={item.to} {...item} alerts={alerts} onClose={onClose} />
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer — sign out */}
        <div className="mt-auto py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={signOut}
            className="group relative flex items-center w-full gap-3 px-3 py-2 font-medium rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
          >
            <LogOut size={24} strokeWidth={1.5} className="text-gray-500 group-hover:text-red-500 dark:text-gray-400 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
