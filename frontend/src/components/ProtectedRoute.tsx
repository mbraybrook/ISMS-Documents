import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Center } from '@chakra-ui/react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, loading, getEffectiveRole } = useAuth();

  if (loading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      STAFF: 1,
      CONTRIBUTOR: 1.5, // Between STAFF and EDITOR
      EDITOR: 2,
      ADMIN: 3,
    };

    const effectiveRole = getEffectiveRole();
    const userRoleLevel = roleHierarchy[effectiveRole || 'STAFF'] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    // For exact role matching (CONTRIBUTOR should only access CONTRIBUTOR routes)
    if (requiredRole === 'CONTRIBUTOR' && effectiveRole !== 'CONTRIBUTOR') {
      return <Navigate to="/unauthorized" replace />;
    }

    if (userRoleLevel < requiredRoleLevel) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

