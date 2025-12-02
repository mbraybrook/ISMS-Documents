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
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import type { TrustCategoryGroup } from '../types/trust';
import { TrustCategorySection } from '../components/TrustCategorySection';
import { NDAAcceptanceModal } from '../components/NDAAcceptanceModal';
import { DataSensitivityFooter } from '../components/DataSensitivityFooter';

export function TrustCenterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hasAcceptedTerms } = useTrustAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TrustCategoryGroup[]>([]);
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

    loadDocuments();
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

