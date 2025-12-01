import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  Spinner,
  Text,
  Container,
  Button,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import type { TrustCategoryGroup } from '../types/trust';
import { TrustCategorySection } from '../components/TrustCategorySection';
import { NDAAcceptanceModal } from '../components/NDAAcceptanceModal';

export function TrustCenterPrivatePage() {
  const navigate = useNavigate();
  const { isAuthenticated, hasAcceptedTerms, user } = useTrustAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TrustCategoryGroup[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const loadDocuments = async () => {
      try {
        setLoading(true);
        const data = await trustApi.getPrivateDocuments();
        setDocuments(data);
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
        }
        console.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [isAuthenticated, navigate]);

  // Check if any document requires NDA and user hasn't accepted
  const hasNdaRequired = documents.some((group) =>
    group.documents.some((doc) => doc.requiresNda)
  );

  useEffect(() => {
    if (hasNdaRequired && !hasAcceptedTerms && !loading) {
      onOpen();
    }
  }, [hasNdaRequired, hasAcceptedTerms, loading, onOpen]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={4}>
            Private Documents
          </Heading>
          <Text color="gray.600">
            Confidential documents for approved users
          </Text>
        </Box>

        <Button onClick={() => navigate('/')} variant="outline" alignSelf="flex-start">
          Back to Public Documents
        </Button>

        {loading ? (
          <Box textAlign="center" py={8}>
            <Spinner size="xl" />
          </Box>
        ) : documents.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No private documents available</Text>
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
  );
}

