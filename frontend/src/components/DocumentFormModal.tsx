import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Select,
  Checkbox,
  Text,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { NotesTab } from './NotesTab';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { VersionUpdateModal } from './VersionUpdateModal';
import { ControlFormModal } from './ControlFormModal';
import { DocumentFormFields } from './DocumentFormFields';
import { SharePointDocumentSection } from './SharePointDocumentSection';
import { ConfluenceDocumentSection } from './ConfluenceDocumentSection';
import { DocumentReviewDates } from './DocumentReviewDates';
import { DocumentControlLinking } from './DocumentControlLinking';
import { DocumentOwnerSelection } from './DocumentOwnerSelection';
import { useDocumentForm } from '../hooks/useDocumentForm';
import { useSharePointIntegration } from '../hooks/useSharePointIntegration';
import { useControlLinking } from '../hooks/useControlLinking';
import { useDocumentUsers } from '../hooks/useDocumentUsers';
import { useDocumentModals } from '../hooks/useDocumentModals';
import api from '../services/api';
import type { Document } from '../utils/documentForm';

interface DocumentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  readOnly?: boolean;
  isReviewContext?: boolean;
}

export function DocumentFormModal({ isOpen, onClose, document, readOnly = false, isReviewContext = false }: DocumentFormModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  // Check if user can edit owner (Admin or Editor only)
  const canEditOwner = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Form management hook
  const {
    formData,
    setFormData,
    loading,
    handleSubmit,
    handleVersionUpdateSuccess,
  } = useDocumentForm({
    document,
    isOpen,
    isReviewContext,
    readOnly,
    onClose,
  });

  // SharePoint integration hook
  const sharePointIntegration = useSharePointIntegration({
    formData,
    setFormData,
    document,
  });

  // Control linking hook
  const controlLinking = useControlLinking({
    documentId: document?.id,
    formData,
    isOpen,
    readOnly,
  });

  // User management hook
  const { users, loadingUsers } = useDocumentUsers({
    documentOwnerUserId: document?.ownerUserId,
    canEditOwner,
    isOpen,
  });

  // Modal management hook
  const modals = useDocumentModals();

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

  // Load document URL when document changes
  useEffect(() => {
    if (isOpen && document && document.storageLocation === 'SHAREPOINT' && document.sharePointSiteId && document.sharePointDriveId && document.sharePointItemId) {
      sharePointIntegration.loadDocumentUrl(document);
    }
  }, [isOpen, document, sharePointIntegration]);

  // Handle form data updates
  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Handle control click - fetch control and open modal
  const handleControlClick = async (controlId: string) => {
    try {
      const response = await api.get(`/api/controls/${controlId}`);
      modals.setSelectedControl(response.data);
      modals.onControlModalOpen();
    } catch (error) {
      console.error('Error fetching control details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load control details',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleConfirmSubmit = () => {
    handleSubmit();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{readOnly ? 'View Document' : document ? 'Edit Document' : 'Create Document'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
          <Tabs isLazy colorScheme="blue" display="flex" flexDirection="column" h="70vh">
            <TabList px={6} pt={2}>
              <Tab>Details</Tab>
              {document && canEditOwner && <Tab>Notes</Tab>}
            </TabList>
            <TabPanels flex={1} overflowY="hidden">
              <TabPanel h="100%" overflowY="auto">
                <form id="document-form" onSubmit={handleSubmit}>
                  <VStack spacing={4}>
                    {/* File Selection Section - First, only when creating */}
                    {!document && (
                      <>
                        <FormControl isRequired>
                          <FormLabel>Storage Location</FormLabel>
                          <Select
                            value={formData.storageLocation}
                            onChange={(e) => handleFormChange({ storageLocation: e.target.value })}
                            isDisabled={readOnly}
                          >
                            <option value="SHAREPOINT">SharePoint</option>
                            <option value="CONFLUENCE">Confluence</option>
                          </Select>
                        </FormControl>

                        {formData.storageLocation === 'SHAREPOINT' && (
                          <SharePointDocumentSection
                            formData={formData}
                            readOnly={readOnly}
                            document={document}
                            onFileSelect={sharePointIntegration.handleFileSelect}
                            onUrlParse={sharePointIntegration.handleParseUrl}
                            sharePointUrl={sharePointIntegration.sharePointUrl}
                            setSharePointUrl={sharePointIntegration.setSharePointUrl}
                            parsingUrl={sharePointIntegration.parsingUrl}
                            urlError={sharePointIntegration.urlError}
                            setUrlError={sharePointIntegration.setUrlError}
                            documentUrl={sharePointIntegration.documentUrl}
                            loadingUrl={sharePointIntegration.loadingUrl}
                            showReplaceOptions={sharePointIntegration.showReplaceOptions}
                            onToggleReplace={() => sharePointIntegration.setShowReplaceOptions(!sharePointIntegration.showReplaceOptions)}
                            browserOpen={sharePointIntegration.browserOpen}
                            setBrowserOpen={sharePointIntegration.setBrowserOpen}
                          />
                        )}

                        {formData.storageLocation === 'CONFLUENCE' && (
                          <ConfluenceDocumentSection
                            formData={formData}
                            onChange={handleFormChange}
                            readOnly={readOnly}
                          />
                        )}

                        <Divider />
                      </>
                    )}

                    {/* Document Details Section */}
                    <DocumentFormFields
                      formData={formData}
                      onChange={handleFormChange}
                      readOnly={readOnly}
                      onVersionUpdateClick={modals.onVersionUpdateOpen}
                      document={document}
                      hideStorageLocation={!document}
                    />

                    {canEditOwner && (
                      <DocumentOwnerSelection
                        formData={formData}
                        onChange={handleFormChange}
                        readOnly={readOnly}
                        users={users}
                        loadingUsers={loadingUsers}
                      />
                    )}

                    {/* File Selection Section - For edit mode */}
                    {document && formData.storageLocation === 'SHAREPOINT' && (
                      <SharePointDocumentSection
                        formData={formData}
                        readOnly={readOnly}
                        document={document}
                        onFileSelect={sharePointIntegration.handleFileSelect}
                        onUrlParse={sharePointIntegration.handleParseUrl}
                        sharePointUrl={sharePointIntegration.sharePointUrl}
                        setSharePointUrl={sharePointIntegration.setSharePointUrl}
                        parsingUrl={sharePointIntegration.parsingUrl}
                        urlError={sharePointIntegration.urlError}
                        setUrlError={sharePointIntegration.setUrlError}
                        documentUrl={sharePointIntegration.documentUrl}
                        loadingUrl={sharePointIntegration.loadingUrl}
                        showReplaceOptions={sharePointIntegration.showReplaceOptions}
                        onToggleReplace={() => sharePointIntegration.setShowReplaceOptions(!sharePointIntegration.showReplaceOptions)}
                        browserOpen={sharePointIntegration.browserOpen}
                        setBrowserOpen={sharePointIntegration.setBrowserOpen}
                      />
                    )}

                    {document && formData.storageLocation === 'CONFLUENCE' && (
                      <ConfluenceDocumentSection
                        formData={formData}
                        onChange={handleFormChange}
                        readOnly={readOnly}
                      />
                    )}

                    <DocumentReviewDates
                      formData={formData}
                      onChange={handleFormChange}
                      readOnly={readOnly}
                      document={document}
                      isReviewContext={isReviewContext}
                    />

                    <FormControl>
                      <Checkbox
                        isChecked={formData.requiresAcknowledgement}
                        onChange={(e) => handleFormChange({ requiresAcknowledgement: e.target.checked })}
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
                      <DocumentControlLinking
                        linkedControls={controlLinking.linkedControls}
                        controlSearchTerm={controlLinking.controlSearchTerm}
                        setControlSearchTerm={controlLinking.setControlSearchTerm}
                        availableControls={controlLinking.availableControls}
                        suggestedControls={controlLinking.suggestedControls}
                        searchingControls={controlLinking.searchingControls}
                        loadingControls={controlLinking.loadingControls}
                        loadingSuggestedControls={controlLinking.loadingSuggestedControls}
                        onSearchControls={controlLinking.searchControls}
                        onLinkControl={controlLinking.handleLinkControl}
                        onUnlinkControl={controlLinking.handleUnlinkControl}
                        onControlClick={handleControlClick}
                        readOnly={readOnly}
                      />
                    )}
                  </VStack>
                </form>
              </TabPanel>
              {document && canEditOwner && (
                <TabPanel h="100%">
                  <NotesTab documentId={document.id} />
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <>
              {!document && (
                <Button colorScheme="blue" type="submit" form="document-form" isLoading={loading}>
                  Create
                </Button>
              )}
              {document && (
                <Button colorScheme="blue" type="submit" form="document-form" isLoading={loading}>
                  Update
                </Button>
              )}
            </>
          )}
        </ModalFooter>
      </ModalContent>

      <AlertDialog
        isOpen={modals.isConfirmOpen}
        leastDestructiveRef={modals.cancelRef}
        onClose={modals.onConfirmClose}
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
              <Button ref={modals.cancelRef} onClick={modals.onConfirmClose}>
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
        isOpen={modals.isVersionUpdateOpen}
        onClose={modals.onVersionUpdateClose}
        currentVersion={formData.version}
        documentId={document?.id || ''}
        onSuccess={handleVersionUpdateSuccess}
        currentLastReviewDate={document?.lastReviewDate ? new Date(document.lastReviewDate).toISOString().split('T')[0] : null}
        currentNextReviewDate={document?.nextReviewDate ? new Date(document.nextReviewDate).toISOString().split('T')[0] : null}
      />

      <ControlFormModal
        isOpen={modals.isControlModalOpen}
        onClose={modals.onControlModalClose}
        control={modals.selectedControl}
      />
    </Modal >
  );
}
