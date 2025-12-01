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
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { trustApi } from '../services/trustApi';
import type { TrustCategoryGroup } from '../types/trust';
import { TrustCategorySection } from '../components/TrustCategorySection';

export function TrustCenterPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useTrustAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<TrustCategoryGroup[]>([]);

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
  }, [isAuthenticated]);

  return (
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
    </Container>
  );
}

