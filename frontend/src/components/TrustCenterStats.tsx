import { Box, SimpleGrid, Card, CardBody, VStack, Text, Icon, HStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { trustApi } from '../services/trustApi';
import { CheckCircleIcon, AttachmentIcon } from '@chakra-ui/icons';

interface TrustCenterStats {
  activeCertifications: number;
  policiesAndProcedures: number;
}

export function TrustCenterStats() {
  const [stats, setStats] = useState<TrustCenterStats>({
    activeCertifications: 5,
    policiesAndProcedures: 24,
  });
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await trustApi.getStats();
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
        // Use default values if API fails
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const statCards = [
    {
      icon: CheckCircleIcon,
      value: stats.activeCertifications.toString(),
      title: 'Active Certifications',
      description: 'Industry-recognized security standards',
      color: 'green',
    },
    {
      icon: AttachmentIcon,
      value: stats.policiesAndProcedures.toString(),
      title: 'Policies',
      description: 'Available for download via Trust Centre',
      color: 'blue',
    },
  ];

  return (
    <Box py={12} px={{ base: 4, md: 8 }} bg="white">
      <Box maxW="container.xl" mx="auto">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          {statCards.map((stat, index) => (
            <Card
              key={index}
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="lg"
              _hover={{
                boxShadow: 'md',
                borderColor: `${stat.color}.300`,
                transform: 'translateY(-2px)',
              }}
              transition="all 0.2s"
            >
              <CardBody>
                <HStack spacing={4} align="start">
                  <Box
                    p={3}
                    bg={`${stat.color}.50`}
                    borderRadius="md"
                    color={`${stat.color}.600`}
                  >
                    <Icon as={stat.icon} boxSize={6} />
                  </Box>
                  <VStack align="start" spacing={1} flex={1}>
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      color="gray.900"
                    >
                      {stat.value}
                    </Text>
                    <Text fontWeight="semibold" color="gray.900" fontSize="sm">
                      {stat.title}
                    </Text>
                    <Text color="gray.600" fontSize="xs">
                      {stat.description}
                    </Text>
                  </VStack>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}

