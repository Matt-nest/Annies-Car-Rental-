import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { AuthProvider } from './auth/AuthProvider';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';

/* Heavy / off-home pages are lazy-loaded so the dashboard landing chunk stays small.
   Each becomes its own Rollup chunk, fetched only on first navigation:
   - TelematicsPage drags in mapbox-gl (~1.8 MB) — biggest win
   - RevenuePage + DashboardPage widgets use Recharts (now its own vendor chunk)
   - MessagingPage + SettingsPage use @dnd-kit
   - StripePage + BookingDetailPage payment use @stripe/*
   - Booking-tabs (Inspection, Invoice, etc.) live under BookingDetailPage  */
const BookingsPage          = lazy(() => import('./pages/BookingsPage'));
const BookingDetailPage     = lazy(() => import('./pages/BookingDetailPage'));
const FleetPage             = lazy(() => import('./pages/FleetPage'));
const VehicleDetailPage     = lazy(() => import('./pages/VehicleDetailPage'));
const CustomersPage         = lazy(() => import('./pages/CustomersPage'));
const CustomerDetailPage    = lazy(() => import('./pages/CustomerDetailPage'));
const CalendarPage          = lazy(() => import('./pages/CalendarPage'));
const PaymentsPage          = lazy(() => import('./pages/PaymentsPage'));
const RevenuePage           = lazy(() => import('./pages/RevenuePage'));
const SettingsPage          = lazy(() => import('./pages/SettingsPage'));
const WebhookFailuresPage   = lazy(() => import('./pages/WebhookFailuresPage'));
const StripePage            = lazy(() => import('./pages/StripePage'));
const MessagingPage         = lazy(() => import('./pages/MessagingPage'));
const CheckInsPage          = lazy(() => import('./pages/CheckInsPage'));
const MonthlyInquiriesPage  = lazy(() => import('./pages/MonthlyInquiriesPage'));
const ReviewsPage           = lazy(() => import('./pages/ReviewsPage'));
const PricingRulesPage      = lazy(() => import('./pages/PricingRulesPage'));
const LoyaltyPage           = lazy(() => import('./pages/LoyaltyPage'));
const InsurancePage         = lazy(() => import('./pages/InsurancePage'));
const TelematicsPage        = lazy(() => import('./pages/TelematicsPage'));

// Minimal route-fallback that matches the dashboard's design tokens.
function RouteFallback() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
    >
      <div className="text-sm opacity-60">Loading…</div>
    </div>
  );
}

// Wrap a lazy route element with Suspense so each navigation streams independently.
const L = (el) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/"           element={<DashboardPage />} />
            <Route path="/bookings"   element={L(<BookingsPage />)} />
            <Route path="/bookings/:id" element={L(<BookingDetailPage />)} />
            <Route path="/fleet"      element={L(<FleetPage />)} />
            <Route path="/fleet/:id"  element={L(<VehicleDetailPage />)} />
            <Route path="/customers"  element={L(<CustomersPage />)} />
            <Route path="/customers/:id" element={L(<CustomerDetailPage />)} />
            <Route path="/calendar"   element={L(<CalendarPage />)} />
            <Route path="/check-ins"  element={L(<CheckInsPage />)} />
            <Route path="/payments"   element={L(<PaymentsPage />)} />
            <Route path="/revenue"    element={L(<RevenuePage />)} />
            <Route path="/settings"   element={L(<SettingsPage />)} />
            <Route path="/stripe"     element={L(<StripePage />)} />
            <Route path="/messaging"  element={L(<MessagingPage />)} />
            <Route path="/webhook-failures" element={L(<WebhookFailuresPage />)} />
            <Route path="/monthly-inquiries" element={L(<MonthlyInquiriesPage />)} />
            <Route path="/reviews" element={L(<ReviewsPage />)} />
            <Route path="/pricing-rules" element={L(<PricingRulesPage />)} />
            <Route path="/loyalty" element={L(<LoyaltyPage />)} />
            <Route path="/insurance" element={L(<InsurancePage />)} />
            <Route path="/telematics" element={L(<TelematicsPage />)} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}
