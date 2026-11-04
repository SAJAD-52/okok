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
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-steel-200 border-t-primary rounded-full animate-spin" />
          <span className="text-xs font-bold text-steel-500">JADIJCB...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default ProtectedRoute;
