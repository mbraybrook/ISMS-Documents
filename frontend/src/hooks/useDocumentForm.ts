import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultFormData, toISODateString, getNextReviewDate, type DocumentFormData, type Document } from '../utils/documentForm';

interface UseDocumentFormOptions {
  document: Document | null;
  isOpen: boolean;
  isReviewContext: boolean;
  readOnly: boolean;
  onClose: () => void;
}

export function useDocumentForm({ document, isOpen, isReviewContext, readOnly, onClose }: UseDocumentFormOptions) {
  const { user } = useAuth();
  const toast = useToast();
  const [formData, setFormData] = useState<DocumentFormData>(getDefaultFormData(user?.id));
  const [loading, setLoading] = useState(false);
  const [_pendingSubmit, setPendingSubmit] = useState(false);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (readOnly) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = { ...formData };
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
  }, [formData, document, readOnly, onClose, toast]);

  const handleVersionUpdateSuccess = useCallback(async () => {
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
            ? toISODateString(updatedDocument.lastReviewDate)
            : '',
          nextReviewDate: updatedDocument.nextReviewDate
            ? toISODateString(updatedDocument.nextReviewDate)
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
  }, [document]);

  // Initialize form data when modal opens or document changes
  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData(getDefaultFormData(user?.id));
      return;
    }

    if (document) {
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
        ? toISODateString(document.nextReviewDate)
        : '';

      if (isReviewContext && !readOnly) {
        nextReviewDate = getNextReviewDate();
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
            ? toISODateString(document.lastReviewDate)
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
      setFormData(getDefaultFormData(user?.id));
    }
  }, [document, user, isOpen, isReviewContext, readOnly]);

  return {
    formData,
    setFormData,
    loading,
    handleSubmit,
    handleVersionUpdateSuccess,
  };
}


