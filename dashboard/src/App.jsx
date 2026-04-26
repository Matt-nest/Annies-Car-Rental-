import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { AuthProvider } from './auth/AuthProvider';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import BookingDetailPage from './pages/BookingDetailPage';
import FleetPage from './pages/FleetPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CalendarPage from './pages/CalendarPage';
import PaymentsPage from './pages/PaymentsPage';
import RevenuePage from './pages/RevenuePage';
import SettingsPage from './pages/SettingsPage';
import WebhookFailuresPage from './pages/WebhookFailuresPage';
import StripePage from './pages/StripePage';
import MessagingPage from './pages/MessagingPage';
import CheckInsPage from './pages/CheckInsPage';
import MonthlyInquiriesPage from './pages/MonthlyInquiriesPage';
import ReviewsPage from './pages/ReviewsPage';
import PricingRulesPage from './pages/PricingRulesPage';
import LoyaltyPage from './pages/LoyaltyPage';

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
            <Route path="/bookings"   element={<BookingsPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path="/fleet"      element={<FleetPage />} />
            <Route path="/fleet/:id"  element={<VehicleDetailPage />} />
            <Route path="/customers"  element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/calendar"   element={<CalendarPage />} />
            <Route path="/check-ins"  element={<CheckInsPage />} />
            <Route path="/payments"   element={<PaymentsPage />} />
            <Route path="/revenue"    element={<RevenuePage />} />
            <Route path="/settings"   element={<SettingsPage />} />
            <Route path="/stripe"     element={<StripePage />} />
            <Route path="/messaging"  element={<MessagingPage />} />
            <Route path="/webhook-failures" element={<WebhookFailuresPage />} />
            <Route path="/monthly-inquiries" element={<MonthlyInquiriesPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/pricing-rules" element={<PricingRulesPage />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}
