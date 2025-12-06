import { Select, Text, HStack, Badge, VStack } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Department, getDepartmentDisplayName } from '../types/risk';

const DEPARTMENTS: Department[] = ['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING'];

export function RoleSwitcher() {
  const { user, roleOverride, setRoleOverride, getEffectiveRole, departmentOverride, setDepartmentOverride } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Only show for ADMIN users
  if (user?.role !== 'ADMIN') {
    return null;
  }

  const effectiveRole = getEffectiveRole();
  const isOverridden = roleOverride !== null;
  const isContributor = effectiveRole === 'CONTRIBUTOR';

  // Handle navigation when role override changes
  useEffect(() => {
    if (!user) return;

    const newRole = getEffectiveRole();
    
    // If switching to STAFF and not already on a staff route, navigate to staff dashboard
    if (newRole === 'STAFF' && !location.pathname.startsWith('/admin/staff')) {
      navigate('/admin/staff', { replace: true });
    }
    // If switching to CONTRIBUTOR, only redirect if on an invalid route
    // Contributors can access: /admin/staff, /admin/staff/*, /admin/risks/department, /admin/profile
    else if (newRole === 'CONTRIBUTOR') {
      const isValidContributorRoute = 
        location.pathname.startsWith('/admin/staff') || 
        location.pathname.startsWith('/admin/risks/department') ||
        location.pathname === '/admin/profile';
      
      // Only redirect if on an invalid route (like admin/editor routes)
      if (!isValidContributorRoute && !location.pathname.startsWith('/admin/login') && !location.pathname.startsWith('/unauthorized')) {
        navigate('/admin/staff', { replace: true });
      }
    }
    // If switching away from STAFF and on a staff route, navigate to admin dashboard
    else if (newRole !== 'STAFF' && (newRole as string) !== 'CONTRIBUTOR' && location.pathname.startsWith('/admin/staff')) {
      navigate('/admin', { replace: true });
    }
    // If switching away from CONTRIBUTOR and on department risks route, navigate to main risks page
    else if ((newRole as string) !== 'CONTRIBUTOR' && location.pathname.startsWith('/admin/risks/department')) {
      navigate('/admin/risks/risks', { replace: true });
    }
  }, [roleOverride, user, navigate, location.pathname, getEffectiveRole]);

  // Set default department when switching to CONTRIBUTOR if none is set
  useEffect(() => {
    if (isContributor && !departmentOverride) {
      setDepartmentOverride('HR'); // Default to HR for testing
    }
  }, [isContributor, departmentOverride, setDepartmentOverride]);

  return (
    <VStack spacing={2} align="flex-start">
      <HStack spacing={2} align="center">
        <Text fontSize="xs" color="gray.600">
          Test Role:
        </Text>
        <Select
          size="xs"
          width="120px"
          value={roleOverride || user.role}
          onChange={(e) => {
            const value = e.target.value;
            if (value === user.role) {
              setRoleOverride(null);
            } else {
              setRoleOverride(value as 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR');
            }
          }}
          bg={isOverridden ? 'yellow.50' : 'white'}
          borderColor={isOverridden ? 'yellow.400' : 'gray.200'}
        >
          <option value="ADMIN">ADMIN</option>
          <option value="EDITOR">EDITOR</option>
          <option value="STAFF">STAFF</option>
          <option value="CONTRIBUTOR">CONTRIBUTOR</option>
        </Select>
        {isOverridden && (
          <Badge colorScheme="yellow" fontSize="xs">
            TEST MODE
          </Badge>
        )}
      </HStack>
      {isContributor && (
        <HStack spacing={2} align="center">
          <Text fontSize="xs" color="gray.600">
            Test Department:
          </Text>
          <Select
            size="xs"
            width="160px"
            value={departmentOverride || 'HR'}
            onChange={(e) => {
              setDepartmentOverride(e.target.value as Department);
            }}
            bg="yellow.50"
            borderColor="yellow.400"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {getDepartmentDisplayName(dept)}
              </option>
            ))}
          </Select>
        </HStack>
      )}
    </VStack>
  );
}

