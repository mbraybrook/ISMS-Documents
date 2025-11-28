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
import { authService } from '../services/authService';

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
  lastChangedDate?: string | null;
  sharePointSiteId?: string;
  sharePointDriveId?: string;
  sharePointItemId?: string;
  confluenceSpaceKey?: string;
  confluencePageId?: string;
  documentUrl?: string | null; // Cached URL for the document
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
    // Use stored URLs first, generate only if missing
    const generateUrls = async () => {
      const urlMap: Record<string, string> = {};
      for (const doc of documents) {
        // Use stored documentUrl if available
        if (doc.documentUrl) {
          urlMap[doc.id] = doc.documentUrl;
          continue;
        }
        
        // Only generate URL if not stored
        const url = await getDocumentUrl(doc);
        if (url) {
          urlMap[doc.id] = url;
        }
      }
      setDocumentUrls(urlMap);
    };
    if (documents.length > 0) {
      generateUrls();
    } else {
      setDocumentUrls({});
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
        // Get Graph token and pass it to the URL endpoint
        const graphToken = await authService.getGraphAccessToken();
        
        if (graphToken) {
          // First, try to get webUrl directly from the item endpoint (fastest)
          try {
            const response = await api.get(`/api/sharepoint/items/${doc.sharePointItemId}`, {
              params: {
                siteId: doc.sharePointSiteId,
                driveId: doc.sharePointDriveId,
              },
              headers: {
                'x-graph-token': graphToken,
              },
            });
            if (response.data?.webUrl) {
              return response.data.webUrl;
            }
          } catch (error) {
            console.error('Error fetching SharePoint item:', error);
          }

          // Fallback: use the URL endpoint with the token
          try {
            const response = await api.get('/api/sharepoint/url', {
              params: {
                siteId: doc.sharePointSiteId,
                driveId: doc.sharePointDriveId,
                itemId: doc.sharePointItemId,
              },
              headers: {
                'x-graph-token': graphToken,
              },
            });
            if (response.data?.url) {
              return response.data.url;
            }
          } catch (error) {
            console.error('Error generating SharePoint URL:', error);
          }
        } else {
          // No token available - cannot generate URL
          console.warn('No Graph access token available for SharePoint document URL');
        }
        return null;
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
        <Alert status="info" mb={4}>
          <AlertIcon />
          Showing only documents that require staff acknowledgment (typically Policy documents).
          Documents are shown here when their version has changed since your last acknowledgment.
        </Alert>
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
                    <Th>Last Changed</Th>
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
                          {doc.lastChangedDate
                            ? new Date(doc.lastChangedDate).toLocaleDateString('en-GB', {
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

