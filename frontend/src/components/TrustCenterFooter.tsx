import { Box, Container, VStack, HStack, Link, Text, Heading, SimpleGrid } from '@chakra-ui/react';

export function TrustCenterFooter() {
  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Box
      as="footer"
      bg="gray.900"
      color="gray.300"
      py={12}
      px={{ base: 4, md: 8 }}
    >
      <Container maxW="container.xl">
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
          {/* Branding Section */}
          <VStack align="start" spacing={4}>
            <HStack spacing={3}>
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
              <Text fontSize="lg" fontWeight="bold" color="white">
                Trust Centre
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.400">
              Demonstrating our commitment to security, privacy, and compliance.
            </Text>
          </VStack>

          {/* Quick Links Section */}
          <VStack align="start" spacing={4}>
            <Heading as="h4" size="sm" color="white">
              Quick Links
            </Heading>
            <VStack align="start" spacing={2}>
              <Link
                href="#overview"
                onClick={(e) => {
                  e.preventDefault();
                  handleScrollTo('overview');
                }}
                color="gray.400"
                _hover={{ color: 'white', textDecoration: 'underline' }}
                fontSize="sm"
              >
                Security Overview
              </Link>
              <Link
                href="#certifications"
                onClick={(e) => {
                  e.preventDefault();
                  handleScrollTo('certifications');
                }}
                color="gray.400"
                _hover={{ color: 'white', textDecoration: 'underline' }}
                fontSize="sm"
              >
                Certifications
              </Link>
              <Link
                href="#documents"
                onClick={(e) => {
                  e.preventDefault();
                  handleScrollTo('documents');
                }}
                color="gray.400"
                _hover={{ color: 'white', textDecoration: 'underline' }}
                fontSize="sm"
              >
                Documentation
              </Link>
            </VStack>
          </VStack>

          {/* Contact Section */}
          <VStack align="start" spacing={4}>
            <Heading as="h4" size="sm" color="white">
              Contact Security Team
            </Heading>
            <Link
              href="mailto:security@company.com"
              color="blue.400"
              _hover={{ color: 'blue.300', textDecoration: 'underline' }}
              fontSize="sm"
            >
              security@company.com
            </Link>
          </VStack>
        </SimpleGrid>

        {/* Copyright */}
        <Box borderTopWidth="1px" borderColor="gray.700" mt={8} pt={8}>
          <Text fontSize="sm" color="gray.500" textAlign="center">
            © {new Date().getFullYear()} Your Company. All rights reserved.
          </Text>
        </Box>
      </Container>
    </Box>
  );
}

