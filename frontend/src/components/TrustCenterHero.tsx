import { Box, Badge, Heading, Text, SimpleGrid, Card, CardBody, VStack, HStack, Icon } from '@chakra-ui/react';
import { LockIcon, CheckCircleIcon } from '@chakra-ui/icons';

export function TrustCenterHero() {
  const features = [
    {
      icon: LockIcon,
      title: 'Data Encryption',
      description: 'AES-256 at rest',
    },
    {
      icon: CheckCircleIcon,
      title: 'SOC 2 Type II',
      description: 'Certified',
    },
    {
      icon: CheckCircleIcon,
      title: 'GDPR',
      description: 'Compliant',
    },
  ];

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
              Your Trust is Our Priority
            </Heading>
            <Text
              fontSize="lg"
              color="gray.600"
              maxW="2xl"
            >
              Access our security policies, certifications, and compliance documentation. We are committed to protecting your data with industry-leading security practices.
            </Text>
          </VStack>

          {/* Feature Cards */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mt={8}>
            {features.map((feature, index) => (
              <Card
                key={index}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="lg"
                _hover={{
                  boxShadow: 'md',
                  borderColor: 'blue.300',
                  transform: 'translateY(-2px)',
                }}
                transition="all 0.2s"
              >
                <CardBody>
                  <HStack spacing={4} align="start">
                    <Box
                      p={3}
                      bg="blue.50"
                      borderRadius="md"
                      color="blue.600"
                    >
                      <Icon as={feature.icon} boxSize={6} />
                    </Box>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="semibold" color="gray.900" fontSize="md">
                        {feature.title}
                      </Text>
                      <Text color="gray.600" fontSize="sm">
                        {feature.description}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>
      </Box>
    </Box>
  );
}

