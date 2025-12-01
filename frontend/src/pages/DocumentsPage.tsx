import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Button,
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
  Text,
  Spinner,
  Tr,
  Td,
  Checkbox,
} from '@chakra-ui/react';
import { BellIcon, WarningIcon, DeleteIcon, ViewIcon, ExternalLinkIcon, TimeIcon, EditIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { authService } from '../services/authService';
import { DocumentFormModal } from '../components/DocumentFormModal';
import { DataTable, Column, FilterConfig, ActionButton, PaginationConfig, SortConfig, CSVExportConfig } from '../components/DataTable';
import { formatEmptyValue } from '../utils/tableUtils';

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
  documentUrl?: string | null; // Cached URL for the document
}

interface User {
  id: string;
  displayName: string;
  email: string;
}

export function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);
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
  const [pageSize, setPageSize] = useState(20);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const { isOpen: isHardDeleteOpen, onOpen: onHardDeleteOpen, onClose: onHardDeleteClose } = useAlertDisclosure();
  const { isOpen: isBulkHardDeleteOpen, onOpen: onBulkHardDeleteOpen, onClose: onBulkHardDeleteClose } = useAlertDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const bulkHardDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [documentToHardDelete, setDocumentToHardDelete] = useState<Document | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [loadingUrls, setLoadingUrls] = useState(false);
  const toast = useToast();

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isOpen) onClose();
        else if (isDeleteOpen) onDeleteClose();
        else if (isHardDeleteOpen) onHardDeleteClose();
        else if (isBulkHardDeleteOpen) onBulkHardDeleteClose();
        else if (isViewOpen) onViewClose();
        else if (selectedDocuments.size > 0) {
          setSelectedDocuments(new Set());
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isOpen && !isDeleteOpen && !isHardDeleteOpen && !isBulkHardDeleteOpen && !isViewOpen) {
        e.preventDefault();
        if (canEdit) {
          setSelectedDocument(null);
          onOpen();
        }
      }
      if (e.key === 'Delete' && !isOpen && !isDeleteOpen && !isHardDeleteOpen && !isBulkHardDeleteOpen && !isViewOpen && selectedDocuments.size > 0 && canEdit) {
        e.preventDefault();
        const confirmed = window.confirm(
          `Are you sure you want to supersede ${selectedDocuments.size} document(s)? This will mark them as SUPERSEDED.`
        );
        if (confirmed) {
          handleBulkDelete();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [isOpen, isDeleteOpen, isHardDeleteOpen, isBulkHardDeleteOpen, isViewOpen, onClose, onDeleteClose, onHardDeleteClose, onBulkHardDeleteClose, onViewClose, selectedDocuments, canEdit]);

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
  }, [filters.type, filters.status, filters.ownerId]);

  useEffect(() => {
    const generateUrls = async () => {
      setLoadingUrls(true);
      const urlMap: Record<string, string> = {};
      console.log('[generateUrls] Starting URL processing for', documents.length, 'documents');
      
      // First, use stored URLs from the database
      let storedUrlCount = 0;
      let generatedUrlCount = 0;
      
      for (const doc of documents) {
        // Use stored documentUrl if available
        if (doc.documentUrl) {
          urlMap[doc.id] = doc.documentUrl;
          storedUrlCount++;
          continue;
        }
        
        // Only generate URL if not stored and document has required IDs
        try {
          const url = await getDocumentUrl(doc);
          if (url) {
            urlMap[doc.id] = url;
            generatedUrlCount++;
            console.log('[generateUrls] Generated URL for document', doc.id, doc.title);
          } else {
            const hasSharePointIds = !!(doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId);
            const hasConfluenceIds = !!(doc.confluenceSpaceKey && doc.confluencePageId);
            if (hasSharePointIds || hasConfluenceIds) {
              console.warn('[generateUrls] Could not generate URL for document', doc.id, doc.title, {
                storageLocation: doc.storageLocation,
                hasSharePointIds,
                hasConfluenceIds,
              });
            }
          }
        } catch (error: any) {
          console.error('[generateUrls] Error generating URL for document', doc.id, doc.title, error);
        }
      }
      console.log('[generateUrls] Completed URL processing. Used', storedUrlCount, 'stored URLs, generated', generatedUrlCount, 'new URLs out of', documents.length, 'documents');
      setDocumentUrls(urlMap);
      setLoadingUrls(false);
    };
    if (documents.length > 0) {
      generateUrls();
    } else {
      setDocumentUrls({});
      setLoadingUrls(false);
    }
  }, [documents]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.ownerId) params.ownerId = filters.ownerId;
      params.limit = 1000; // Get all documents for client-side filtering/search

      // Get Graph token to pass to backend for URL generation
      const graphToken = await authService.getGraphAccessToken();
      const headers = graphToken ? { 'x-graph-token': graphToken } : {};

      const response = await api.get('/api/documents', { params, headers });
      const docs = response.data.data || response.data;
      setAllDocuments(Array.isArray(docs) ? docs : []);
      setDocuments(Array.isArray(docs) ? docs : []);
      setCurrentPage(1);
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
        // Get Graph token once and reuse it for both API calls
        const graphToken = await authService.getGraphAccessToken();
        
        if (!graphToken) {
          // No token available - cannot generate URL
          console.warn('[getDocumentUrl] No Graph access token available for SharePoint document URL', {
            docId: doc.id,
            title: doc.title,
          });
          return null;
        }

        // First, try to get webUrl directly from the item endpoint (fastest)
        try {
          console.log('[getDocumentUrl] Attempting to fetch SharePoint item webUrl', {
            docId: doc.id,
            itemId: doc.sharePointItemId,
            siteId: doc.sharePointSiteId,
            driveId: doc.sharePointDriveId,
          });
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
            console.log('[getDocumentUrl] Successfully got webUrl from item endpoint', {
              docId: doc.id,
              webUrl: response.data.webUrl,
            });
            return response.data.webUrl;
          }
          console.warn('[getDocumentUrl] Item endpoint response missing webUrl', {
            docId: doc.id,
            responseData: response.data,
          });
        } catch (error: any) {
          console.error('[getDocumentUrl] Error fetching SharePoint item:', {
            docId: doc.id,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            stack: error.stack,
          });
        }

        // Fallback: use the URL endpoint with the token
        try {
          console.log('[getDocumentUrl] Attempting to generate URL via /api/sharepoint/url', {
            docId: doc.id,
            itemId: doc.sharePointItemId,
          });
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
            console.log('[getDocumentUrl] Successfully got URL from /api/sharepoint/url', {
              docId: doc.id,
              url: response.data.url,
            });
            return response.data.url;
          }
          console.warn('[getDocumentUrl] URL endpoint response missing url', {
            docId: doc.id,
            responseData: response.data,
          });
        } catch (error: any) {
          console.error('[getDocumentUrl] Error generating SharePoint URL:', {
            docId: doc.id,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            stack: error.stack,
          });
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
    } catch (error: any) {
      console.error('[getDocumentUrl] Unexpected error generating document URL:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        stack: error.stack,
      });
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

  const handleBulkHardDelete = () => {
    if (selectedDocuments.size === 0) return;
    onBulkHardDeleteOpen();
  };

  const confirmBulkHardDelete = async () => {
    if (selectedDocuments.size === 0) return;

    try {
      const deletePromises = Array.from(selectedDocuments).map((id) =>
        api.delete(`/api/documents/${id}`, {
          params: { hard: true }
        })
      );
      await Promise.all(deletePromises);
      toast({
        title: 'Success',
        description: `Successfully permanently deleted ${selectedDocuments.size} document(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      onBulkHardDeleteClose();
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete some documents',
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

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.title.toLowerCase().includes(searchLower)
      );
    }

    if (filters.requiresAcknowledgement === 'true') {
      filtered = filtered.filter((doc) => doc.requiresAcknowledgement === true);
    } else if (filters.requiresAcknowledgement === 'false') {
      filtered = filtered.filter((doc) => !doc.requiresAcknowledgement);
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof Document];
        let bVal: any = b[sortField as keyof Document];

        if (sortField === 'owner') {
          aVal = a.owner.displayName;
          bVal = b.owner.displayName;
        }

        if (sortField === 'nextReviewDate' || sortField === 'lastReviewDate') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

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

  // DataTable configuration
  const columns: Column<Document>[] = [
    {
      key: 'title',
      header: 'Title',
      minW: '200px',
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: '100px',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      sortable: true,
    },
    {
      key: 'version',
      header: 'Version',
      width: '80px',
      sortable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '120px',
      sortable: true,
    },
    {
      key: 'lastReviewDate',
      header: 'Last Review',
      width: '110px',
      sortable: true,
    },
    {
      key: 'nextReviewDate',
      header: 'Next Review',
      width: '110px',
      sortable: true,
    },
  ];

  const filterConfigs: FilterConfig[] = [
    {
      key: 'search',
      type: 'search',
      placeholder: 'Search by title...',
    },
    {
      key: 'type',
      type: 'select',
      placeholder: 'Filter by Type',
      options: [
        { value: 'POLICY', label: 'Policy' },
        { value: 'PROCEDURE', label: 'Procedure' },
        { value: 'MANUAL', label: 'Manual' },
        { value: 'RECORD', label: 'Record' },
        { value: 'TEMPLATE', label: 'Template' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    {
      key: 'status',
      type: 'select',
      placeholder: 'Filter by Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'IN_REVIEW', label: 'In Review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'SUPERSEDED', label: 'Superseded' },
      ],
    },
    {
      key: 'ownerId',
      type: 'select',
      placeholder: 'Filter by Owner',
      options: users.map((u) => ({ value: u.id, label: `${u.displayName} (${u.email})` })),
    },
    {
      key: 'requiresAcknowledgement',
      type: 'select',
      placeholder: 'Acknowledgment',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
    },
  ];

  const actions: ActionButton<Document>[] = [
    {
      icon: <ExternalLinkIcon />,
      label: 'Open external link',
      onClick: async (doc) => {
        if (documentUrls[doc.id]) {
          window.open(documentUrls[doc.id], '_blank');
        } else {
          try {
            // Check if SharePoint document has required IDs
            if (doc.storageLocation === 'SHAREPOINT' && (!doc.sharePointSiteId || !doc.sharePointDriveId || !doc.sharePointItemId)) {
              toast({
                title: 'Missing SharePoint Information',
                description: 'This document is missing SharePoint location information. Please edit the document and link it to a SharePoint file.',
                status: 'warning',
                duration: 6000,
                isClosable: true,
                position: 'top-right',
              });
              return;
            }
            
            const url = await getDocumentUrl(doc);
            if (url) {
              window.open(url, '_blank');
              setDocumentUrls((prev) => ({ ...prev, [doc.id]: url }));
            } else {
              // Check if it's a SharePoint document and provide more specific error
              let errorMessage = 'Unable to generate document URL';
              if (doc.storageLocation === 'SHAREPOINT') {
                errorMessage = 'Unable to generate SharePoint document URL. Please check the browser console for details. You may need to grant SharePoint permissions.';
              }
              toast({
                title: 'Error',
                description: errorMessage,
                status: 'error',
                duration: 5000,
                isClosable: true,
                position: 'top-right',
              });
            }
          } catch (error: any) {
            console.error('[Open external link] Error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Unable to generate document URL';
            toast({
              title: 'Error',
              description: errorMessage,
              status: 'error',
              duration: 5000,
              isClosable: true,
              position: 'top-right',
            });
          }
        }
      },
      isDisabled: (doc) => !(documentUrls[doc.id] || (doc.storageLocation === 'SHAREPOINT' && doc.sharePointItemId) || (doc.storageLocation === 'CONFLUENCE' && doc.confluencePageId)),
      colorScheme: 'blue',
    },
    {
      icon: <ViewIcon />,
      label: 'View details',
      onClick: (doc) => {
        setSelectedDocument(doc);
        onViewOpen();
      },
      colorScheme: 'blue',
    },
    ...(canEdit
      ? [
          {
            icon: <EditIcon />,
            label: 'Edit',
            onClick: handleEdit,
            colorScheme: 'blue',
          } as ActionButton<Document>,
          {
            icon: <TimeIcon />,
            label: 'Supersede document',
            onClick: handleDelete,
            colorScheme: 'orange',
          } as ActionButton<Document>,
          {
            icon: <DeleteIcon />,
            label: 'Delete permanently',
            onClick: handleHardDelete,
            colorScheme: 'red',
          } as ActionButton<Document>,
        ]
      : []),
  ];

  const pagination: PaginationConfig = {
    mode: 'client',
    page: currentPage,
    pageSize: pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: (newSize) => {
      setPageSize(newSize);
      setCurrentPage(1);
    },
  };

  const sortConfig: SortConfig = {
    field: sortField,
    direction: sortDirection,
    onSort: handleSort,
  };

  const csvExport: CSVExportConfig = {
    enabled: true,
    filename: `documents_export_${new Date().toISOString().split('T')[0]}.csv`,
    headers: ['Title', 'Type', 'Status', 'Version', 'Owner', 'Last Review', 'Next Review', 'Requires Acknowledgment'],
    getRowData: (doc) => [
      doc.title,
      doc.type,
      formatStatus(doc.status),
      doc.version,
      doc.owner.displayName,
      doc.lastReviewDate ? new Date(doc.lastReviewDate).toLocaleDateString('en-GB') : '',
      doc.nextReviewDate ? new Date(doc.nextReviewDate).toLocaleDateString('en-GB') : '',
      doc.requiresAcknowledgement ? 'Yes' : 'No',
    ],
    onExport: () => {
      toast({
        title: 'Export successful',
        description: `Exported ${filteredData.length} documents to CSV`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
  };

  const renderRow = (doc: Document, index: number) => {
    const url = documentUrls[doc.id];
    const isSelected = selectedDocuments.has(doc.id);
    const isEven = index % 2 === 0;

    return (
      <Tr
        key={doc.id}
        _hover={{ bg: isSelected ? 'blue.100' : 'gray.100', opacity: 0.9, cursor: 'pointer' }}
        bg={isSelected ? 'blue.50' : isEven ? 'white' : 'gray.50'}
        cursor="pointer"
        transition="background-color 0.2s"
        onClick={() => {
          if (canEdit) {
            handleEdit(doc);
          } else {
            setSelectedDocument(doc);
            onViewOpen();
          }
        }}
      >
        {canEdit && (
          <Td px={2} onClick={(e) => e.stopPropagation()}>
            <Checkbox
              isChecked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectDocument(doc.id, e.target.checked);
              }}
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
                <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" flex={1} minW={0}>
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
            <Text as="span" color="gray.400" fontStyle="italic">
              —
            </Text>
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
            <Text as="span" color="gray.400" fontStyle="italic">
              —
            </Text>
          )}
        </Td>
        <Td px={2} onClick={(e) => e.stopPropagation()}>
          <HStack spacing={1}>
            {actions.map((action, idx) => {
              if (action.isVisible && !action.isVisible(doc)) return null;
              const disabled = action.isDisabled ? action.isDisabled(doc) : false;

              return (
                <Tooltip key={idx} label={action.label}>
                  <IconButton
                    aria-label={action.label}
                    icon={action.icon}
                    size="xs"
                    colorScheme={action.colorScheme || 'blue'}
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(doc);
                    }}
                    isDisabled={disabled}
                  />
                </Tooltip>
              );
            })}
          </HStack>
        </Td>
      </Tr>
    );
  };

  const filteredData = getSortedAndFilteredDocuments();

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Documents</Heading>
        {canEdit && (
          <HStack>
            <Button colorScheme="green" variant="outline" onClick={() => navigate('/admin/documents/documents/import')}>
              Mass Import
            </Button>
            <Button colorScheme="blue" onClick={handleCreate}>
              Create Document
            </Button>
          </HStack>
        )}
      </HStack>

      {/* Bulk actions bar */}
      {canEdit && selectedDocuments.size > 0 && (
        <HStack p={3} bg="blue.50" borderRadius="md" boxShadow="sm" spacing={3}>
          <Text fontWeight="semibold">{selectedDocuments.size} document(s) selected</Text>
          <Button size="sm" colorScheme="red" variant="outline" onClick={handleBulkDelete}>
            Supersede Selected
          </Button>
          <Button size="sm" colorScheme="red" variant="solid" onClick={handleBulkHardDelete}>
            Permanently Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedDocuments(new Set())}>
            Clear Selection
          </Button>
        </HStack>
      )}

      <DataTable
        title=""
        data={filteredData}
        columns={columns}
        loading={loading}
        emptyMessage={
          filters.search || filters.type || filters.status
            ? 'No documents match your filters.'
            : 'No documents yet.'
        }
        filters={filterConfigs}
        filterValues={filters}
        onFilterChange={(key, value) => {
          setFilters({ ...filters, [key]: value });
          setCurrentPage(1);
        }}
        onClearFilters={() => {
          setFilters({ type: '', status: '', ownerId: '', search: '', requiresAcknowledgement: '' });
          setCurrentPage(1);
        }}
        showFiltersHeading={true}
        sortConfig={sortConfig}
        enableSelection={canEdit}
        selectedIds={selectedDocuments}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectDocument}
        getRowId={(doc) => doc.id}
        pagination={pagination}
        actions={actions}
        csvExport={csvExport}
        onRowClick={(doc) => {
          if (canEdit) {
            handleEdit(doc);
          } else {
            setSelectedDocument(doc);
            onViewOpen();
          }
        }}
        renderRow={renderRow}
      />

      <DocumentFormModal isOpen={isOpen} onClose={handleClose} document={selectedDocument} />

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
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
                    <Text>
                      Type: <strong>{documentToDelete?.type}</strong>
                    </Text>
                    <Text>
                      Version: <strong>{documentToDelete?.version}</strong>
                    </Text>
                    {documentToDelete?.lastChangedDate && (
                      <Text>
                        Last Modified: <strong>{new Date(documentToDelete.lastChangedDate).toLocaleDateString('en-GB')}</strong>
                      </Text>
                    )}
                  </HStack>
                </Box>
                <Text fontSize="sm" color="gray.600">
                  This will mark the document as SUPERSEDED.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                Supersede
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={isBulkHardDeleteOpen} leastDestructiveRef={bulkHardDeleteCancelRef} onClose={onBulkHardDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Permanently Delete Documents
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={2}>
                <Text>
                  Are you sure you want to permanently delete {selectedDocuments.size} document(s)? This action cannot be undone.
                </Text>
                <Text fontSize="sm" color="red.600" fontWeight="semibold">
                  Warning: This will permanently delete the selected documents from the database.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={bulkHardDeleteCancelRef} onClick={onBulkHardDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmBulkHardDelete} ml={3}>
                Delete Permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={isHardDeleteOpen} leastDestructiveRef={cancelRef} onClose={onHardDeleteClose}>
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
                    <Text>
                      Type: <strong>{documentToHardDelete?.type}</strong>
                    </Text>
                    <Text>
                      Version: <strong>{documentToHardDelete?.version}</strong>
                    </Text>
                    {documentToHardDelete?.lastChangedDate && (
                      <Text>
                        Last Modified: <strong>{new Date(documentToHardDelete.lastChangedDate).toLocaleDateString('en-GB')}</strong>
                      </Text>
                    )}
                  </HStack>
                </Box>
                <Text fontWeight="bold" color="red.500" fontSize="sm">
                  This action cannot be undone and will remove all history, reviews, and acknowledgments associated with this document.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onHardDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmHardDelete} ml={3}>
                Delete Permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <DocumentFormModal isOpen={isViewOpen} onClose={onViewClose} document={selectedDocument} readOnly={true} />
    </VStack>
  );
}
