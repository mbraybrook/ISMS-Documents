import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Center } from '@chakra-ui/react';

interface StaffOnlyRouteProps {
  children: ReactNode;
}

export function StaffOnlyRoute({ children }: StaffOnlyRouteProps) {
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

  const effectiveRole = getEffectiveRole();
  // Allow both STAFF and CONTRIBUTOR to access staff routes
  if (effectiveRole !== 'STAFF' && effectiveRole !== 'CONTRIBUTOR') {
    // Redirect non-STAFF/CONTRIBUTOR users to their appropriate dashboard
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

