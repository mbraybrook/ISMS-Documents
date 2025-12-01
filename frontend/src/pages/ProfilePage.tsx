import { Box, Heading, VStack, Text, Badge, Button } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getDepartmentDisplayName } from '../types/risk';

export function ProfilePage() {
  const { user, logout, getUserDepartment } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  if (!user) {
    return null;
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'red',
    EDITOR: 'blue',
    STAFF: 'gray',
    CONTRIBUTOR: 'purple',
  };

  const department = getUserDepartment();

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          User Profile
        </Heading>
      </Box>

      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <VStack spacing={4} align="stretch">
          <Box>
            <Text fontSize="sm" color="gray.600">
              Display Name
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              {user.displayName}
            </Text>
          </Box>

          <Box>
            <Text fontSize="sm" color="gray.600">
              Email
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              {user.email}
            </Text>
          </Box>

          <Box>
            <Text fontSize="sm" color="gray.600" mb={2}>
              Role
            </Text>
            <Badge colorScheme={roleColors[user.role]} fontSize="md" p={2}>
              {user.role}
            </Badge>
          </Box>

          {department && (
            <Box>
              <Text fontSize="sm" color="gray.600" mb={2}>
                Department
              </Text>
              <Badge colorScheme="teal" fontSize="md" p={2}>
                {getDepartmentDisplayName(department)}
              </Badge>
            </Box>
          )}

          <Button colorScheme="red" onClick={handleLogout} mt={4}>
            Sign Out
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
}

