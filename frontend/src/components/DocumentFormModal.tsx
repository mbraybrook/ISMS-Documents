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
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { SharePointFileBrowser } from './SharePointFileBrowser';

interface DocumentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  readOnly?: boolean;
}

export function DocumentFormModal({ isOpen, onClose, document, readOnly = false }: DocumentFormModalProps) {
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
  });
  const [loading, setLoading] = useState(false);
  const [sharePointUrl, setSharePointUrl] = useState('');
  const [parsingUrl, setParsingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

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
      });
      setSharePointUrl('');
      setUrlError(null);
      return;
    }

    if (document) {
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
        nextReviewDate: document.nextReviewDate
          ? new Date(document.nextReviewDate).toISOString().split('T')[0]
          : '',
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
      });
    }
  }, [document, user, isOpen]);

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

  const handleFileSelect = (item: any) => {
    setFormData({
      ...formData,
      sharePointSiteId: formData.sharePointSiteId || '', // Will be populated from config if not set
      sharePointDriveId: formData.sharePointDriveId || '', // Will be populated from config if not set
      sharePointItemId: item.id,
      title: item.name || formData.title,
    });
    toast({
      title: 'Success',
      description: 'File selected from SharePoint',
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top-right',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        await api.put(`/api/documents/${document.id}`, payload);
      } else {
        await api.post('/api/documents', payload);
      }

      onClose();
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document');
    } finally {
      setLoading(false);
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
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  isReadOnly={readOnly}
                />
              </FormControl>

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

              {formData.storageLocation === 'SHAREPOINT' && (
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
                        isDisabled={readOnly}
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
                    <Button
                      onClick={() => setBrowserOpen(true)}
                      colorScheme="blue"
                      variant="outline"
                      width="100%"
                      isDisabled={readOnly}
                    >
                      Browse SharePoint Files
                    </Button>
                  </FormControl>
                  <FormControl>
                    <FormLabel>SharePoint Site ID</FormLabel>
                    <Input
                      value={formData.sharePointSiteId}
                      onChange={(e) =>
                        setFormData({ ...formData, sharePointSiteId: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>SharePoint Drive ID</FormLabel>
                    <Input
                      value={formData.sharePointDriveId}
                      onChange={(e) =>
                        setFormData({ ...formData, sharePointDriveId: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>SharePoint Item ID</FormLabel>
                    <Input
                      value={formData.sharePointItemId}
                      onChange={(e) =>
                        setFormData({ ...formData, sharePointItemId: e.target.value })
                      }
                      isReadOnly={readOnly}
                    />
                  </FormControl>
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
              </FormControl>
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
          siteId={formData.sharePointSiteId || undefined}
          driveId={formData.sharePointDriveId || undefined}
        />
      </ModalContent>
    </Modal>
  );
}

