import { Box, HStack, Link, Button, Flex, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';

export function TrustCenterHeader() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useTrustAuth();

  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <Box
      as="header"
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
      py={4}
      px={{ base: 4, md: 8 }}
      position="sticky"
      top={0}
      zIndex={1000}
      boxShadow="sm"
    >
      <Flex
        maxW="container.xl"
        mx="auto"
        justify="space-between"
        align="center"
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 4, md: 0 }}
      >
        {/* Logo and Branding */}
        <HStack spacing={3}>
          {/* Placeholder for logo - can be replaced with actual logo */}
          <Box
            w={8}
            h={8}
            bg="blue.600"
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="white"
            fontWeight="bold"
            fontSize="lg"
          >
            TC
          </Box>
          <Text fontSize="xl" fontWeight="bold" color="gray.800">
            Trust Center
          </Text>
        </HStack>

        {/* Navigation Links */}
        <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
          <Link
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('overview');
            }}
            color="gray.700"
            fontWeight="medium"
            _hover={{ color: 'blue.600', textDecoration: 'none' }}
            transition="color 0.2s"
          >
            Overview
          </Link>
          <Link
            href="#certifications"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('certifications');
            }}
            color="gray.700"
            fontWeight="medium"
            _hover={{ color: 'blue.600', textDecoration: 'none' }}
            transition="color 0.2s"
          >
            Certifications
          </Link>
          <Link
            href="#documents"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('documents');
            }}
            color="gray.700"
            fontWeight="medium"
            _hover={{ color: 'blue.600', textDecoration: 'none' }}
            transition="color 0.2s"
          >
            Documents
          </Link>
        </HStack>

        {/* Login/Register Buttons or Welcome/Logout */}
        {!isAuthenticated ? (
          <HStack spacing={3}>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              size="sm"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate('/login')}
              colorScheme="blue"
              size="sm"
            >
              Register
            </Button>
          </HStack>
        ) : (
          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              Welcome back!
            </Text>
            <Text fontSize="sm" color="gray.500">
              Viewing public and private documents
            </Text>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              colorScheme="gray"
            >
              Logout
            </Button>
          </HStack>
        )}
      </Flex>
    </Box>
  );
}

