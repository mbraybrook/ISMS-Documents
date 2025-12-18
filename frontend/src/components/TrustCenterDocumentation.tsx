import { Box, Heading, Text, VStack, SimpleGrid, Badge } from '@chakra-ui/react';
import { TrustDocumentCard } from './TrustDocumentCard';
import type { TrustCategoryGroup } from '../types/trust';
import { AttachmentIcon, CheckCircleIcon } from '@chakra-ui/icons';
import { HStack, Icon } from '@chakra-ui/react';

interface TrustCenterDocumentationProps {
  documents: TrustCategoryGroup[];
  loading: boolean;
  isAuthenticated?: boolean;
}

export function TrustCenterDocumentation({ documents, loading, isAuthenticated = false }: TrustCenterDocumentationProps) {
  // Separate documents into Policies and Certifications & Reports
  const policies = documents.find((g) => g.category === 'policy')?.documents || [];
  const certificationsAndReports = documents
    .filter((g) => g.category === 'certification' || g.category === 'report')
    .flatMap((g) => g.documents);
  
  // Group certification documents by certificate
  const certificationsByCert = certificationsAndReports
    .filter((doc) => doc.category === 'certification' && doc.certificate)
    .reduce((acc, doc) => {
      const certId = doc.certificate!.id;
      if (!acc[certId]) {
        acc[certId] = {
          certificate: doc.certificate!,
          documents: [],
        };
      }
      acc[certId].documents.push(doc);
      return acc;
    }, {} as Record<string, { certificate: { id: string; name: string; type: string }; documents: typeof certificationsAndReports }>);
  
  // Reports are documents with category='report' or certification documents without a certificate link
  const reports = certificationsAndReports.filter(
    (doc) => doc.category === 'report' || (doc.category === 'certification' && !doc.certificate)
  );

  if (loading) {
    return (
      <Box py={8} textAlign="center">
        <Text color="gray.500">Loading documents...</Text>
      </Box>
    );
  }

  return (
    <Box
      id="documents"
      py={16}
      px={{ base: 4, md: 8 }}
      bg="white"
    >
      <Box maxW="container.xl" mx="auto">
        <VStack spacing={12} align="stretch">
          {/* Section Header */}
          <VStack spacing={4} align="start">
            <Heading as="h2" size="xl" color="gray.900">
              Documentation Library
            </Heading>
            <Text fontSize="lg" color="gray.600" maxW="2xl">
              Access our security policies, compliance reports, and certification documents.
            </Text>
          </VStack>

          {/* Policies Subsection */}
          {policies.length > 0 && (
            <Box>
              <HStack spacing={3} mb={6}>
                <Icon as={AttachmentIcon} boxSize={5} color="blue.600" />
                <Heading as="h3" size="lg" color="gray.900">
                  Policies
                </Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {policies.map((doc) => (
                  <TrustDocumentCard key={doc.id} document={doc} isAuthenticated={isAuthenticated} />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Certifications grouped by certificate */}
          {Object.keys(certificationsByCert).length > 0 && (
            <Box>
              <HStack spacing={3} mb={6}>
                <Icon as={CheckCircleIcon} boxSize={5} color="green.600" />
                <Heading as="h3" size="lg" color="gray.900">
                  Certifications
                </Heading>
              </HStack>
              <VStack spacing={8} align="stretch">
                {Object.values(certificationsByCert).map((group) => (
                  <Box key={group.certificate.id} id={`cert-${group.certificate.id}`} scrollMarginTop="100px">
                    <HStack spacing={2} mb={4}>
                      <Text fontWeight="semibold" color="gray.700">
                        {group.certificate.name}
                      </Text>
                      <Badge
                        colorScheme={group.certificate.type === 'certified' ? 'green' : 'blue'}
                        fontSize="xs"
                      >
                        {group.certificate.type}
                      </Badge>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                      {group.documents.map((doc) => (
                        <TrustDocumentCard key={doc.id} document={doc} isAuthenticated={isAuthenticated} />
                      ))}
                    </SimpleGrid>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}

          {/* Reports Subsection */}
          {reports.length > 0 && (
            <Box>
              <HStack spacing={3} mb={6}>
                <Icon as={AttachmentIcon} boxSize={5} color="purple.600" />
                <Heading as="h3" size="lg" color="gray.900">
                  Reports
                </Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {reports.map((doc) => (
                  <TrustDocumentCard key={doc.id} document={doc} isAuthenticated={isAuthenticated} />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Empty State */}
          {policies.length === 0 && Object.keys(certificationsByCert).length === 0 && reports.length === 0 && (
            <Box textAlign="center" py={8}>
              <Text color="gray.500">No documents available</Text>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  );
}

