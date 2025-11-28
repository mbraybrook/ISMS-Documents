import { Box, Button, Heading, VStack, Text } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <VStack spacing={6} p={8} bg="white" borderRadius="md" boxShadow="md">
        <Heading size="lg">ISMS Document Management</Heading>
        <Text color="gray.600">Sign in with your Microsoft account</Text>
        <Button colorScheme="blue" size="lg" onClick={handleLogin}>
          Sign In
        </Button>
      </VStack>
    </Box>
  );
}

