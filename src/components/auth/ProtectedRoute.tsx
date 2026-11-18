// ============================================================================
// JADIJCB: Protected Route Guard
// ============================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, profile, isSuperAdmin, isImpersonating, logout } = useAuth();
  const location = useLocation();

  // 1. Wait for auth initialization to complete
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-steel-200 border-t-primary rounded-full animate-spin" />
          <span className="text-xs font-bold text-steel-500 font-mono">JADIJCB...</span>
        </div>
      </div>
    );
  }

  // 2. Redirect to login without active session
  if (!isAuthenticated) {
    if (requiredRole === 'admin' || location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Super Admin when not impersonating belongs strictly in /admin (never intercept owner/entreprise/driver portals)
  if ((isSuperAdmin || profile?.role === 'admin') && !isImpersonating) {
    if (
      location.pathname.startsWith('/owner') ||
      location.pathname.startsWith('/entreprise') ||
      location.pathname.startsWith('/driver') ||
      location.pathname === '/app' ||
      location.pathname.startsWith('/app/')
    ) {
      return <Navigate to="/admin" replace />;
    }
    return children;
  }

  // 4. Super Admin when impersonating has access to the target role view
  if (isSuperAdmin || profile?.role === 'admin') {
    return children;
  }

  // 4b. Block suspended accounts across all portals with clear notice & logout
  if (profile?.subscription_status === 'suspended') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl">
            ⛔
          </div>
          <h1 className="text-lg font-black text-ink">تم تجميد هذا الحساب</h1>
          <p className="text-xs font-bold text-steel-600 leading-relaxed">
            تم إيقاف وتجميد حسابك مؤقتاً من طرف إدارة منصة JADIJCB. يرجى التواصل مع الإدارة لإعادة التفعيل.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-3 px-4 rounded-xl bg-ink text-white hover:bg-steel-800 text-xs font-black transition-colors cursor-pointer"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // 5. Role-specific route gating
  if (requiredRole && profile?.role !== requiredRole) {
    if (profile?.role === 'driver') {
      return <Navigate to="/driver" replace />;
    }
    if (profile?.role === 'client' || profile?.role === 'contractor') {
      return <Navigate to="/entreprise" replace />;
    }
    return <Navigate to="/owner" replace />;
  }

  if (profile?.role === 'driver' && !location.pathname.startsWith('/driver')) {
    return <Navigate to="/driver" replace />;
  }

  return children;
};

export default ProtectedRoute;
