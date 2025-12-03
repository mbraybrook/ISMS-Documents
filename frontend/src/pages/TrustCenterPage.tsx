import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Spinner,
  Text,
  Container,
  Divider,
  useDisclosure,
  SimpleGrid,
  Card,
  CardBody,
  Badge,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import type { TrustCategoryGroup } from '../types/trust';
import { TrustCategorySection } from '../components/TrustCategorySection';
import { NDAAcceptanceModal } from '../components/NDAAcceptanceModal';
import { DataSensitivityFooter } from '../components/DataSensitivityFooter';

interface TrustCenterSupplier {
  id: string;
  displayName: string;
  description: string;
  category: string;
  complianceSummary: string | null;
}

export function TrustCenterPage() {
  const navigate = useNavigate();
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
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={4}>
            Trust Center
          </Heading>
          <Text color="gray.600" mb={6}>
            Access our policies, certifications, and reports
          </Text>
        </Box>

        <HStack spacing={4} justify="flex-end">
          {!isAuthenticated ? (
            <>
              <Button onClick={() => navigate('/login')} variant="outline">
                Login
              </Button>
              <Button onClick={() => navigate('/login')} colorScheme="blue">
                Register
              </Button>
            </>
          ) : (
            <Text fontSize="sm" color="gray.600">
              Viewing public and private documents
            </Text>
          )}
        </HStack>

        <Divider />

        {/* Key Suppliers Section */}
        {suppliersLoading ? (
          <Box textAlign="center" py={4}>
            <Spinner size="md" />
          </Box>
        ) : suppliers.length > 0 && (
          <Box>
            <Heading size="md" mb={4}>
              Key Suppliers
            </Heading>
            <Text color="gray.600" mb={4}>
              Our trusted service providers and their compliance posture
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              {suppliers.map((supplier) => (
                <Card key={supplier.id} variant="outline">
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
            <Divider mt={8} />
          </Box>
        )}

        {/* Documents Section */}
        {loading ? (
          <Box textAlign="center" py={8}>
            <Spinner size="xl" />
          </Box>
        ) : documents.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No public documents available</Text>
          </Box>
        ) : (
          <VStack spacing={8} align="stretch">
            {documents.map((group) => (
              <TrustCategorySection key={group.category} category={group.category} documents={group.documents} />
            ))}
          </VStack>
        )}
      </VStack>

      <NDAAcceptanceModal isOpen={isOpen} onClose={onClose} />
    </Container>
    <DataSensitivityFooter />
    </>
  );
}

