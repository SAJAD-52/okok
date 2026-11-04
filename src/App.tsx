import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from './components/ui/Toast';

// Layout
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { MachinesPage } from './pages/MachinesPage';
import { BookingsPage } from './pages/BookingsPage';
import { StorefrontPage } from './pages/StorefrontPage';
import { MessagesPage } from './pages/MessagesPage';
import { AdminPage } from './pages/AdminPage';

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
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/:id" element={<MachineDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* Protected / App Dashboard Routes */}
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<DashboardOverviewPage />} />
            <Route path="machines" element={<MachinesPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="storefront" element={<StorefrontPage />} />
            <Route path="messages" element={<MessagesPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Toast Notification Portal */}
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
