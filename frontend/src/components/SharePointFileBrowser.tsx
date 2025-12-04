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
  HStack,
  Box,
  Text,
  Spinner,
  IconButton,
  useToast,
  Checkbox,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { authService } from '../services/authService';
import { sharePointApi } from '../services/api';
import { Select } from '@chakra-ui/react';

interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  size: number;
  siteId?: string; // Site ID where the item is located
  driveId?: string; // Drive ID where the item is located
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
}

interface SharePointFileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SharePointItem) => void;
  multiSelect?: boolean;
  onMultiSelect?: (items: SharePointItem[]) => void;
  siteId?: string;
  driveId?: string;
  defaultSiteId?: string;
  allowSiteSelection?: boolean;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
  path: string | null;
}

export function SharePointFileBrowser({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
  onMultiSelect,
  siteId,
  driveId,
  defaultSiteId,
  allowSiteSelection = true,
}: SharePointFileBrowserProps) {
  const [items, setItems] = useState<SharePointItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Root', path: null },
  ]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(siteId || defaultSiteId);
  const [currentDriveId, setCurrentDriveId] = useState<string | undefined>(driveId);
  const [availableSites, setAvailableSites] = useState<Array<{ id: string; displayName: string; name: string; webUrl: string }>>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const initialLoadRef = useRef(false);
  const manualSiteChangeRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      initialLoadRef.current = false;
      // Initialize selected site
      const initialSiteId = siteId || defaultSiteId;
      
      // If site selection is allowed, always load the sites list to populate dropdown
      if (allowSiteSelection) {
        // Set the initial selection, but still load sites list for dropdown
        setSelectedSiteId(initialSiteId);
        loadAvailableSites();
        // If we have an initial site ID, also load items immediately
        if (initialSiteId) {
          setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
          initialLoadRef.current = true;
          loadItems(undefined, undefined, initialSiteId);
        }
      } else if (initialSiteId) {
        // If selection not allowed but we have a site ID, load items directly
        setSelectedSiteId(initialSiteId);
        setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
        initialLoadRef.current = true;
        loadItems(undefined, undefined, initialSiteId);
      }
    } else {
      // Reset state when modal closes
      setItems([]);
      setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
      setSelectedItems(new Set());
      setError(null);
      setSelectedSiteId(siteId || defaultSiteId);
      setAvailableSites([]);
      initialLoadRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, siteId, defaultSiteId, allowSiteSelection]);

  // Reload items when selected site changes (but not on initial mount if we already loaded)
  // Note: This effect is mainly for when selectedSiteId changes programmatically
  // Manual dropdown changes handle loading directly in the onChange handler
  useEffect(() => {
    if (isOpen && selectedSiteId && !initialLoadRef.current && !manualSiteChangeRef.current) {
      // Only reload if we're not manually changing the site (manual changes handle loading themselves)
      setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
      loadItems(undefined, undefined, selectedSiteId);
    }
    // Reset the manual change flag after effect runs
    if (manualSiteChangeRef.current) {
      manualSiteChangeRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, isOpen]);

  const loadAvailableSites = async () => {
    setLoadingSites(true);
    try {
      const graphToken = await authService.getGraphAccessToken();
      if (!graphToken) {
        setError('Unable to get access token. You may need to grant consent for SharePoint permissions.');
        setLoadingSites(false);
        return;
      }
      const sites = await sharePointApi.getSites();
      setAvailableSites(sites);
      
      // Determine which site to select
      let siteToSelect: string | undefined = selectedSiteId;
      
      // If no site is currently selected, try to find the best match
      if (!siteToSelect && sites.length > 0) {
        // First, try to match by defaultSiteId if provided
        if (defaultSiteId) {
          const matchingSite = sites.find(site => site.id === defaultSiteId);
          if (matchingSite) {
            siteToSelect = matchingSite.id;
          }
        }
        
        // If no match by ID, try to find a site with "Compliance" in the name
        if (!siteToSelect) {
          const complianceSite = sites.find(site => 
            site.displayName?.toLowerCase().includes('compliance') || 
            site.name?.toLowerCase().includes('compliance')
          );
          if (complianceSite) {
            siteToSelect = complianceSite.id;
          }
        }
        
        // Fall back to first site if no match found
        if (!siteToSelect) {
          siteToSelect = sites[0].id;
        }
        
        // Update selected site if we found a different one
        if (siteToSelect !== selectedSiteId) {
          setSelectedSiteId(siteToSelect);
          setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
          loadItems(undefined, undefined, siteToSelect);
        }
      } else if (siteToSelect && !initialLoadRef.current) {
        // If we have a selected site but haven't loaded items yet, load them
        // (This handles the case where defaultSiteId was set but items weren't loaded)
        const siteExists = sites.some(site => site.id === siteToSelect);
        if (siteExists) {
          setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
          loadItems(undefined, undefined, siteToSelect);
        }
      }
    } catch (err: any) {
      console.error('Error loading sites:', err);
      setError('Failed to load SharePoint sites');
      toast({
        title: 'Error',
        description: 'Failed to load SharePoint sites',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingSites(false);
    }
  };

  const loadItems = async (folderId?: string, folderPath?: string, overrideSiteId?: string) => {
    setLoading(true);
    setError(null);

    // Use overrideSiteId if provided (highest priority), otherwise use selectedSiteId, then fall back to siteId prop
    // overrideSiteId is used when explicitly changing sites to avoid stale state issues
    const effectiveSiteId = overrideSiteId || selectedSiteId || siteId;
    
    // Ensure we have a valid site ID
    if (!effectiveSiteId) {
      setError('Site ID is required');
      setLoading(false);
      return;
    }
    

    try {
      const graphToken = await authService.getGraphAccessToken();
      if (!graphToken) {
        setError('Unable to get access token. You may need to grant consent for SharePoint permissions. Please try again - a consent window should appear.');
        setLoading(false);
        toast({
          title: 'Consent Required',
          description: 'Please grant consent for SharePoint access. A popup window should appear, or you may be redirected.',
          status: 'info',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
        return;
      }

      const params: any = {};
      params.siteId = effectiveSiteId;
      
      // When changing sites (overrideSiteId is provided), don't pass driveId
      // This allows the backend to get the default drive for the new site
      // Otherwise, use currentDriveId or the prop driveId
      const isChangingSite = !!overrideSiteId && overrideSiteId !== siteId;
      const driveIdToUse = isChangingSite ? undefined : (currentDriveId || driveId);
      
      if (driveIdToUse) {
        params.driveId = driveIdToUse;
      }
      
      if (folderId) params.folderId = folderId;
      if (folderPath) params.folderPath = folderPath;

      console.log('[SharePointFileBrowser] Loading items:', {
        effectiveSiteId,
        overrideSiteId,
        propSiteId: siteId,
        isChangingSite,
        currentDriveId,
        propDriveId: driveId,
        driveIdToUse: params.driveId,
        folderId,
        folderPath,
      });

      const response = await api.get('/api/sharepoint/items', {
        params,
        headers: {
          'x-graph-token': graphToken,
        },
      });

      console.log('[SharePointFileBrowser] Response received:', {
        itemCount: response.data.items?.length || 0,
        firstItem: response.data.items?.[0]?.name,
        firstItemSiteId: response.data.items?.[0]?.siteId,
        firstItemDriveId: response.data.items?.[0]?.driveId,
      });

      // Only update items if we're still using the same site (to prevent race conditions)
      const currentEffectiveSiteId = overrideSiteId || selectedSiteId || siteId;
      if (currentEffectiveSiteId === effectiveSiteId) {
        const items = response.data.items || [];
        setItems(items);
        
        // Update currentDriveId from the response if available
        if (items.length > 0 && items[0].driveId) {
          const newDriveId = items[0].driveId;
          if (newDriveId !== currentDriveId) {
            console.log('[SharePointFileBrowser] Updating driveId from response:', {
              old: currentDriveId,
              new: newDriveId,
            });
            setCurrentDriveId(newDriveId);
          }
        }
      } else {
        console.warn('[SharePointFileBrowser] Ignoring response - site ID changed during request', {
          requestedSiteId: effectiveSiteId,
          currentSiteId: currentEffectiveSiteId,
        });
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || 'Failed to load SharePoint items';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (item: SharePointItem) => {
    if (!item.folder) return;

    const newBreadcrumb: BreadcrumbItem = {
      id: item.id,
      name: item.name,
      path: null,
    };
    setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
    loadItems(item.id, undefined, selectedSiteId);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    const target = newBreadcrumbs[newBreadcrumbs.length - 1];
    loadItems(target.id || undefined, undefined, selectedSiteId);
  };

  const handleFileSelect = (item: SharePointItem) => {
    // Ensure item has siteId and driveId from current selection
    const itemWithSite = {
      ...item,
      siteId: item.siteId || selectedSiteId,
      driveId: item.driveId || driveId,
    };
    
    if (multiSelect) {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
      } else {
        newSelected.add(item.id);
      }
      setSelectedItems(newSelected);
    } else {
      onSelect(itemWithSite);
      onClose();
    }
  };

  const handleConfirmSelection = () => {
    if (!onMultiSelect) return;

    const selected = items
      .filter((item) => selectedItems.has(item.id))
      .map((item) => ({
        ...item,
        siteId: item.siteId || selectedSiteId,
        driveId: item.driveId || driveId,
      }));
    onMultiSelect(selected);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getFileTypeShort = (mimeType?: string): string => {
    if (!mimeType) return 'File';
    
    // Common MIME types to short names
    const mimeMap: Record<string, string> = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
      'application/pdf': 'PDF',
      'application/msword': 'Word',
      'application/vnd.ms-excel': 'Excel',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'text/plain': 'Text',
      'text/csv': 'CSV',
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'application/zip': 'ZIP',
    };

    // Check exact match first
    if (mimeMap[mimeType]) {
      return mimeMap[mimeType];
    }

    // Check for partial matches
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('text')) return 'Text';

    // Return the MIME type if no match, but truncate if too long
    return mimeType.length > 20 ? mimeType.substring(0, 20) + '...' : mimeType;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>Browse SharePoint Files</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Site Selection */}
            {allowSiteSelection && (
              <FormControl>
                <FormLabel>SharePoint Site</FormLabel>
                {loadingSites ? (
                  <HStack>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="gray.500">Loading sites...</Text>
                  </HStack>
                ) : (
                  <Select
                    value={selectedSiteId || ''}
                    onChange={async (e) => {
                      const newSiteId = e.target.value;
                      if (newSiteId !== selectedSiteId && newSiteId) {
                        // Set flag to prevent useEffect from interfering
                        manualSiteChangeRef.current = true;
                        
                        // Clear driveId when changing sites so backend gets default for new site
                        setCurrentDriveId(undefined);
                        
                        // Update state first
                        setSelectedSiteId(newSiteId);
                        // Reset breadcrumbs and clear items immediately
                        setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
                        setItems([]);
                        setError(null);
                        // Load items with the new site ID - use overrideSiteId to ensure we use the new value
                        // even if state hasn't updated yet. Don't pass driveId so backend gets default.
                        await loadItems(undefined, undefined, newSiteId);
                      }
                    }}
                    placeholder="Select a SharePoint site"
                    isDisabled={loadingSites || availableSites.length === 0}
                  >
                    {availableSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.displayName || site.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormControl>
            )}

            {/* Breadcrumbs */}
            <HStack spacing={2} flexWrap="wrap">
              {breadcrumbs.map((crumb, index) => (
                <HStack key={index} spacing={1}>
                  {index > 0 && <ChevronRightIcon color="gray.400" />}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBreadcrumbClick(index)}
                    _hover={{ 
                      textDecoration: 'underline',
                      bg: 'blue.50',
                      color: 'blue.600'
                    }}
                    textDecoration={index === breadcrumbs.length - 1 ? 'none' : 'underline'}
                    fontWeight={index === breadcrumbs.length - 1 ? 'semibold' : 'normal'}
                    color={index === breadcrumbs.length - 1 ? 'gray.700' : 'blue.600'}
                  >
                    {crumb.name}
                  </Button>
                </HStack>
              ))}
            </HStack>

            {error && (
              <Box p={3} bg="red.50" borderRadius="md" color="red.700">
                {error}
              </Box>
            )}

            {loading ? (
              <Box textAlign="center" p={8}>
                <Spinner size="xl" />
                <Text mt={4}>Loading files...</Text>
              </Box>
            ) : (
              <Box overflowY="auto" maxH="400px">
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      {multiSelect && <Th width="50px"></Th>}
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>Size</Th>
                      <Th>Modified</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {items.length === 0 ? (
                      <Tr>
                        <Td colSpan={multiSelect ? 5 : 4} textAlign="center" py={8}>
                          <Text color="gray.500">No items found</Text>
                        </Td>
                      </Tr>
                    ) : (
                      items.map((item) => {
                        const isFolder = !!item.folder;
                        const isSelected = selectedItems.has(item.id);

                        return (
                          <Tr
                            key={item.id}
                            cursor="pointer"
                            onClick={() => {
                              if (isFolder) {
                                handleFolderClick(item);
                              } else if (multiSelect) {
                                handleFileSelect(item);
                              } else {
                                // Single-select mode: select file directly
                                onSelect(item);
                                onClose();
                              }
                            }}
                            bg={isSelected ? 'blue.50' : 'transparent'}
                            _hover={{ bg: isSelected ? 'blue.100' : 'gray.50' }}
                          >
                            {multiSelect && !isFolder && (
                              <Td onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  isChecked={isSelected}
                                  onChange={() => handleFileSelect(item)}
                                />
                              </Td>
                            )}
                            {multiSelect && isFolder && <Td></Td>}
                            <Td>
                              <HStack>
                                <Text fontWeight={isFolder ? 'bold' : 'normal'}>
                                  {item.name}
                                </Text>
                                {isFolder && (
                                  <Badge colorScheme="blue" fontSize="xs">
                                    Folder
                                  </Badge>
                                )}
                              </HStack>
                            </Td>
                            <Td>
                              {isFolder ? (
                                <Text color="gray.500">Folder</Text>
                              ) : (
                                <Text color="gray.500">
                                  {getFileTypeShort(item.file?.mimeType)}
                                </Text>
                              )}
                            </Td>
                            <Td>
                              {isFolder ? (
                                <Text color="gray.500">-</Text>
                              ) : (
                                <Text>{formatFileSize(item.size)}</Text>
                              )}
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.600">
                                {formatDate(item.lastModifiedDateTime)}
                              </Text>
                            </Td>
                          </Tr>
                        );
                      })
                    )}
                  </Tbody>
                </Table>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            {multiSelect && (
              <Button
                colorScheme="blue"
                onClick={handleConfirmSelection}
                isDisabled={selectedItems.size === 0}
              >
                Select {selectedItems.size} file{selectedItems.size !== 1 ? 's' : ''}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {multiSelect ? 'Cancel' : 'Close'}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

