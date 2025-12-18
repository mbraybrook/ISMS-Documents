import { Box, Heading, Text, SimpleGrid, Card, CardBody, VStack, HStack, Badge } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { trustApi } from '../services/trustApi';

interface Certification {
  id: string;
  name: string;
  type: 'certified' | 'compliant';
  description: string;
  validUntil: string | null;
  displayOrder: number;
  documentCount: number;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    version: string;
    status: string;
    visibilityLevel: string;
  }>;
}

export function TrustCenterCertifications() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCertifications = async () => {
      try {
        setLoading(true);
        const data = await trustApi.getCertifications();
        // Sort by displayOrder
        const sorted = [...data].sort((a, b) => a.displayOrder - b.displayOrder);
        setCertifications(sorted);
      } catch (error) {
        console.error('Error loading certifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCertifications();
  }, []);

  // Default certifications if API returns empty
  const defaultCertifications: Certification[] = [
    {
      id: 'iso27001',
      name: 'ISO 27001',
      type: 'certified',
      description: 'Information Security Management',
      validUntil: '2025-12-31',
      displayOrder: 1,
    },
    {
      id: 'soc2',
      name: 'SOC 2 Type II',
      type: 'certified',
      description: 'Security, Availability & Confidentiality',
      validUntil: '2025-11-30',
      displayOrder: 2,
    },
    {
      id: 'gdpr',
      name: 'GDPR',
      type: 'compliant',
      description: 'General Data Protection Regulation',
      validUntil: null,
      displayOrder: 3,
    },
    {
      id: 'hipaa',
      name: 'HIPAA',
      type: 'compliant',
      description: 'Health Information Privacy',
      validUntil: null,
      displayOrder: 4,
    },
    {
      id: 'pci',
      name: 'PCI DSS',
      type: 'certified',
      description: 'Payment Card Industry Standard',
      validUntil: '2025-03-31',
      displayOrder: 5,
    },
  ];

  const displayCertifications = certifications.length > 0 ? certifications : defaultCertifications;

  const formatValidUntil = (dateString: string | null): string => {
    if (!dateString) return 'Ongoing';
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      return `Valid until: ${month} ${year}`;
    } catch {
      return 'Ongoing';
    }
  };

  return (
    <Box
      id="certifications"
      py={16}
      px={{ base: 4, md: 8 }}
      bg="gray.50"
    >
      <Box maxW="container.xl" mx="auto">
        <VStack spacing={8} align="stretch">
          <VStack spacing={4} align="start">
            <Heading as="h2" size="xl" color="gray.900">
              Certifications & Compliance
            </Heading>
            <Text fontSize="lg" color="gray.600" maxW="2xl">
              We maintain rigorous compliance with industry-leading security standards and regulations.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {displayCertifications.map((cert) => (
              <Card
                key={cert.id}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="lg"
                _hover={{
                  boxShadow: 'md',
                  borderColor: cert.type === 'certified' ? 'green.300' : 'blue.300',
                  transform: 'translateY(-2px)',
                }}
                transition="all 0.2s"
              >
                <CardBody>
                  <VStack align="start" spacing={4}>
                    <HStack justify="space-between" w="100%">
                      <Heading as="h3" size="md" color="gray.900">
                        {cert.name}
                      </Heading>
                      <Badge
                        colorScheme={cert.type === 'certified' ? 'green' : 'blue'}
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="xs"
                        fontWeight="semibold"
                      >
                        {cert.type === 'certified' ? 'Certified' : 'Compliant'}
                      </Badge>
                    </HStack>
                    <Text color="gray.600" fontSize="sm">
                      {cert.description}
                    </Text>
                    <Text color="gray.500" fontSize="xs" fontStyle="italic">
                      {formatValidUntil(cert.validUntil)}
                    </Text>
                    {cert.documentCount > 0 && (
                      <Box w="100%" pt={2} borderTopWidth="1px" borderColor="gray.200">
                        <Text fontSize="xs" color="gray.600" fontWeight="semibold" mb={2}>
                          {cert.documentCount} document{cert.documentCount !== 1 ? 's' : ''} available
                        </Text>
                        <VStack align="stretch" spacing={1}>
                          {cert.documents.slice(0, 3).map((doc) => (
                            <Text key={doc.id} fontSize="xs" color="gray.500" isTruncated>
                              • {doc.title}
                            </Text>
                          ))}
                          {cert.documentCount > 3 && (
                            <Text fontSize="xs" color="gray.400" fontStyle="italic">
                              +{cert.documentCount - 3} more
                            </Text>
                          )}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>
      </Box>
    </Box>
  );
}

