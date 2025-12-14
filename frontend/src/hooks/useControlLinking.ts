import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import api from '../services/api';
import { Control } from '../types/control';
import { getErrorMessage } from '../utils/errorHandling';
import type { DocumentFormData } from '../utils/documentForm';

interface LinkedControl {
  id: string;
  code: string;
  title: string;
  category: string | null;
}

interface UseControlLinkingOptions {
  documentId: string | undefined;
  formData: DocumentFormData;
  isOpen: boolean;
  readOnly?: boolean;
}

export function useControlLinking({ documentId, formData, isOpen, readOnly = false }: UseControlLinkingOptions) {
  const toast = useToast();
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [availableControls, setAvailableControls] = useState<LinkedControl[]>([]);
  const [suggestedControls, setSuggestedControls] = useState<LinkedControl[]>([]);
  const [searchingControls, setSearchingControls] = useState(false);
  const [_linkingControl, setLinkingControl] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);
  const [loadingSuggestedControls, setLoadingSuggestedControls] = useState(false);

  const fetchLinkedControls = useCallback(async () => {
    if (!documentId) return;
    try {
      setLoadingControls(true);
      const response = await api.get(`/api/documents/${documentId}/controls`);
      setLinkedControls(response.data);
    } catch (error) {
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
  }, [documentId, toast]);

  const fetchSuggestedControls = useCallback(async () => {
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
          (c: Control) =>
            response.data.suggestedControlIds.includes(c.id) &&
            !linkedControlIds.has(c.id)
        );
        setSuggestedControls(suggested);
      } else {
        setSuggestedControls([]);
      }
    } catch (error: unknown) {
      console.error('Error fetching suggested controls:', error);
      // Don't show error toast for suggestions - it's not critical
      setSuggestedControls([]);
    } finally {
      setLoadingSuggestedControls(false);
    }
  }, [formData.title, formData.type, linkedControls]);

  const searchControls = useCallback(async () => {
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
        response.data.data.filter((c: Control) => {
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
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: 'Failed to search controls',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingControls(false);
    }
  }, [controlSearchTerm, linkedControls, toast]);

  const handleLinkControl = useCallback(async (controlId: string) => {
    if (!documentId) return;
    try {
      setLinkingControl(true);
      await api.post(`/api/documents/${documentId}/controls`, { controlId });
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
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to link control'),
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingControl(false);
    }
  }, [documentId, formData.title, fetchLinkedControls, fetchSuggestedControls, toast]);

  const handleUnlinkControl = useCallback(async (controlId: string) => {
    if (!documentId) return;
    try {
      await api.delete(`/api/documents/${documentId}/controls/${controlId}`);
      toast({
        title: 'Success',
        description: 'Control unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchLinkedControls();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: 'Failed to unlink control',
        status: 'error',
        duration: 3000,
      });
    }
  }, [documentId, fetchLinkedControls, toast]);

  // Fetch linked controls when document is loaded
  useEffect(() => {
    if (isOpen && documentId) {
      fetchLinkedControls();
    } else if (isOpen && !documentId) {
      setLinkedControls([]);
    }
  }, [isOpen, documentId, fetchLinkedControls]);

  // Fetch suggested controls when title or type changes (with debounce)
  useEffect(() => {
    if (!isOpen) {
      setSuggestedControls([]);
      return;
    }

    // Skip fetching suggestions in readOnly mode
    if (readOnly) {
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
  }, [formData.title, formData.type, isOpen, readOnly, fetchSuggestedControls]);

  return {
    linkedControls,
    controlSearchTerm,
    setControlSearchTerm,
    availableControls,
    suggestedControls,
    searchingControls,
    loadingControls,
    loadingSuggestedControls,
    searchControls,
    handleLinkControl,
    handleUnlinkControl,
  };
}

