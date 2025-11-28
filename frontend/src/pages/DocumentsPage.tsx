import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Select,
  Input,
  HStack,
  VStack,
  Badge,
  Link,
  useDisclosure,
  useToast,
  IconButton,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure as useAlertDisclosure,
  Checkbox,
  Text,
  Spinner,
  Wrap,
  WrapItem,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { SearchIcon, CloseIcon, BellIcon, WarningIcon } from '@chakra-ui/icons';
import { ChevronUpIcon, ChevronDownIcon, DeleteIcon, ViewIcon, ExternalLinkIcon, TimeIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { authService } from '../services/authService';
import { DocumentFormModal } from '../components/DocumentFormModal';

interface Document {
  id: string;
  title: string;
  type: string;
  storageLocation: string;
  version: string;
  status: string;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  requiresAcknowledgement?: boolean;
  lastChangedDate?: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  sharePointSiteId?: string;
  sharePointDriveId?: string;
  sharePointItemId?: string;
  confluenceSpaceKey?: string;
  confluencePageId?: string;
}

export function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    ownerId: '',
    search: '',
    requiresAcknowledgement: '',
  });
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const { isOpen: isHardDeleteOpen, onOpen: onHardDeleteOpen, onClose: onHardDeleteClose } = useAlertDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [documentToHardDelete, setDocumentToHardDelete] = useState<Document | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const toast = useToast();

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.type) count++;
    if (filters.status) count++;
    if (filters.ownerId) count++;
    if (filters.search) count++;
    if (filters.requiresAcknowledgement) count++;
    return count;
  };

  // Handle search with debouncing
  useEffect(() => {
    if (filters.search) {
      setSearchLoading(true);
      const timer = setTimeout(() => {
        setSearchLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchLoading(false);
    }
  }, [filters.search]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Escape key - close dialogs or clear selection
      if (e.key === 'Escape') {
        if (isOpen) onClose();
        else if (isDeleteOpen) onDeleteClose();
        else if (isHardDeleteOpen) onHardDeleteClose();
        else if (isViewOpen) onViewClose();
        else if (selectedDocuments.size > 0) {
          setSelectedDocuments(new Set());
        }
      }
      // Ctrl+N or Cmd+N - Create new document (only if no modal is open)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isOpen && !isDeleteOpen && !isHardDeleteOpen && !isViewOpen) {
        e.preventDefault();
        if (canEdit) {
          setSelectedDocument(null);
          onOpen();
        }
      }
      // Delete key - Supersede selected documents (only if no modal is open and documents are selected)
      if (e.key === 'Delete' && !isOpen && !isDeleteOpen && !isHardDeleteOpen && !isViewOpen && selectedDocuments.size > 0 && canEdit) {
        e.preventDefault();
        const confirmed = window.confirm(
          `Are you sure you want to supersede ${selectedDocuments.size} document(s)? This will mark them as SUPERSEDED.`
        );
        if (confirmed) {
          const deletePromises = Array.from(selectedDocuments).map((id) =>
            api.delete(`/api/documents/${id}`)
          );
          Promise.all(deletePromises).then(() => {
            toast({
              title: 'Success',
              description: `Successfully superseded ${selectedDocuments.size} document(s)`,
              status: 'success',
              duration: 3000,
              isClosable: true,
              position: 'top-right',
            });
            setSelectedDocuments(new Set());
            fetchDocuments();
          }).catch((error: any) => {
            toast({
              title: 'Error',
              description: 'Failed to supersede some documents',
              status: 'error',
              duration: 5000,
              isClosable: true,
              position: 'top-right',
            });
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [isOpen, isDeleteOpen, isHardDeleteOpen, isViewOpen, onClose, onDeleteClose, onHardDeleteClose, onViewClose, selectedDocuments, canEdit]);

  useEffect(() => {
    fetchDocuments();
  }, [filters]);

  useEffect(() => {
    // Generate URLs for all documents
    const generateUrls = async () => {
      setLoadingUrls(true);
      const urlMap: Record<string, string> = {};
      for (const doc of documents) {
        const url = await getDocumentUrl(doc);
        if (url) {
          urlMap[doc.id] = url;
        }
      }
      setDocumentUrls(urlMap);
      setLoadingUrls(false);
    };
    if (documents.length > 0) {
      generateUrls();
    }
  }, [documents]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.ownerId) params.ownerId = filters.ownerId;
      // Don't use backend pagination - we'll do client-side for now to support search
      params.limit = 1000; // Get all documents for client-side filtering/search

      const response = await api.get('/api/documents', { params });
      console.log('[FRONTEND] Documents API response:', {
        hasData: !!response.data,
        hasDataData: !!response.data?.data,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : response.data?.data?.length || 0,
        responseKeys: Object.keys(response.data || {}),
        sample: response.data?.data?.[0] || response.data?.[0] || null,
      });
      const docs = response.data.data || response.data;
      setAllDocuments(Array.isArray(docs) ? docs : []);
      setDocuments(Array.isArray(docs) ? docs : []);
      setCurrentPage(1); // Reset to first page when filters change
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc: Document) => {
    setSelectedDocument(doc);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedDocument(null);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setSelectedDocument(null);
    fetchDocuments();
  };

  const getDocumentUrl = async (doc: Document): Promise<string | null> => {
    try {
      if (doc.storageLocation === 'SHAREPOINT' && doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId) {
        // Get the SharePoint item to get the webUrl
        try {
          const graphToken = await authService.getGraphAccessToken();
          if (graphToken) {
            const response = await api.get(`/api/sharepoint/items/${doc.sharePointItemId}`, {
              params: {
                siteId: doc.sharePointSiteId,
                driveId: doc.sharePointDriveId,
              },
              headers: {
                'x-graph-token': graphToken,
              },
            });
            return response.data.webUrl;
          }
        } catch (error) {
          console.error('Error fetching SharePoint item:', error);
        }
        // Fallback to generated URL
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

  const handleDelete = (doc: Document) => {
    setDocumentToDelete(doc);
    onDeleteOpen();
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      await api.delete(`/api/documents/${documentToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Document superseded successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      onDeleteClose();
      setDocumentToDelete(null);
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to supersede document',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleHardDelete = (doc: Document) => {
    setDocumentToHardDelete(doc);
    onHardDeleteOpen();
  };

  const confirmHardDelete = async () => {
    if (!documentToHardDelete) return;

    try {
      await api.delete(`/api/documents/${documentToHardDelete.id}`, {
        params: { hard: true }
      });
      toast({
        title: 'Success',
        description: 'Document permanently deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      onHardDeleteClose();
      setDocumentToHardDelete(null);
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete document',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to supersede ${selectedDocuments.size} document(s)? This will mark them as SUPERSEDED.`
    );
    if (!confirmed) return;

    try {
      const deletePromises = Array.from(selectedDocuments).map((id) =>
        api.delete(`/api/documents/${id}`)
      );
      await Promise.all(deletePromises);
      toast({
        title: 'Success',
        description: `Successfully superseded ${selectedDocuments.size} document(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete some documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(new Set(getSortedAndFilteredDocuments().map((d) => d.id)));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const handleSelectDocument = (docId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(docId);
    } else {
      newSelected.delete(docId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedAndFilteredDocuments = () => {
    let filtered = allDocuments;

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply requiresAcknowledgement filter
    if (filters.requiresAcknowledgement === 'true') {
      filtered = filtered.filter((doc) => doc.requiresAcknowledgement === true);
    } else if (filters.requiresAcknowledgement === 'false') {
      filtered = filtered.filter((doc) => !doc.requiresAcknowledgement);
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof Document];
        let bVal: any = b[sortField as keyof Document];

        // Handle nested objects
        if (sortField === 'owner') {
          aVal = a.owner.displayName;
          bVal = b.owner.displayName;
        }

        // Handle dates
        if (sortField === 'nextReviewDate' || sortField === 'lastReviewDate') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // Handle strings
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const getPaginatedDocuments = () => {
    const filtered = getSortedAndFilteredDocuments();
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filtered.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getSortedAndFilteredDocuments().length / pageSize);

  const SortableHeader = ({ field, children, width, minW }: { field: string; children: React.ReactNode; width?: string; minW?: string }) => {
    const isSorted = sortField === field;
    return (
      <Th
        cursor="pointer"
        userSelect="none"
        onClick={() => handleSort(field)}
        _hover={{ bg: 'blue.50' }}
        bg={isSorted ? 'blue.50' : 'transparent'}
        width={width}
        minW={minW}
        px={2}
        transition="background-color 0.2s"
      >
        <HStack spacing={2}>
          <Box fontWeight={isSorted ? 'semibold' : 'normal'}>{children}</Box>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ChevronUpIcon boxSize={4} color="blue.500" />
            ) : (
              <ChevronDownIcon boxSize={4} color="blue.500" />
            )
          ) : (
            <Box boxSize={4} /> // Spacer to maintain alignment
          )}
        </HStack>
      </Th>
    );
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'gray',
    IN_REVIEW: 'yellow',
    APPROVED: 'green',
    SUPERSEDED: 'red',
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ');
  };

  const isOverdueForReview = (doc: Document): boolean => {
    if (!doc.nextReviewDate) return false;
    return new Date(doc.nextReviewDate) < new Date();
  };

  const isUpcomingForReview = (doc: Document): boolean => {
    if (!doc.nextReviewDate) return false;
    const reviewDate = new Date(doc.nextReviewDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    return reviewDate >= now && reviewDate <= thirtyDaysFromNow;
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Documents</Heading>
        {canEdit && (
          <HStack>
            <Button colorScheme="green" variant="outline" onClick={() => navigate('/documents/import')}>
              Mass Import
            </Button>
            <Button colorScheme="blue" onClick={handleCreate}>
              Create Document
            </Button>
          </HStack>
        )}
      </HStack>

      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <VStack spacing={3} align="stretch" mb={4}>
          <HStack justify="space-between">
            <Heading size="sm">Filters</Heading>
            {getActiveFilterCount() > 0 && (
              <Badge colorScheme="blue" fontSize="sm">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </HStack>
          <HStack spacing={4} flexWrap="wrap">
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                {searchLoading ? <Spinner size="xs" /> : <SearchIcon color="gray.300" />}
              </InputLeftElement>
              <Input
                placeholder="Search by title..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </InputGroup>
            <Select
              placeholder="Filter by Type"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              maxW="200px"
            >
              <option value="POLICY">Policy</option>
              <option value="PROCEDURE">Procedure</option>
              <option value="MANUAL">Manual</option>
              <option value="RECORD">Record</option>
              <option value="TEMPLATE">Template</option>
              <option value="OTHER">Other</option>
            </Select>
            <Select
              placeholder="Filter by Status"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              maxW="200px"
            >
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="SUPERSEDED">Superseded</option>
            </Select>
            <Select
              placeholder="Acknowledgment"
              value={filters.requiresAcknowledgement}
              onChange={(e) => setFilters({ ...filters, requiresAcknowledgement: e.target.value })}
              maxW="200px"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
            <Button 
              size="sm" 
              onClick={() => setFilters({ type: '', status: '', ownerId: '', search: '', requiresAcknowledgement: '' })}
              isDisabled={getActiveFilterCount() === 0}
            >
              Clear Filters
            </Button>
          </HStack>
          
          {/* Filter chips */}
          {getActiveFilterCount() > 0 && (
            <Wrap spacing={2}>
              {filters.type && (
                <WrapItem>
                  <Badge colorScheme="blue" display="flex" alignItems="center" gap={1}>
                    Type: {filters.type}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setFilters({ ...filters, type: '' })}
                      aria-label="Remove type filter"
                    >
                      <CloseIcon boxSize={2} />
                    </Button>
                  </Badge>
                </WrapItem>
              )}
              {filters.status && (
                <WrapItem>
                  <Badge colorScheme="blue" display="flex" alignItems="center" gap={1}>
                    Status: {filters.status}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setFilters({ ...filters, status: '' })}
                      aria-label="Remove status filter"
                    >
                      <CloseIcon boxSize={2} />
                    </Button>
                  </Badge>
                </WrapItem>
              )}
              {filters.requiresAcknowledgement && (
                <WrapItem>
                  <Badge colorScheme="blue" display="flex" alignItems="center" gap={1}>
                    Acknowledgment: {filters.requiresAcknowledgement === 'true' ? 'Yes' : 'No'}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setFilters({ ...filters, requiresAcknowledgement: '' })}
                      aria-label="Remove acknowledgment filter"
                    >
                      <CloseIcon boxSize={2} />
                    </Button>
                  </Badge>
                </WrapItem>
              )}
              {filters.search && (
                <WrapItem>
                  <Badge colorScheme="blue" display="flex" alignItems="center" gap={1}>
                    Search: "{filters.search}"
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setFilters({ ...filters, search: '' })}
                      aria-label="Remove search filter"
                    >
                      <CloseIcon boxSize={2} />
                    </Button>
                  </Badge>
                </WrapItem>
              )}
            </Wrap>
          )}

          {/* Bulk actions bar - inline with filters */}
          {canEdit && selectedDocuments.size > 0 && (
            <HStack p={3} bg="blue.50" borderRadius="md" boxShadow="sm" spacing={3}>
              <Text fontWeight="semibold">
                {selectedDocuments.size} document(s) selected
              </Text>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={handleBulkDelete}
              >
                Supersede Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedDocuments(new Set())}
              >
                Clear Selection
              </Button>
            </HStack>
          )}
        </VStack>

        {loading ? (
          <Box p={8} textAlign="center">
            <Spinner size="xl" />
            <Text mt={4}>Loading documents...</Text>
          </Box>
        ) : getSortedAndFilteredDocuments().length === 0 ? (
          <Box p={8} textAlign="center">
            <Text fontSize="lg" color="gray.500" mb={4}>
              {filters.search || filters.type || filters.status
                ? 'No documents match your filters.'
                : 'No documents yet.'}
            </Text>
            {canEdit && !filters.search && !filters.type && !filters.status && (
              <Button colorScheme="blue" onClick={handleCreate}>
                Create Document
              </Button>
            )}
          </Box>
        ) : (
          <>
            <Box overflowX="auto">
              <Table variant="simple" size="sm" minW="1000px">
                <Thead>
                  <Tr>
                    {canEdit && (
                      <Th width="40px" px={2}>
                        <Checkbox
                          isChecked={
                            getPaginatedDocuments().length > 0 &&
                            getPaginatedDocuments().every((d) => selectedDocuments.has(d.id))
                          }
                          isIndeterminate={
                            getPaginatedDocuments().some((d) => selectedDocuments.has(d.id)) &&
                            !getPaginatedDocuments().every((d) => selectedDocuments.has(d.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newSelected = new Set(selectedDocuments);
                              getPaginatedDocuments().forEach((d) => newSelected.add(d.id));
                              setSelectedDocuments(newSelected);
                            } else {
                              const newSelected = new Set(selectedDocuments);
                              getPaginatedDocuments().forEach((d) => newSelected.delete(d.id));
                              setSelectedDocuments(newSelected);
                            }
                          }}
                        />
                      </Th>
                    )}
                    <SortableHeader field="title" minW="200px">Title</SortableHeader>
                    <SortableHeader field="type" width="100px">Type</SortableHeader>
                    <SortableHeader field="status" width="100px">Status</SortableHeader>
                    <SortableHeader field="version" width="80px">Version</SortableHeader>
                    <SortableHeader field="owner" width="120px">Owner</SortableHeader>
                    <SortableHeader field="lastReviewDate" width="110px">Last Review</SortableHeader>
                    <SortableHeader field="nextReviewDate" width="110px">Next Review</SortableHeader>
                    <Th width="150px">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {getPaginatedDocuments().map((doc, index) => {
                    const url = documentUrls[doc.id];
                    const isSelected = selectedDocuments.has(doc.id);
                    const isEven = index % 2 === 0;
                    return (
                      <Tr
                        key={doc.id}
                        _hover={{ bg: isSelected ? 'blue.100' : 'gray.100' }}
                        transition="background-color 0.2s"
                        bg={
                          isSelected 
                            ? 'blue.50' 
                            : isEven 
                            ? 'white' 
                            : 'gray.50'
                        }
                      >
                        {canEdit && (
                          <Td px={2}>
                            <Checkbox
                              isChecked={isSelected}
                              onChange={(e) => handleSelectDocument(doc.id, e.target.checked)}
                            />
                          </Td>
                        )}
                        <Td px={2} maxW="200px">
                          <Tooltip
                            label={
                              doc.lastChangedDate
                                ? `${doc.title} - Last changed: ${new Date(doc.lastChangedDate).toLocaleDateString('en-GB')}`
                                : doc.title
                            }
                          >
                            <VStack align="start" spacing={1}>
                              <HStack spacing={2} width="100%">
                                {/* Status icons - more subtle than badges */}
                                {doc.requiresAcknowledgement && (
                                  <Tooltip label="Requires Acknowledgment">
                                    <BellIcon boxSize={3} color="blue.500" />
                                  </Tooltip>
                                )}
                                {isOverdueForReview(doc) && (
                                  <Tooltip label="Overdue for Review">
                                    <WarningIcon boxSize={3} color="red.500" />
                                  </Tooltip>
                                )}
                                {isUpcomingForReview(doc) && !isOverdueForReview(doc) && (
                                  <Tooltip label="Upcoming Review (within 30 days)">
                                    <TimeIcon boxSize={3} color="orange.500" />
                                  </Tooltip>
                                )}
                                <Box 
                                  overflow="hidden" 
                                  textOverflow="ellipsis" 
                                  whiteSpace="nowrap" 
                                  flex={1}
                                  minW={0}
                                >
                                  {loadingUrls ? (
                                    <HStack>
                                      <Spinner size="sm" />
                                      <Text>{doc.title}</Text>
                                    </HStack>
                                  ) : url ? (
                                    <Link href={url} isExternal color="blue.500" fontWeight="medium">
                                      {doc.title}
                                    </Link>
                                  ) : (
                                    <Text>{doc.title}</Text>
                                  )}
                                </Box>
                              </HStack>
                            </VStack>
                          </Tooltip>
                        </Td>
                        <Td px={2}>{doc.type}</Td>
                        <Td px={2}>
                          <Badge 
                            colorScheme={statusColors[doc.status] || 'gray'} 
                            fontSize="xs"
                            minW="90px"
                            textAlign="center"
                            display="inline-block"
                          >
                            {formatStatus(doc.status)}
                          </Badge>
                        </Td>
                        <Td px={2}>{doc.version}</Td>
                        <Td px={2} maxW="120px">
                          <Text overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {doc.owner.displayName}
                          </Text>
                        </Td>
                        <Td px={2} whiteSpace="nowrap" fontSize="sm">
                          {doc.lastReviewDate ? (
                            new Date(doc.lastReviewDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          ) : (
                            <Text as="span" color="gray.400" fontStyle="italic">--</Text>
                          )}
                        </Td>
                        <Td px={2} whiteSpace="nowrap" fontSize="sm">
                          {doc.nextReviewDate ? (
                            new Date(doc.nextReviewDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          ) : (
                            <Text as="span" color="gray.400" fontStyle="italic">--</Text>
                          )}
                        </Td>
                        <Td px={2}>
                          <HStack spacing={1}>
                            {/* SharePoint/Confluence link - show if URL exists or if document has SharePoint/Confluence IDs */}
                            <Tooltip label={
                              (documentUrls[doc.id] || (doc.storageLocation === 'SHAREPOINT' && doc.sharePointItemId) || (doc.storageLocation === 'CONFLUENCE' && doc.confluencePageId))
                                ? (doc.storageLocation === 'SHAREPOINT' ? 'Open in SharePoint' : 'Open in Confluence')
                                : 'No external link available'
                            }>
                              <IconButton
                                aria-label="Open external link"
                                icon={<ExternalLinkIcon />}
                                size="sm"
                                variant="outline"
                                colorScheme="blue"
                                isDisabled={!(documentUrls[doc.id] || (doc.storageLocation === 'SHAREPOINT' && doc.sharePointItemId) || (doc.storageLocation === 'CONFLUENCE' && doc.confluencePageId))}
                                onClick={async () => {
                                  if (documentUrls[doc.id]) {
                                    window.open(documentUrls[doc.id], '_blank');
                                  } else {
                                    // Generate URL on demand if not already loaded
                                    const url = await getDocumentUrl(doc);
                                    if (url) {
                                      window.open(url, '_blank');
                                      // Cache it for future use
                                      setDocumentUrls(prev => ({ ...prev, [doc.id]: url }));
                                    } else {
                                      toast({
                                        title: 'Error',
                                        description: 'Unable to generate document URL',
                                        status: 'error',
                                        duration: 3000,
                                        isClosable: true,
                                        position: 'top-right',
                                      });
                                    }
                                  }
                                }}
                              />
                            </Tooltip>
                            <Tooltip label="View details">
                              <IconButton
                                aria-label="View document"
                                icon={<ViewIcon />}
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  onViewOpen();
                                }}
                              />
                            </Tooltip>
                            {canEdit && (
                              <>
                                <Button size="xs" onClick={() => handleEdit(doc)}>
                                  Edit
                                </Button>
                                <Tooltip label="Supersede document">
                                  <IconButton
                                    aria-label="Supersede document"
                                    icon={<TimeIcon />}
                                    size="xs"
                                    colorScheme="orange"
                                    variant="ghost"
                                    onClick={() => handleDelete(doc)}
                                  />
                                </Tooltip>
                                <Tooltip label="Delete permanently">
                                  <IconButton
                                    aria-label="Delete permanently"
                                    icon={<DeleteIcon />}
                                    size="xs"
                                    colorScheme="red"
                                    variant="ghost"
                                    onClick={() => handleHardDelete(doc)}
                                  />
                                </Tooltip>
                              </>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <HStack justify="center" mt={4} spacing={2}>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  isDisabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  isDisabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Text>
                  Page {currentPage} of {totalPages}
                </Text>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  isDisabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  isDisabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </HStack>
            )}
          </>
        )}
      </Box>

      <DocumentFormModal
        isOpen={isOpen}
        onClose={handleClose}
        document={selectedDocument}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Supersede Document
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={2}>
                <Text>Are you sure you want to supersede this document?</Text>
                <Box p={3} bg="gray.50" borderRadius="md" width="100%">
                  <Text fontWeight="semibold">{documentToDelete?.title}</Text>
                  <HStack spacing={4} mt={2} fontSize="sm" color="gray.600">
                    <Text>Type: <strong>{documentToDelete?.type}</strong></Text>
                    <Text>Version: <strong>{documentToDelete?.version}</strong></Text>
                    {documentToDelete?.lastChangedDate && (
                      <Text>Last Modified: <strong>{new Date(documentToDelete.lastChangedDate).toLocaleDateString('en-GB')}</strong></Text>
                    )}
                  </HStack>
                </Box>
                <Text fontSize="sm" color="gray.600">
                  This will mark the document as SUPERSEDED.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                Supersede
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Hard Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isHardDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onHardDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Permanently
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={2}>
                <Text>Are you sure you want to permanently delete this document?</Text>
                <Box p={3} bg="gray.50" borderRadius="md" width="100%">
                  <Text fontWeight="semibold">{documentToHardDelete?.title}</Text>
                  <HStack spacing={4} mt={2} fontSize="sm" color="gray.600">
                    <Text>Type: <strong>{documentToHardDelete?.type}</strong></Text>
                    <Text>Version: <strong>{documentToHardDelete?.version}</strong></Text>
                    {documentToHardDelete?.lastChangedDate && (
                      <Text>Last Modified: <strong>{new Date(documentToHardDelete.lastChangedDate).toLocaleDateString('en-GB')}</strong></Text>
                    )}
                  </HStack>
                </Box>
                <Text fontWeight="bold" color="red.500" fontSize="sm">
                  This action cannot be undone and will remove all history, reviews, and acknowledgments associated with this document.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onHardDeleteClose}>Cancel</Button>
              <Button colorScheme="red" onClick={confirmHardDelete} ml={3}>
                Delete Permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* View Document Dialog */}
      <DocumentFormModal
        isOpen={isViewOpen}
        onClose={onViewClose}
        document={selectedDocument}
        readOnly={true}
      />
    </VStack>
  );
}

