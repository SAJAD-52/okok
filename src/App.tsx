import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from './components/ui/Toast';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Layout
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { PublicStorefrontPage } from './pages/PublicStorefrontPage';
import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { MachinesPage } from './pages/MachinesPage';
import { BookingsPage } from './pages/BookingsPage';
import { StorefrontPage } from './pages/StorefrontPage';
import { MessagesPage } from './pages/MessagesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminPage } from './pages/AdminPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { ContractorDashboardPage } from './pages/ContractorDashboardPage';
import { SiteRadarMapPage } from './pages/SiteRadarMapPage';
import { ContractorBookingsPage } from './pages/ContractorBookingsPage';
import { ContractorProjectsPage } from './pages/ContractorProjectsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/marketplace/:id" element={<MachineDetailPage />} />
            <Route path="/s/:slug" element={<PublicStorefrontPage />} />

            {/* Protected Onboarding Route */}
            <Route
              path="/owner/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route path="/app/onboarding" element={<Navigate to="/owner/onboarding" replace />} />

            {/* Protected Admin Console */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Equipment Owner Dashboard Routes (/owner) */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardOverviewPage />} />
              <Route path="machines" element={<MachinesPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="storefront" element={<StorefrontPage />} />
              <Route path="messages" element={<MessagesPage />} />
            </Route>

            {/* Backward Compatibility Redirects from /app to /owner */}
            <Route path="/app" element={<Navigate to="/owner" replace />} />
            <Route path="/app/machines" element={<Navigate to="/owner/machines" replace />} />
            <Route path="/app/bookings" element={<Navigate to="/owner/bookings" replace />} />
            <Route path="/app/analytics" element={<Navigate to="/owner/analytics" replace />} />
            <Route path="/app/storefront" element={<Navigate to="/owner/storefront" replace />} />
            <Route path="/app/messages" element={<Navigate to="/owner/messages" replace />} />

            {/* Protected Contractor / Entreprise Portal Routes */}
            <Route
              path="/entreprise"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ContractorDashboardPage />} />
              <Route path="map" element={<SiteRadarMapPage />} />
              <Route path="bookings" element={<ContractorBookingsPage />} />
              <Route path="projects" element={<ContractorProjectsPage />} />
              <Route path="messages" element={<MessagesPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Global Toast Notification Portal */}
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
