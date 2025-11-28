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
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { authService } from '../services/authService';

interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  size: number;
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
}: SharePointFileBrowserProps) {
  const [items, setItems] = useState<SharePointItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Root', path: null },
  ]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      loadItems();
    } else {
      // Reset state when modal closes
      setItems([]);
      setBreadcrumbs([{ id: null, name: 'Root', path: null }]);
      setSelectedItems(new Set());
      setError(null);
    }
  }, [isOpen]);

  const loadItems = async (folderId?: string, folderPath?: string) => {
    setLoading(true);
    setError(null);

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
      if (siteId) params.siteId = siteId;
      if (driveId) params.driveId = driveId;
      if (folderId) params.folderId = folderId;
      if (folderPath) params.folderPath = folderPath;

      const response = await api.get('/api/sharepoint/items', {
        params,
        headers: {
          'x-graph-token': graphToken,
        },
      });

      setItems(response.data.items || []);
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
    loadItems(item.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    const target = newBreadcrumbs[newBreadcrumbs.length - 1];
    loadItems(target.id || undefined);
  };

  const handleFileSelect = (item: SharePointItem) => {
    if (multiSelect) {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
      } else {
        newSelected.add(item.id);
      }
      setSelectedItems(newSelected);
    } else {
      onSelect(item);
      onClose();
    }
  };

  const handleConfirmSelection = () => {
    if (!onMultiSelect) return;

    const selected = items.filter((item) => selectedItems.has(item.id));
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

