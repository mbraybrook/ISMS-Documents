import { useState, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import api from '../services/api';
import { authService } from '../services/authService';
import { getErrorMessage, getErrorDetails } from '../utils/errorHandling';
import type { DocumentFormData } from '../utils/documentForm';

export interface SharePointItem {
  id: string;
  name: string;
  siteId?: string;
  driveId?: string;
}

interface UseSharePointIntegrationOptions {
  formData: DocumentFormData;
  setFormData: React.Dispatch<React.SetStateAction<DocumentFormData>>;
  document: { sharePointSiteId?: string; sharePointDriveId?: string; sharePointItemId?: string; documentUrl?: string | null } | null;
}

export function useSharePointIntegration({ formData, setFormData, document }: UseSharePointIntegrationOptions) {
  const toast = useToast();
  const [sharePointUrl, setSharePointUrl] = useState('');
  const [parsingUrl, setParsingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [showReplaceOptions, setShowReplaceOptions] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const loadDocumentUrl = useCallback(async (doc: Partial<{ sharePointSiteId?: string; sharePointDriveId?: string; sharePointItemId?: string; documentUrl?: string | null }>) => {
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
        } catch (error: unknown) {
          console.warn('[DocumentFormModal] Error fetching SharePoint item from Graph API:', getErrorDetails(error));
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
      } catch (error: unknown) {
        console.error('[DocumentFormModal] Error generating fallback URL:', getErrorDetails(error));
        setDocumentUrl(null);
      }
    } catch (error: unknown) {
      console.error('[DocumentFormModal] Unexpected error loading document URL:', error);
      setDocumentUrl(null);
    } finally {
      setLoadingUrl(false);
    }
  }, []);

  const handleParseUrl = useCallback(async () => {
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
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to parse SharePoint URL. Please check the URL and try again.');
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
  }, [sharePointUrl, formData, setFormData, document, loadDocumentUrl, toast]);

  const handleFileSelect = useCallback((item: SharePointItem) => {
    const selectedSiteId = item.siteId || formData.sharePointSiteId || '';
    const newFormData = {
      ...formData,
      sharePointSiteId: selectedSiteId,
      sharePointDriveId: item.driveId || formData.sharePointDriveId || '',
      sharePointItemId: item.id,
      title: item.name || formData.title,
    };
    setFormData(newFormData);
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
  }, [formData, setFormData, document, loadDocumentUrl, toast]);

  return {
    sharePointUrl,
    setSharePointUrl,
    parsingUrl,
    urlError,
    setUrlError,
    browserOpen,
    setBrowserOpen,
    showReplaceOptions,
    setShowReplaceOptions,
    documentUrl,
    loadingUrl,
    handleParseUrl,
    handleFileSelect,
    loadDocumentUrl,
  };
}

