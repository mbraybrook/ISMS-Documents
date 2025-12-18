import { Box, Badge, Heading, Text, VStack } from '@chakra-ui/react';

export function TrustCenterHero() {
  return (
    <Box
      id="overview"
      bg="gray.50"
      py={16}
      px={{ base: 4, md: 8 }}
    >
      <Box maxW="container.xl" mx="auto">
        <VStack spacing={8} align="stretch">
          {/* Badge and Heading */}
          <VStack spacing={4} align="start">
            <Badge
              colorScheme="blue"
              px={3}
              py={1}
              borderRadius="full"
              fontSize="sm"
              fontWeight="semibold"
            >
              Security & Compliance
            </Badge>
            <Heading
              as="h1"
              size="2xl"
              color="gray.900"
              fontWeight="bold"
            >
              Paythru Trust Centre
            </Heading>
            <Text
              fontSize="lg"
              color="gray.600"
              maxW="2xl"
            >
              Access our security policies, certifications, and compliance documentation. We are committed to protecting your data with industry-leading security practices.
            </Text>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
}

