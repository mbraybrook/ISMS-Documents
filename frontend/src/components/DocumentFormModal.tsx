import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Textarea,
  HStack,
  Alert,
  AlertIcon,
  AlertDescription,
  useToast,
  Checkbox,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Text,
  Link,
  Box,
  Badge,
  IconButton,
  Tooltip,
  Spinner,
  Divider,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { SearchIcon, DeleteIcon } from '@chakra-ui/icons';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { SharePointFileBrowser } from './SharePointFileBrowser';
import { VersionUpdateModal } from './VersionUpdateModal';
import { ControlFormModal } from './ControlFormModal';

interface DocumentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  readOnly?: boolean;
  isReviewContext?: boolean; // Indicates if opened from review screen
}

export function DocumentFormModal({ isOpen, onClose, document, readOnly = false, isReviewContext = false }: DocumentFormModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [formData, setFormData] = useState({
    title: '',
    type: 'POLICY',
    storageLocation: 'SHAREPOINT',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: user?.id || '',
    sharePointSiteId: '',
    sharePointDriveId: '',
    sharePointItemId: '',
    confluenceSpaceKey: '',
    confluencePageId: '',
    lastReviewDate: '',
    nextReviewDate: '',
    requiresAcknowledgement: false,
    versionNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [sharePointUrl, setSharePointUrl] = useState('');
  const [parsingUrl, setParsingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [showReplaceOptions, setShowReplaceOptions] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; displayName: string; email: string; role: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const { isOpen: isVersionUpdateOpen, onOpen: onVersionUpdateOpen, onClose: onVersionUpdateClose } = useDisclosure();
  const { isOpen: isControlModalOpen, onOpen: onControlModalOpen, onClose: onControlModalClose } = useDisclosure();
  const [selectedControl, setSelectedControl] = useState<any>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  
  // Control linking state
  const [linkedControls, setLinkedControls] = useState<Array<{ id: string; code: string; title: string; category: string | null }>>([]);
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [availableControls, setAvailableControls] = useState<Array<{ id: string; code: string; title: string; category: string | null }>>([]);
  const [suggestedControls, setSuggestedControls] = useState<Array<{ id: string; code: string; title: string; category: string | null }>>([]);
  const [searchingControls, setSearchingControls] = useState(false);
  const [linkingControl, setLinkingControl] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);
  const [loadingSuggestedControls, setLoadingSuggestedControls] = useState(false);

  // Check if user can edit owner (Admin or Editor only)
  const canEditOwner = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch users when modal opens (only for Admin/Editor)
  useEffect(() => {
    if (isOpen && canEditOwner) {
      fetchUsers();
    }
  }, [isOpen, canEditOwner]);

  // Fetch linked controls when document is loaded
  useEffect(() => {
    if (isOpen && document?.id) {
      fetchLinkedControls();
    } else if (isOpen && !document) {
      setLinkedControls([]);
    }
  }, [isOpen, document?.id]);

  // Fetch suggested controls when title or type changes (with debounce)
  useEffect(() => {
    if (!isOpen) {
      setSuggestedControls([]);
      return;
    }

    // Only fetch suggestions if we have a title (for new documents) or if editing
    if (!formData.title || formData.title.trim().length < 3) {
      setSuggestedControls([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchSuggestedControls();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.title, formData.type, isOpen]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/api/users');
      const allUsers = response.data.data || [];
      // Filter to only Admin and Editor roles for owner assignment
      const adminEditorUsers = allUsers.filter((u: any) => u.role === 'ADMIN' || u.role === 'EDITOR');
      
      // If editing a document, include the current owner even if they're not Admin/Editor
      // This handles edge cases where a document might have a non-Admin/Editor owner
      if (document?.ownerUserId) {
        const currentOwner = allUsers.find((u: any) => u.id === document.ownerUserId);
        if (currentOwner && !adminEditorUsers.find((u: any) => u.id === currentOwner.id)) {
          adminEditorUsers.push(currentOwner);
        }
      }
      
      setUsers(adminEditorUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users for owner selection',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        title: '',
        type: 'POLICY',
        storageLocation: 'SHAREPOINT',
        version: '1.0',
        status: 'DRAFT',
        ownerUserId: user?.id || '',
        sharePointSiteId: '',
        sharePointDriveId: '',
        sharePointItemId: '',
        confluenceSpaceKey: '',
        confluencePageId: '',
        lastReviewDate: '',
        nextReviewDate: '',
        requiresAcknowledgement: false,
        versionNotes: '',
      });
      setSharePointUrl('');
      setUrlError(null);
      setShowReplaceOptions(false);
      setDocumentUrl(null);
      return;
    }

    if (document) {
      // Load document URL if it has SharePoint IDs
      if (document.storageLocation === 'SHAREPOINT' && document.sharePointSiteId && document.sharePointDriveId && document.sharePointItemId) {
        loadDocumentUrl(document);
      }
      
      // Load version notes for current version
      const loadVersionNotes = async () => {
        try {
          const response = await api.get(`/api/documents/${document.id}/version-notes?version=current`);
          return response.data.notes || '';
        } catch (error) {
          console.error('Error loading version notes:', error);
          return '';
        }
      };

      // If opened from review context, set next review date to today + 1 year
      let nextReviewDate = document.nextReviewDate
        ? new Date(document.nextReviewDate).toISOString().split('T')[0]
        : '';
      
      if (isReviewContext && !readOnly) {
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);
        nextReviewDate = nextYear.toISOString().split('T')[0];
      }
      
      // Set form data and load version notes
      loadVersionNotes().then((versionNotes) => {
        setFormData({
          title: document.title || '',
          type: document.type || 'POLICY',
          storageLocation: document.storageLocation || 'SHAREPOINT',
          version: document.version || '1.0',
          status: document.status || 'DRAFT',
          ownerUserId: document.ownerUserId || user?.id || '',
          sharePointSiteId: document.sharePointSiteId || '',
          sharePointDriveId: document.sharePointDriveId || '',
          sharePointItemId: document.sharePointItemId || '',
          confluenceSpaceKey: document.confluenceSpaceKey || '',
          confluencePageId: document.confluencePageId || '',
          lastReviewDate: document.lastReviewDate
            ? new Date(document.lastReviewDate).toISOString().split('T')[0]
            : '',
          nextReviewDate: nextReviewDate,
          // Default to true for POLICY documents, but allow existing value to be changed
          requiresAcknowledgement: document.type === 'POLICY' 
            ? (document.requiresAcknowledgement ?? true)
            : (document.requiresAcknowledgement ?? false),
          versionNotes: versionNotes,
        });
      });
    } else {
      // Auto-populate default dates for new documents
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      
      setFormData({
        title: '',
        type: 'POLICY',
        storageLocation: 'SHAREPOINT',
        version: '1.0',
        status: 'DRAFT',
        ownerUserId: user?.id || '',
        sharePointSiteId: '',
        sharePointDriveId: '',
        sharePointItemId: '',
        confluenceSpaceKey: '',
        confluencePageId: '',
        lastReviewDate: today.toISOString().split('T')[0],
        nextReviewDate: nextYear.toISOString().split('T')[0],
        requiresAcknowledgement: true, // Default to true for POLICY type
        versionNotes: '',
      });
    }
  }, [document, user, isOpen, isReviewContext, readOnly]);

  const handleParseUrl = async () => {
    if (!sharePointUrl.trim()) {
      setUrlError('Please enter a SharePoint URL');
      return;
    }

    setParsingUrl(true);
    setUrlError(null);

    try {
      const graphToken = await authService.getGraphAccessToken();
      if (!graphToken) {
        setUrlError('Unable to get access token. You may need to grant consent for SharePoint permissions. Please try again - a consent window should appear.');
        setParsingUrl(false);
        toast({
          title: 'Consent Required',
          description: 'Please grant consent for SharePoint access. A popup window should appear, or you may be redirected.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      const response = await api.post(
        '/api/sharepoint/parse-url',
        { url: sharePointUrl },
        {
          headers: {
            'x-graph-token': graphToken,
          },
        }
      );

      const parsed = response.data;
      setFormData({
        ...formData,
        sharePointSiteId: parsed.siteId,
        sharePointDriveId: parsed.driveId,
        sharePointItemId: parsed.itemId,
        title: parsed.name || formData.title,
      });

      setSharePointUrl('');
      setShowReplaceOptions(false);
      // Reload document URL if in edit mode
      if (document) {
        loadDocumentUrl({
          sharePointSiteId: parsed.siteId,
          sharePointDriveId: parsed.driveId,
          sharePointItemId: parsed.itemId,
        });
      }
      toast({
        title: 'Success',
        description: 'SharePoint URL parsed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to parse SharePoint URL. Please check the URL and try again.';
      setUrlError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setParsingUrl(false);
    }
  };

  const loadDocumentUrl = async (doc: any) => {
    // Use stored documentUrl if available
    if (doc.documentUrl) {
      console.log('[DocumentFormModal] Using stored document URL:', doc.documentUrl);
      setDocumentUrl(doc.documentUrl);
      return;
    }
    
    if (!doc.sharePointSiteId || !doc.sharePointDriveId || !doc.sharePointItemId) {
      console.log('[DocumentFormModal] Missing SharePoint IDs:', {
        siteId: doc.sharePointSiteId,
        driveId: doc.sharePointDriveId,
        itemId: doc.sharePointItemId,
      });
      return;
    }
    
    setLoadingUrl(true);
    try {
      // Try to get webUrl from SharePoint item
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
            console.log('[DocumentFormModal] Loaded document URL from Graph API:', response.data.webUrl);
            setDocumentUrl(response.data.webUrl);
            setLoadingUrl(false);
            return;
          }
        } catch (error: any) {
          console.warn('[DocumentFormModal] Error fetching SharePoint item from Graph API:', error.response?.data || error.message);
          // Continue to fallback
        }
      } else {
        console.warn('[DocumentFormModal] No Graph token available, using fallback URL');
      }
      
      // Fallback to generated URL - try with access token first
      try {
        const fallbackToken = graphToken || await authService.getGraphAccessToken();
        const headers = fallbackToken ? { 'x-graph-token': fallbackToken } : {};
        
        const response = await api.get('/api/sharepoint/url', {
          params: {
            siteId: doc.sharePointSiteId,
            driveId: doc.sharePointDriveId,
            itemId: doc.sharePointItemId,
          },
          headers,
        });
        if (response.data?.url) {
          // Check if it's a Graph API URL (not a web URL) - if so, try to get webUrl from item endpoint
          if (response.data.url.includes('graph.microsoft.com')) {
            console.warn('[DocumentFormModal] Got Graph API URL instead of web URL, trying item endpoint');
            // The backend should have already tried this, but if we got a Graph URL, the item endpoint might work
            if (fallbackToken) {
              try {
                const itemResponse = await api.get(`/api/sharepoint/items/${doc.sharePointItemId}`, {
                  params: {
                    siteId: doc.sharePointSiteId,
                    driveId: doc.sharePointDriveId,
                  },
                  headers: { 'x-graph-token': fallbackToken },
                });
                if (itemResponse.data?.webUrl) {
                  console.log('[DocumentFormModal] Got webUrl from item endpoint:', itemResponse.data.webUrl);
                  setDocumentUrl(itemResponse.data.webUrl);
                  setLoadingUrl(false);
                  return;
                }
              } catch (itemError) {
                console.warn('[DocumentFormModal] Could not get webUrl from item endpoint:', itemError);
              }
            }
            // If we still have a Graph URL, it's not usable as a web link
            console.error('[DocumentFormModal] Got Graph API URL which cannot be used as web link');
            setDocumentUrl(null);
          } else {
            console.log('[DocumentFormModal] Loaded document URL from fallback:', response.data.url);
            setDocumentUrl(response.data.url);
          }
        } else {
          console.error('[DocumentFormModal] Fallback URL endpoint returned no URL:', response.data);
          setDocumentUrl(null);
        }
      } catch (error: any) {
        console.error('[DocumentFormModal] Error generating fallback URL:', error.response?.data || error.message);
        setDocumentUrl(null);
      }
    } catch (error: any) {
      console.error('[DocumentFormModal] Unexpected error loading document URL:', error);
      setDocumentUrl(null);
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleFileSelect = (item: any) => {
    const selectedSiteId = item.siteId || formData.sharePointSiteId || '';
    setFormData({
      ...formData,
      sharePointSiteId: selectedSiteId,
      sharePointDriveId: item.driveId || formData.sharePointDriveId || '',
      sharePointItemId: item.id,
      title: item.name || formData.title,
    });
    setBrowserOpen(false);
    setShowReplaceOptions(false);
    // Reload document URL if in edit mode
    if (document) {
      loadDocumentUrl({
        sharePointSiteId: selectedSiteId,
        sharePointDriveId: item.driveId || formData.sharePointDriveId,
        sharePointItemId: item.id,
      });
    }
    toast({
      title: 'Success',
      description: 'File selected from SharePoint',
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top-right',
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (readOnly) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      const payload: any = { ...formData };
      if (payload.lastReviewDate === '') delete payload.lastReviewDate;
      if (payload.nextReviewDate === '') delete payload.nextReviewDate;
      if (payload.sharePointSiteId === '') delete payload.sharePointSiteId;
      if (payload.sharePointDriveId === '') delete payload.sharePointDriveId;
      if (payload.sharePointItemId === '') delete payload.sharePointItemId;
      if (payload.confluenceSpaceKey === '') delete payload.confluenceSpaceKey;
      if (payload.confluencePageId === '') delete payload.confluencePageId;

      if (document) {
        // Remove version from payload when updating (version can only be changed via version-updates endpoint)
        delete payload.version;
        // Include versionNotes for current version
        // versionNotes will be handled by backend to upsert
        await api.put(`/api/documents/${document.id}`, payload);
        toast({
          title: 'Success',
          description: 'Document updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top-right',
        });
      } else {
        await api.post('/api/documents', payload);
        toast({
          title: 'Success',
          description: 'Document created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top-right',
        });
      }

      setPendingSubmit(false);
      onConfirmClose();
      onClose();
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: 'Error',
        description: 'Failed to save document',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      setPendingSubmit(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedControls = async () => {
    if (!document?.id) return;
    try {
      setLoadingControls(true);
      const response = await api.get(`/api/documents/${document.id}/controls`);
      setLinkedControls(response.data);
    } catch (error: any) {
      console.error('Error fetching linked controls:', error);
      toast({
        title: 'Error',
        description: 'Failed to load linked controls',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoadingControls(false);
    }
  };

  const fetchSuggestedControls = async () => {
    if (!formData.title || formData.title.trim().length < 3) {
      setSuggestedControls([]);
      return;
    }

    try {
      setLoadingSuggestedControls(true);
      const response = await api.post('/api/documents/suggest-controls', {
        title: formData.title,
        type: formData.type,
      });
      
      if (response.data.suggestedControlIds && response.data.suggestedControlIds.length > 0) {
        // Fetch full control details for suggested IDs
        const controlsResponse = await api.get('/api/controls', {
          params: {
            limit: 1000, // Get all to find the suggested ones
          },
        });
        
        // Get current linked control IDs
        const linkedControlIds = new Set(linkedControls.map((c) => c.id));
        const suggested = controlsResponse.data.data.filter(
          (c: any) => 
            response.data.suggestedControlIds.includes(c.id) && 
            !linkedControlIds.has(c.id)
        );
        setSuggestedControls(suggested);
      } else {
        setSuggestedControls([]);
      }
    } catch (error: any) {
      console.error('Error fetching suggested controls:', error);
      // Don't show error toast for suggestions - it's not critical
      setSuggestedControls([]);
    } finally {
      setLoadingSuggestedControls(false);
    }
  };

  const searchControls = async () => {
    if (!controlSearchTerm.trim()) {
      setAvailableControls([]);
      return;
    }

    try {
      setSearchingControls(true);
      const response = await api.get('/api/controls', {
        params: {
          limit: 100, // Get more controls for better word-based matching
        },
      });
      // Filter out controls already linked and filter by search term using word-based matching
      const linkedControlIds = new Set(linkedControls.map((c) => c.id));
      const searchLower = controlSearchTerm.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).filter((word) => word.length > 0);
      
      setAvailableControls(
        response.data.data.filter((c: any) => {
          if (linkedControlIds.has(c.id)) {
            return false;
          }
          
          const controlText = `${c.code} ${c.title || ''}`.toLowerCase();
          
          // Word-based matching: check if any search word appears in the control text
          // This allows "awareness" to match "Information security awareness, education and training"
          return searchWords.some((word) => {
            // Match whole words or as part of a larger word
            const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
            return wordRegex.test(controlText) || controlText.includes(word);
          });
        })
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search controls',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingControls(false);
    }
  };

  const handleLinkControl = async (controlId: string) => {
    if (!document?.id) return;
    try {
      setLinkingControl(true);
      await api.post(`/api/documents/${document.id}/controls`, { controlId });
      toast({
        title: 'Success',
        description: 'Control linked successfully',
        status: 'success',
        duration: 3000,
      });
      setControlSearchTerm('');
      setAvailableControls([]);
      await fetchLinkedControls();
      // Refresh suggested controls to remove the linked one
      if (formData.title && formData.title.trim().length >= 3) {
        fetchSuggestedControls();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link control',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingControl(false);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!document?.id) return;
    try {
      await api.delete(`/api/documents/${document.id}/controls/${controlId}`);
      toast({
        title: 'Success',
        description: 'Control unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchLinkedControls();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to unlink control',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleConfirmSubmit = () => {
    setPendingSubmit(true);
    handleSubmit();
  };

  const handleVersionUpdateSuccess = async () => {
    // Reload document data to get updated version and review dates
    if (document) {
      try {
        const response = await api.get(`/api/documents/${document.id}`);
        const updatedDocument = response.data;
        
        // Update form data with new version and review dates
        setFormData((prev) => ({
          ...prev,
          version: updatedDocument.version,
          lastReviewDate: updatedDocument.lastReviewDate
            ? new Date(updatedDocument.lastReviewDate).toISOString().split('T')[0]
            : '',
          nextReviewDate: updatedDocument.nextReviewDate
            ? new Date(updatedDocument.nextReviewDate).toISOString().split('T')[0]
            : '',
        }));

        // Reload version notes for the new version
        const notesResponse = await api.get(`/api/documents/${document.id}/version-notes?version=current`);
        setFormData((prev) => ({
          ...prev,
          versionNotes: notesResponse.data.notes || '',
        }));
      } catch (error) {
        console.error('Error reloading document after version update:', error);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>{readOnly ? 'View Document' : document ? 'Edit Document' : 'Create Document'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Title</FormLabel>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  isReadOnly={readOnly}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Type</FormLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({
                      ...formData,
                      type: newType,
                      // Auto-set requiresAcknowledgement to true only when changing TO POLICY
                      // Don't change it when changing away from POLICY (user may want to keep it)
                      requiresAcknowledgement: newType === 'POLICY' ? true : formData.requiresAcknowledgement,
                    });
                  }}
                  isDisabled={readOnly}
                >
                  <option value="POLICY">Policy</option>
                  <option value="PROCEDURE">Procedure</option>
                  <option value="MANUAL">Manual</option>
                  <option value="RECORD">Record</option>
                  <option value="TEMPLATE">Template</option>
                  <option value="OTHER">Other</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Storage Location</FormLabel>
                  <Select
                  value={formData.storageLocation}
                  onChange={(e) =>
                    setFormData({ ...formData, storageLocation: e.target.value })
                  }
                  isDisabled={readOnly}
                >
                  <option value="SHAREPOINT">SharePoint</option>
                  <option value="CONFLUENCE">Confluence</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Version</FormLabel>
                <HStack spacing={2}>
                  <Input
                    value={formData.version}
                    isReadOnly={true}
                    bg="gray.50"
                    flex={1}
                  />
                  {!readOnly && document && (
                    <Button
                      size="md"
                      colorScheme="blue"
                      variant="outline"
                      onClick={onVersionUpdateOpen}
                    >
                      Update version
                    </Button>
                  )}
                </HStack>
              </FormControl>

              {!readOnly && document && (
                <FormControl>
                  <FormLabel>Version Notes</FormLabel>
                  <Textarea
                    value={formData.versionNotes}
                    onChange={(e) => setFormData({ ...formData, versionNotes: e.target.value })}
                    placeholder="Briefly describe what changed in this version..."
                    rows={3}
                    resize="vertical"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Briefly describe what changed in this version.
                  </Text>
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel>Status</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  isDisabled={readOnly}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SUPERSEDED">Superseded</option>
                </Select>
              </FormControl>

              {canEditOwner && (
                <FormControl isRequired>
                  <FormLabel>Owner</FormLabel>
                  <Select
                    value={formData.ownerUserId}
                    onChange={(e) => setFormData({ ...formData, ownerUserId: e.target.value })}
                    isDisabled={readOnly || loadingUsers}
                    placeholder={loadingUsers ? 'Loading users...' : 'Select owner'}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.email}) - {u.role}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Only Admin and Editor roles can be assigned as document owners
                  </Text>
                </FormControl>
              )}

              {formData.storageLocation === 'SHAREPOINT' && (
                <>
                  {!document ? (
                    // Create mode: Show paste URL and browse options
                    <>
                      <FormControl>
                        <FormLabel>SharePoint Link (Optional)</FormLabel>
                        <HStack spacing={2}>
                          <Input
                            placeholder="Paste SharePoint file URL here"
                            value={sharePointUrl}
                            onChange={(e) => {
                              setSharePointUrl(e.target.value);
                              setUrlError(null);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleParseUrl();
                              }
                            }}
                          />
                          <Button
                            onClick={handleParseUrl}
                            isLoading={parsingUrl}
                            colorScheme="blue"
                            size="md"
                          >
                            Parse URL
                          </Button>
                        </HStack>
                        {urlError && (
                          <Alert status="error" mt={2} size="sm">
                            <AlertIcon />
                            <AlertDescription>{urlError}</AlertDescription>
                          </Alert>
                        )}
                      </FormControl>
                      <FormControl>
                        <FormLabel>Or Browse SharePoint</FormLabel>
                        <VStack align="stretch" spacing={2}>
                          <Button
                            onClick={() => setBrowserOpen(true)}
                            colorScheme="blue"
                            variant="outline"
                            width="100%"
                          >
                            Browse SharePoint Files
                          </Button>
                          {formData.sharePointItemId && (
                            <Box
                              p={3}
                              bg="green.50"
                              borderRadius="md"
                              borderWidth="1px"
                              borderColor="green.200"
                            >
                              <Text fontSize="sm" fontWeight="medium" color="green.800">
                                Selected: {formData.title || 'SharePoint File'}
                              </Text>
                              <Text fontSize="xs" color="green.600" mt={1}>
                                Item ID: {formData.sharePointItemId}
                              </Text>
                            </Box>
                          )}
                        </VStack>
                      </FormControl>
                    </>
                  ) : (
                    // Edit/View mode: Show document link and replace option
                    <>
                      {!showReplaceOptions ? (
                        <FormControl>
                          <FormLabel>SharePoint Document</FormLabel>
                          <VStack align="start" spacing={2}>
                            {loadingUrl ? (
                              <Text fontSize="sm" color="gray.500">Loading document link...</Text>
                            ) : documentUrl ? (
                              <HStack spacing={2} align="center">
                                <Link href={documentUrl} isExternal color="blue.500" fontWeight="medium">
                                  Open in SharePoint
                                </Link>
                                {formData.sharePointItemId && (
                                  <Text fontSize="xs" color="gray.500">
                                    (ID: {formData.sharePointItemId})
                                  </Text>
                                )}
                              </HStack>
                            ) : formData.sharePointItemId ? (
                              <VStack align="start" spacing={1}>
                                <Text fontSize="sm" color="gray.500">Document link unavailable</Text>
                                <Text fontSize="xs" color="gray.500">
                                  Item ID: {formData.sharePointItemId}
                                </Text>
                              </VStack>
                            ) : (
                              <Text fontSize="sm" color="gray.500">No SharePoint document selected</Text>
                            )}
                            {!readOnly && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowReplaceOptions(true)}
                              >
                                Replace Document
                              </Button>
                            )}
                          </VStack>
                        </FormControl>
                      ) : (
                        <>
                          <FormControl>
                            <FormLabel>Replace SharePoint Document</FormLabel>
                            <VStack spacing={3} align="stretch">
                              <HStack spacing={2}>
                                <Input
                                  placeholder="Paste SharePoint file URL here"
                                  value={sharePointUrl}
                                  onChange={(e) => {
                                    setSharePointUrl(e.target.value);
                                    setUrlError(null);
                                  }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleParseUrl();
                                    }
                                  }}
                                />
                                <Button
                                  onClick={handleParseUrl}
                                  isLoading={parsingUrl}
                                  colorScheme="blue"
                                  size="md"
                                >
                                  Parse URL
                                </Button>
                              </HStack>
                              {urlError && (
                                <Alert status="error" size="sm">
                                  <AlertIcon />
                                  <AlertDescription>{urlError}</AlertDescription>
                                </Alert>
                              )}
                              <Text textAlign="center" fontSize="sm" color="gray.500">OR</Text>
                              <Button
                                onClick={() => setBrowserOpen(true)}
                                colorScheme="blue"
                                variant="outline"
                                width="100%"
                              >
                                Browse SharePoint Files
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setShowReplaceOptions(false);
                                  setSharePointUrl('');
                                  setUrlError(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </VStack>
                          </FormControl>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {formData.storageLocation === 'CONFLUENCE' && (
                <>
                  <FormControl>
                    <FormLabel>Confluence Space Key</FormLabel>
                    <Input
                      value={formData.confluenceSpaceKey}
                      onChange={(e) =>
                        setFormData({ ...formData, confluenceSpaceKey: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Confluence Page ID</FormLabel>
                    <Input
                      value={formData.confluencePageId}
                      onChange={(e) =>
                        setFormData({ ...formData, confluencePageId: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>
                </>
              )}

              {document ? (
                // For existing documents, show review dates as text
                <>
                  <FormControl>
                    <FormLabel>Last Review Date</FormLabel>
                    <Text fontSize="md" color="gray.700">
                      {formData.lastReviewDate
                        ? new Date(formData.lastReviewDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'Not set'}
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Next Review Date</FormLabel>
                    <Text fontSize="md" color="gray.700">
                      {formData.nextReviewDate
                        ? new Date(formData.nextReviewDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'Not set'}
                    </Text>
                  </FormControl>
                  {!readOnly && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Review dates are updated when you update the document version.
                    </Text>
                  )}
                </>
              ) : (
                // For new documents, show editable date inputs
                <>
                  <FormControl>
                    <FormLabel>Last Review Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.lastReviewDate}
                      onChange={(e) =>
                        setFormData({ ...formData, lastReviewDate: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Next Review Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.nextReviewDate}
                      onChange={(e) =>
                        setFormData({ ...formData, nextReviewDate: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                    {isReviewContext && !readOnly && (
                      <Text fontSize="xs" color="blue.600" mt={1}>
                        Next review date set to 1 year from today. You can change this if needed.
                      </Text>
                    )}
                  </FormControl>
                </>
              )}

              <FormControl>
                <Checkbox
                  isChecked={formData.requiresAcknowledgement}
                  onChange={(e) =>
                    setFormData({ ...formData, requiresAcknowledgement: e.target.checked })
                  }
                  isDisabled={readOnly}
                >
                  Requires Staff Acknowledgment
                </Checkbox>
                {formData.type === 'POLICY' && (
                  <Text fontSize="sm" color="gray.600" mt={1} ml={6}>
                    Policy documents default to requiring staff acknowledgment, but this can be changed if needed.
                  </Text>
                )}
              </FormControl>

              {document && (
                <>
                  <Divider />
                  <Box>
                    <FormLabel fontWeight="bold" color="blue.600" mb={2}>
                      Linked Controls ({linkedControls.length})
                    </FormLabel>
                    {loadingControls ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        {linkedControls.length > 0 && (
                          <VStack align="stretch" spacing={2} mb={4}>
                            {linkedControls.map((control) => (
                              <Box
                                key={control.id}
                                p={2}
                                bg="white"
                                borderRadius="md"
                                border="1px"
                                borderColor="blue.200"
                                _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                              >
                                <HStack justify="space-between">
                                  <HStack spacing={2} flex={1}>
                                    <Badge 
                                      colorScheme="blue" 
                                      fontSize="xs"
                                      cursor="pointer"
                                      _hover={{ bg: "blue.600", color: "white" }}
                                      onClick={async () => {
                                        try {
                                          // Fetch full control details
                                          const response = await api.get(`/api/controls/${control.id}`);
                                          setSelectedControl(response.data);
                                          onControlModalOpen();
                                        } catch (error) {
                                          console.error('Error fetching control details:', error);
                                          toast({
                                            title: 'Error',
                                            description: 'Failed to load control details',
                                            status: 'error',
                                            duration: 3000,
                                          });
                                        }
                                      }}
                                    >
                                      {control.code}
                                    </Badge>
                                    <Text 
                                      fontWeight="medium" 
                                      color="blue.700"
                                      cursor="pointer"
                                      _hover={{ textDecoration: "underline", color: "blue.900" }}
                                      onClick={async () => {
                                        try {
                                          // Fetch full control details
                                          const response = await api.get(`/api/controls/${control.id}`);
                                          setSelectedControl(response.data);
                                          onControlModalOpen();
                                        } catch (error) {
                                          console.error('Error fetching control details:', error);
                                          toast({
                                            title: 'Error',
                                            description: 'Failed to load control details',
                                            status: 'error',
                                            duration: 3000,
                                          });
                                        }
                                      }}
                                    >
                                      {control.title}
                                    </Text>
                                    {control.category && (
                                      <Badge fontSize="xs" colorScheme="gray">
                                        {control.category}
                                      </Badge>
                                    )}
                                  </HStack>
                                  {!readOnly && (
                                    <Tooltip label="Unlink control">
                                      <IconButton
                                        aria-label="Unlink control"
                                        icon={<DeleteIcon />}
                                        size="sm"
                                        colorScheme="red"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnlinkControl(control.id);
                                        }}
                                      />
                                    </Tooltip>
                                  )}
                                </HStack>
                              </Box>
                            ))}
                          </VStack>
                        )}
                        {!readOnly && (
                          <VStack align="stretch" spacing={2}>
                            <InputGroup>
                              <InputLeftElement pointerEvents="none">
                                <SearchIcon color="gray.300" />
                              </InputLeftElement>
                              <Input
                                placeholder="Search controls by code or title..."
                                value={controlSearchTerm}
                                onChange={(e) => {
                                  setControlSearchTerm(e.target.value);
                                  if (e.target.value.trim()) {
                                    searchControls();
                                  } else {
                                    setAvailableControls([]);
                                  }
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && controlSearchTerm.trim()) {
                                    e.preventDefault();
                                    searchControls();
                                  }
                                }}
                              />
                            </InputGroup>
                            {searchingControls && (
                              <HStack>
                                <Spinner size="sm" />
                                <Text fontSize="sm" color="gray.500">Searching...</Text>
                              </HStack>
                            )}
                            {availableControls.length > 0 && (
                              <Box
                                maxH="200px"
                                overflowY="auto"
                                border="1px"
                                borderColor="gray.200"
                                borderRadius="md"
                                p={2}
                              >
                                <VStack align="stretch" spacing={2}>
                                  {availableControls.map((control) => (
                                    <Box
                                      key={control.id}
                                      p={2}
                                      bg="gray.50"
                                      borderRadius="md"
                                      border="1px"
                                      borderColor="gray.200"
                                      _hover={{ bg: "gray.100", borderColor: "blue.300" }}
                                    >
                                      <HStack spacing={2} justify="space-between">
                                        <HStack 
                                          spacing={2} 
                                          flex={1}
                                          cursor="pointer"
                                          onClick={async () => {
                                            try {
                                              // Fetch full control details
                                              const response = await api.get(`/api/controls/${control.id}`);
                                              setSelectedControl(response.data);
                                              onControlModalOpen();
                                            } catch (error) {
                                              console.error('Error fetching control details:', error);
                                              toast({
                                                title: 'Error',
                                                description: 'Failed to load control details',
                                                status: 'error',
                                                duration: 3000,
                                              });
                                            }
                                          }}
                                        >
                                          <Badge 
                                            colorScheme="blue" 
                                            fontSize="xs"
                                            _hover={{ bg: "blue.600", color: "white" }}
                                          >
                                            {control.code}
                                          </Badge>
                                          <Text 
                                            fontSize="sm" 
                                            fontWeight="medium"
                                            _hover={{ textDecoration: "underline" }}
                                          >
                                            {control.title}
                                          </Text>
                                          {control.category && (
                                            <Badge fontSize="xs" colorScheme="gray">
                                              {control.category}
                                            </Badge>
                                          )}
                                        </HStack>
                                        <Button
                                          size="xs"
                                          colorScheme="blue"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLinkControl(control.id);
                                          }}
                                        >
                                          Link
                                        </Button>
                                      </HStack>
                                    </Box>
                                  ))}
                                </VStack>
                              </Box>
                            )}
                            {controlSearchTerm.trim() && availableControls.length === 0 && !searchingControls && (
                              <Text fontSize="sm" color="gray.500">
                                No controls found matching "{controlSearchTerm}"
                              </Text>
                            )}
                            
                            {/* Suggested Controls Section */}
                            {!controlSearchTerm.trim() && suggestedControls.length > 0 && (
                              <Box>
                                <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                                  Suggested Controls (based on document title):
                                </Text>
                                {loadingSuggestedControls ? (
                                  <HStack>
                                    <Spinner size="sm" />
                                    <Text fontSize="sm" color="gray.500">Loading suggestions...</Text>
                                  </HStack>
                                ) : (
                                  <Box
                                    maxH="200px"
                                    overflowY="auto"
                                    border="1px"
                                    borderColor="blue.200"
                                    borderRadius="md"
                                    p={2}
                                    bg="blue.50"
                                  >
                                    <VStack align="stretch" spacing={2}>
                                      {suggestedControls.map((control) => (
                                        <Box
                                          key={control.id}
                                          p={2}
                                          bg="white"
                                          borderRadius="md"
                                          border="1px"
                                          borderColor="blue.200"
                                          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                                        >
                                          <HStack spacing={2} justify="space-between">
                                            <HStack 
                                              spacing={2} 
                                              flex={1}
                                              cursor="pointer"
                                              onClick={async () => {
                                                try {
                                                  // Fetch full control details
                                                  const response = await api.get(`/api/controls/${control.id}`);
                                                  setSelectedControl(response.data);
                                                  onControlModalOpen();
                                                } catch (error) {
                                                  console.error('Error fetching control details:', error);
                                                  toast({
                                                    title: 'Error',
                                                    description: 'Failed to load control details',
                                                    status: 'error',
                                                    duration: 3000,
                                                  });
                                                }
                                              }}
                                            >
                                              <Badge 
                                                colorScheme="blue" 
                                                fontSize="xs"
                                                _hover={{ bg: "blue.600", color: "white" }}
                                              >
                                                {control.code}
                                              </Badge>
                                              <Text 
                                                fontSize="sm" 
                                                fontWeight="medium"
                                                _hover={{ textDecoration: "underline" }}
                                              >
                                                {control.title}
                                              </Text>
                                              {control.category && (
                                                <Badge fontSize="xs" colorScheme="gray">
                                                  {control.category}
                                                </Badge>
                                              )}
                                            </HStack>
                                            <Button
                                              size="xs"
                                              colorScheme="blue"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleLinkControl(control.id);
                                              }}
                                            >
                                              Link
                                            </Button>
                                          </HStack>
                                        </Box>
                                      ))}
                                    </VStack>
                                  </Box>
                                )}
                              </Box>
                            )}
                          </VStack>
                        )}
                      </>
                    )}
                  </Box>
                </>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {readOnly ? 'Close' : document ? 'Cancel' : 'Cancel'}
            </Button>
            {!readOnly && (
              <>
                {!document && (
                  <Button colorScheme="blue" type="submit" isLoading={loading}>
                    Create
                  </Button>
                )}
                {document && (
                  <Button colorScheme="blue" type="submit" isLoading={loading}>
                    Update
                  </Button>
                )}
              </>
            )}
          </ModalFooter>
        </form>
        <SharePointFileBrowser
          isOpen={browserOpen}
          onClose={() => setBrowserOpen(false)}
          onSelect={handleFileSelect}
          defaultSiteId={formData.sharePointSiteId || undefined}
          driveId={formData.sharePointDriveId || undefined}
          allowSiteSelection={true}
        />
      </ModalContent>

      <AlertDialog
        isOpen={isConfirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={onConfirmClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Update Version on Approved Document
            </AlertDialogHeader>

            <AlertDialogBody>
              This document is approved. Updating the version will mark it as changed and may require staff acknowledgment (if the document requires acknowledgment).
              <br />
              <br />
              The document status will remain APPROVED since the approval process occurred outside this platform.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onConfirmClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleConfirmSubmit} ml={3} isLoading={loading}>
                Continue
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <VersionUpdateModal
        isOpen={isVersionUpdateOpen}
        onClose={onVersionUpdateClose}
        currentVersion={formData.version}
        documentId={document?.id || ''}
        onSuccess={handleVersionUpdateSuccess}
        currentLastReviewDate={document?.lastReviewDate ? new Date(document.lastReviewDate).toISOString().split('T')[0] : null}
        currentNextReviewDate={document?.nextReviewDate ? new Date(document.nextReviewDate).toISOString().split('T')[0] : null}
      />

      <ControlFormModal
        isOpen={isControlModalOpen}
        onClose={() => {
          onControlModalClose();
          setSelectedControl(null);
        }}
        control={selectedControl}
      />
    </Modal>
  );
}

