import { useState } from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Container,
  Text,
  Link,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import { DataSensitivityFooter } from '../components/DataSensitivityFooter';

export function TrustCenterLoginPage() {
  const navigate = useNavigate();
  const { login } = useTrustAuth();
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: 'Login successful',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        navigate('/');
      } else {
        await trustApi.register(formData.email, formData.password, formData.companyName);
        toast({
          title: 'Registration successful',
          description: 'Your account is pending approval. You will receive an email when approved.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        setIsLogin(true);
        setFormData({ email: '', password: '', companyName: '' });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'An error occurred';
      toast({
        title: isLogin ? 'Login failed' : 'Registration failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Container maxW="md" py={8}>
        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" mb={2}>
              {isLogin ? 'Login' : 'Register'}
            </Heading>
            <Text color="gray.600">
              {isLogin ? 'Access your private documents' : 'Create a new account'}
            </Text>
          </Box>

          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                {errors.email && <FormErrorMessage>{errors.email}</FormErrorMessage>}
              </FormControl>

              <FormControl isInvalid={!!errors.password}>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                {errors.password && <FormErrorMessage>{errors.password}</FormErrorMessage>}
              </FormControl>

              {!isLogin && (
                <FormControl isInvalid={!!errors.companyName}>
                  <FormLabel>Company Name</FormLabel>
                  <Input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                  />
                  {errors.companyName && <FormErrorMessage>{errors.companyName}</FormErrorMessage>}
                </FormControl>
              )}

              {isLogin && (
                <HStack justify="flex-end" w="100%">
                  <Link
                    color="blue.500"
                    onClick={() => {
                      // TODO: Implement forgot password flow
                      toast({
                        title: 'Forgot Password',
                        description: 'Please contact support to reset your password.',
                        status: 'info',
                        duration: 5000,
                        isClosable: true,
                      });
                    }}
                  >
                    Forgot password?
                  </Link>
                </HStack>
              )}

              <Button
                type="submit"
                colorScheme="blue"
                width="100%"
                isLoading={loading}
                loadingText={isLogin ? 'Logging in...' : 'Registering...'}
              >
                {isLogin ? 'Login' : 'Register'}
              </Button>
            </VStack>
          </form>

          <HStack justify="center">
            <Text>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Link color="blue.500" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Register' : 'Login'}
              </Link>
            </Text>
          </HStack>

          <HStack justify="center">
            <Link color="blue.500" onClick={() => navigate('/')}>
              Back to Trust Center
            </Link>
          </HStack>
        </VStack>
      </Container>
      <DataSensitivityFooter />
    </>
  );
}

