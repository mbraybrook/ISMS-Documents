import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  Spinner,
  Text,
  useDisclosure,
  SimpleGrid,
  Card,
  CardBody,
  Badge,
  HStack,
} from '@chakra-ui/react';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import type { TrustCategoryGroup } from '../types/trust';
import { NDAAcceptanceModal } from '../components/NDAAcceptanceModal';
import { TrustCenterHeader } from '../components/TrustCenterHeader';
import { TrustCenterHero } from '../components/TrustCenterHero';
import { TrustCenterStats } from '../components/TrustCenterStats';
import { TrustCenterCertifications } from '../components/TrustCenterCertifications';
import { TrustCenterDocumentation } from '../components/TrustCenterDocumentation';
import { TrustCenterFooter } from '../components/TrustCenterFooter';

interface TrustCenterSupplier {
  id: string;
  displayName: string;
  description: string;
  category: string;
  complianceSummary: string | null;
}

export function TrustCenterPage() {
  const { isAuthenticated, hasAcceptedTerms } = useTrustAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TrustCategoryGroup[]>([]);
  const [suppliers, setSuppliers] = useState<TrustCenterSupplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        // Use the combined endpoint that returns both public and private documents
        const data = await trustApi.getDocuments();
        setDocuments(data);
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadSuppliers = async () => {
      try {
        setSuppliersLoading(true);
        const data = await trustApi.getSuppliers();
        setSuppliers(data);
      } catch (error) {
        console.error('Error loading suppliers:', error);
      } finally {
        setSuppliersLoading(false);
      }
    };

    loadDocuments();
    loadSuppliers();
  }, [isAuthenticated, hasAcceptedTerms]);

  useEffect(() => {
    // Show NDA modal if user is authenticated but hasn't accepted terms
    // Note: Documents requiring NDA are filtered out by the backend if terms aren't accepted,
    // so we prompt authenticated users to accept terms to see all available documents
    if (isAuthenticated && !hasAcceptedTerms && !loading) {
      onOpen();
    }
  }, [isAuthenticated, hasAcceptedTerms, loading, onOpen]);

  return (
    <>
      <TrustCenterHeader />
      <Box minH="100vh" bg="white">
        <TrustCenterHero />
        <TrustCenterStats />
        <TrustCenterCertifications />
        <TrustCenterDocumentation documents={documents} loading={loading} isAuthenticated={isAuthenticated} />

        {/* Key Suppliers Section - Moved to bottom, less prominent */}
        {suppliersLoading ? (
          <Box textAlign="center" py={8} bg="gray.50">
            <Spinner size="md" />
          </Box>
        ) : suppliers.length > 0 && (
          <Box py={16} px={{ base: 4, md: 8 }} bg="gray.50">
            <Box maxW="container.xl" mx="auto">
              <VStack spacing={6} align="stretch">
                <VStack spacing={2} align="start">
                  <Heading size="lg" color="gray.900">
                    Key Suppliers
                  </Heading>
                  <Text color="gray.600">
                    Our trusted service providers and their compliance posture
                  </Text>
                </VStack>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} variant="outline" bg="white">
                      <CardBody>
                        <VStack align="stretch" spacing={3}>
                          <HStack justify="space-between">
                            <Heading size="sm">{supplier.displayName}</Heading>
                            <Badge colorScheme="blue" fontSize="xs">
                              {supplier.category}
                            </Badge>
                          </HStack>
                          <Text fontSize="sm" color="gray.600">
                            {supplier.description}
                          </Text>
                          {supplier.complianceSummary && (
                            <Box pt={2} borderTopWidth="1px" borderColor="gray.200">
                              <Text fontSize="xs" fontWeight="semibold" color="gray.700" mb={1}>
                                Compliance:
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                {supplier.complianceSummary}
                              </Text>
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
        )}

        <TrustCenterFooter />
      </Box>

      <NDAAcceptanceModal isOpen={isOpen} onClose={onClose} />
    </>
  );
}

