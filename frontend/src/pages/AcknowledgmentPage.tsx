import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
  Text,
  Alert,
  AlertIcon,
  useToast,
} from '@chakra-ui/react';
import api from '../services/api';

interface Document {
  id: string;
  title: string;
  type: string;
  storageLocation: string;
  version: string;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  sharePointSiteId?: string;
  sharePointDriveId?: string;
  sharePointItemId?: string;
  confluenceSpaceKey?: string;
  confluencePageId?: string;
}

export function AcknowledgmentPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [acknowledging, setAcknowledging] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  useEffect(() => {
    // Generate URLs for all documents
    const generateUrls = async () => {
      const urlMap: Record<string, string> = {};
      for (const doc of documents) {
        const url = await getDocumentUrl(doc);
        if (url) {
          urlMap[doc.id] = url;
        }
      }
      setDocumentUrls(urlMap);
    };
    if (documents.length > 0) {
      generateUrls();
    }
  }, [documents]);

  const fetchPendingDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/acknowledgments/pending');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      setAcknowledging(true);
      const response = await api.post('/api/acknowledgments/bulk', {});
      toast({
        title: 'Success',
        description: `Acknowledged ${response.data.acknowledged} document(s)`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      // Refresh the list
      await fetchPendingDocuments();
    } catch (error) {
      console.error('Error acknowledging documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setAcknowledging(false);
    }
  };

  const getDocumentUrl = async (doc: Document): Promise<string | null> => {
    try {
      if (doc.storageLocation === 'SHAREPOINT' && doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId) {
        const response = await api.get('/api/sharepoint/url', {
          params: {
            siteId: doc.sharePointSiteId,
            driveId: doc.sharePointDriveId,
            itemId: doc.sharePointItemId,
          },
        });
        return response.data.url;
      }
      if (doc.storageLocation === 'CONFLUENCE' && doc.confluenceSpaceKey && doc.confluencePageId) {
        const response = await api.get('/api/confluence/url', {
          params: {
            spaceKey: doc.confluenceSpaceKey,
            pageId: doc.confluencePageId,
          },
        });
        return response.data.url;
      }
    } catch (error) {
      console.error('Error generating document URL:', error);
    }
    return null;
  };

  if (loading) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Documents Requiring Acknowledgment</Heading>
        <Box p={8} textAlign="center">
          Loading...
        </Box>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          Documents Requiring Acknowledgment
        </Heading>
        {documents.length === 0 ? (
          <Alert status="success">
            <AlertIcon />
            All documents have been acknowledged!
          </Alert>
        ) : (
          <>
            <Box mb={4}>
              <Text mb={2}>
                You have {documents.length} document(s) that require acknowledgment.
                Please review them and click "Acknowledge All" when ready.
              </Text>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={handleAcknowledgeAll}
                isLoading={acknowledging}
              >
                Acknowledge All
              </Button>
            </Box>

            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Version</Th>
                    <Th>Owner</Th>
                    <Th>Last Review</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {documents.map((doc) => {
                    const url = documentUrls[doc.id];
                    return (
                      <Tr key={doc.id}>
                        <Td>
                          {url ? (
                            <Link href={url} isExternal color="blue.500">
                              {doc.title}
                            </Link>
                          ) : (
                            doc.title
                          )}
                        </Td>
                        <Td>{doc.type}</Td>
                        <Td>{doc.version}</Td>
                        <Td>{doc.owner.displayName}</Td>
                        <Td>
                          {doc.lastReviewDate
                            ? new Date(doc.lastReviewDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </Td>
                        <Td>
                          {url && (
                            <Link href={url} isExternal color="blue.500">
                              Open Document
                            </Link>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          </>
        )}
      </Box>
    </VStack>
  );
}

