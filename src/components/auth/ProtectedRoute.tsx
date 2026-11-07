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
  const { isAuthenticated, isLoading, profile, isSuperAdmin } = useAuth();
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

  // 3. Super Admin has full authority and access to every single route in the system
  if (isSuperAdmin || profile?.role === 'admin') {
    return children;
  }

  // 4. Role-specific route gating
  if (requiredRole && profile?.role !== requiredRole) {
    if (profile?.role === 'client' || profile?.role === 'contractor') {
      return <Navigate to="/entreprise" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default ProtectedRoute;
