import { Box, Button, Heading, VStack, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { getEffectiveRole } = useAuth();

  const handleGoHome = () => {
    const effectiveRole = getEffectiveRole();
    if (effectiveRole === 'STAFF' || effectiveRole === 'CONTRIBUTOR') {
      navigate('/admin/staff');
    } else {
      navigate('/admin');
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <VStack spacing={6} p={8} bg="white" borderRadius="md" boxShadow="md">
        <Heading size="lg" color="red.500">Access Denied</Heading>
        <Text color="gray.600" textAlign="center">
          You don't have permission to access this page.
        </Text>
        <Text color="gray.500" fontSize="sm" textAlign="center">
          Please contact your administrator if you believe this is an error.
        </Text>
        <Button colorScheme="blue" onClick={handleGoHome}>
          Go to Home
        </Button>
      </VStack>
    </Box>
  );
}

