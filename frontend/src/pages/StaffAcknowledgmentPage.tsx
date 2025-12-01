import { useState, useEffect, useRef } from 'react';
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
  Badge,
  Tooltip,
  HStack,
  Spinner,
  Checkbox,
} from '@chakra-ui/react';
import { ExternalLinkIcon, CheckIcon } from '@chakra-ui/icons';
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
  documentUrl?: string | null;
}

// Configurable threshold for overdue acknowledgment (30 days)
const OVERDUE_ACKNOWLEDGMENT_DAYS = 30;

export function StaffAcknowledgmentPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [acknowledging, setAcknowledging] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [acknowledgingDocumentId, setAcknowledgingDocumentId] = useState<string | null>(null);
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
      await fetchPendingDocuments();
      setSelectedDocuments(new Set());
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

  const handleAcknowledgeSelected = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one document to acknowledge',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setAcknowledging(true);
      const documentIds = Array.from(selectedDocuments);
      const response = await api.post('/api/acknowledgments/bulk', { documentIds });
      toast({
        title: 'Success',
        description: `Acknowledged ${response.data.acknowledged} document(s)`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      await fetchPendingDocuments();
      setSelectedDocuments(new Set());
    } catch (error) {
      console.error('Error acknowledging selected documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge selected documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAcknowledgeSingle = async (documentId: string) => {
    try {
      setAcknowledgingDocumentId(documentId);
      await api.post('/api/acknowledgments', { documentId });
      toast({
        title: 'Success',
        description: 'Document acknowledged',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await fetchPendingDocuments();
      // Remove from selection if it was selected
      setSelectedDocuments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    } catch (error) {
      console.error('Error acknowledging document:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge document',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setAcknowledgingDocumentId(null);
    }
  };

  const handleToggleSelect = (documentId: string) => {
    setSelectedDocuments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map((doc) => doc.id)));
    }
  };

  const getDocumentUrl = async (doc: Document): Promise<string | null> => {
    try {
      if (doc.storageLocation === 'SHAREPOINT' && doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId) {
        const graphToken = await authService.getGraphAccessToken();
        
        if (graphToken) {
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

  const formatDateAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Changed today';
    if (diffDays === 1) return 'Changed 1 day ago';
    return `Changed ${diffDays} days ago`;
  };

  const isOverdueAcknowledgment = (dateString: string | null | undefined): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > OVERDUE_ACKNOWLEDGMENT_DAYS;
  };

  const getStorageLocationIcon = (location: string) => {
    // Simple text-based indicator
    return null; // We'll just show the text
  };

  if (loading) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Documents Requiring Your Acknowledgment</Heading>
        <Box p={8} textAlign="center">
          <Spinner size="xl" />
          <Text mt={4}>Loading...</Text>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          Documents Requiring Your Acknowledgment
        </Heading>
        
        {/* Encouragement to review documents */}
        {documents.length > 0 && (
          <Alert status="info" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="medium" mb={1}>
                Please review each document before acknowledging
              </Text>
              <Text fontSize="sm">
                Click "Open" to review the document in SharePoint or Confluence. 
                Acknowledgment confirms you have read and understood the current version.
              </Text>
            </Box>
          </Alert>
        )}
        
        {documents.length === 0 ? (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            You have no documents requiring acknowledgment. You are up to date.
          </Alert>
        ) : (
          <>
            <Box mb={4}>
              <Text mb={4}>
                You have {documents.length} document(s) that require acknowledgment.
                Please review them before acknowledging.
              </Text>
              <HStack spacing={3}>
                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={handleAcknowledgeAll}
                  isLoading={acknowledging}
                >
                  Acknowledge All
                </Button>
                {selectedDocuments.size > 0 && (
                  <Button
                    colorScheme="blue"
                    variant="outline"
                    size="lg"
                    onClick={handleAcknowledgeSelected}
                    isLoading={acknowledging}
                    leftIcon={<CheckIcon />}
                  >
                    Acknowledge Selected ({selectedDocuments.size})
                  </Button>
                )}
              </HStack>
            </Box>

            <Box p={4} bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
              <Table variant="simple" size="sm" minW="800px">
                <Thead>
                  <Tr>
                    <Th width="50px">
                      <Checkbox
                        isChecked={selectedDocuments.size === documents.length && documents.length > 0}
                        isIndeterminate={selectedDocuments.size > 0 && selectedDocuments.size < documents.length}
                        onChange={handleSelectAll}
                      />
                    </Th>
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Version</Th>
                    <Th>Owner</Th>
                    <Th>Storage Location</Th>
                    <Th>Changed / Pending Since</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {documents.map((doc) => {
                    const url = documentUrls[doc.id];
                    const isOverdue = isOverdueAcknowledgment(doc.lastChangedDate);
                    const isSelected = selectedDocuments.has(doc.id);
                    const isAcknowledging = acknowledgingDocumentId === doc.id;
                    return (
                      <Tr key={doc.id} bg={isSelected ? 'blue.50' : undefined}>
                        <Td>
                          <Checkbox
                            isChecked={isSelected}
                            onChange={() => handleToggleSelect(doc.id)}
                          />
                        </Td>
                        <Td maxW="300px">
                          <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {url ? (
                              <Link href={url} isExternal color="blue.500" fontWeight="medium">
                                {doc.title} <ExternalLinkIcon mx="2px" />
                              </Link>
                            ) : (
                              doc.title
                            )}
                          </Box>
                        </Td>
                        <Td whiteSpace="nowrap">{doc.type}</Td>
                        <Td whiteSpace="nowrap">{doc.version}</Td>
                        <Td whiteSpace="nowrap">{doc.owner.displayName}</Td>
                        <Td whiteSpace="nowrap">
                          <Text>{doc.storageLocation}</Text>
                        </Td>
                        <Td whiteSpace="nowrap">
                          {doc.lastChangedDate ? formatDateAgo(doc.lastChangedDate) : 'N/A'}
                          {isOverdue && (
                            <Tooltip label={`This document has been pending acknowledgment for more than ${OVERDUE_ACKNOWLEDGMENT_DAYS} days.`}>
                              <Badge colorScheme="red" ml={2} fontSize="xs">Overdue</Badge>
                            </Tooltip>
                          )}
                        </Td>
                        <Td whiteSpace="nowrap">
                          <HStack spacing={2}>
                            {url && (
                              <Button
                                size="sm"
                                colorScheme="blue"
                                as={Link}
                                href={url}
                                isExternal
                                rightIcon={<ExternalLinkIcon />}
                              >
                                Open
                              </Button>
                            )}
                            <Button
                              size="sm"
                              colorScheme="green"
                              variant="outline"
                              onClick={() => handleAcknowledgeSingle(doc.id)}
                              isLoading={isAcknowledging}
                              isDisabled={isAcknowledging}
                            >
                              Acknowledge
                            </Button>
                          </HStack>
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

