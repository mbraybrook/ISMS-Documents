import { useState } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  FormControl,
  FormLabel,
  Input,
  Alert,
  AlertIcon,
  AlertDescription,
  Progress,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { authService } from '../services/authService';
import { SharePointFileBrowser } from '../components/SharePointFileBrowser';

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

interface ImportResult {
  itemId: string;
  document?: any;
  success: boolean;
  error?: string;
}

export function MassImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [selectedFiles, setSelectedFiles] = useState<SharePointItem[]>([]);
  const [defaults, setDefaults] = useState({
    type: 'OTHER',
    status: 'DRAFT',
    version: '1.0',
  });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importErrors, setImportErrors] = useState<any[]>([]);

  const handleFileSelection = (items: SharePointItem[]) => {
    setSelectedFiles(items);
    setImportResults([]);
    setImportErrors([]);
  };

  const handleRemoveFile = (itemId: string) => {
    setSelectedFiles(selectedFiles.filter((f) => f.id !== itemId));
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to import',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportResults([]);
    setImportErrors([]);

    try {
      const graphToken = await authService.getGraphAccessToken();
      if (!graphToken) {
        toast({
          title: 'Consent Required',
          description: 'Unable to get access token. You may need to grant consent for SharePoint permissions. Please try again - a consent window should appear.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
        setImporting(false);
        return;
      }

      const items = selectedFiles.map((file) => ({
        itemId: file.id,
        siteId: file.siteId, // Include siteId if available
        driveId: file.driveId, // Include driveId if available
      }));

      const response = await api.post(
        '/api/documents/bulk-import',
        {
          items,
          defaults,
        },
        {
          headers: {
            'x-graph-token': graphToken,
          },
        }
      );

      setImportResults(response.data.results || []);
      setImportErrors(response.data.errors || []);
      setImportProgress(100);

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${response.data.success} of ${response.data.total} documents`,
        status: response.data.failed > 0 ? 'warning' : 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || 'Failed to import documents';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Mass Import Documents</Heading>
        <Button onClick={() => navigate('/admin/documents/documents')} variant="ghost">
          Back to Documents
        </Button>
      </HStack>

      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <VStack spacing={4} align="stretch">
          <Heading size="md">Step 1: Select Files</Heading>
          <Button onClick={onOpen} colorScheme="blue" width="fit-content">
            Browse SharePoint Files
          </Button>
          {selectedFiles.length > 0 && (
            <Box>
              <Text mb={2} fontWeight="semibold">
                Selected Files ({selectedFiles.length})
              </Text>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Size</Th>
                    <Th>Modified</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {selectedFiles.map((file) => (
                    <Tr key={file.id}>
                      <Td>{file.name}</Td>
                      <Td>{formatFileSize(file.size)}</Td>
                            <Td>
                              {new Date(file.lastModifiedDateTime).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </Td>
                      <Td>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleRemoveFile(file.id)}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </VStack>
      </Box>

      {selectedFiles.length > 0 && (
        <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
          <VStack spacing={4} align="stretch">
            <Heading size="md">Step 2: Set Defaults</Heading>
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Document Type</FormLabel>
                <Select
                  value={defaults.type}
                  onChange={(e) =>
                    setDefaults({ ...defaults, type: e.target.value })
                  }
                >
                  <option value="POLICY">Policy</option>
                  <option value="PROCEDURE">Procedure</option>
                  <option value="MANUAL">Manual</option>
                  <option value="RECORD">Record</option>
                  <option value="TEMPLATE">Template</option>
                  <option value="OTHER">Other</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={defaults.status}
                  onChange={(e) =>
                    setDefaults({ ...defaults, status: e.target.value })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SUPERSEDED">Superseded</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Version</FormLabel>
                <Input
                  value={defaults.version}
                  onChange={(e) =>
                    setDefaults({ ...defaults, version: e.target.value })
                  }
                />
              </FormControl>
            </HStack>
          </VStack>
        </Box>
      )}

      {selectedFiles.length > 0 && (
        <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
          <VStack spacing={4} align="stretch">
            <Heading size="md">Step 3: Import</Heading>
            <Button
              onClick={handleImport}
              colorScheme="green"
              isLoading={importing}
              isDisabled={importing}
              width="fit-content"
            >
              Import {selectedFiles.length} Document{selectedFiles.length !== 1 ? 's' : ''}
            </Button>

            {importing && (
              <Box>
                <Progress value={importProgress} isIndeterminate={importProgress === 0} />
                <Text mt={2} fontSize="sm" color="gray.600">
                  Importing documents...
                </Text>
              </Box>
            )}

            {importResults.length > 0 && (
              <Box>
                <Text mb={2} fontWeight="semibold">
                  Import Results
                </Text>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>File</Th>
                      <Th>Status</Th>
                      <Th>Document ID</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {importResults.map((result) => (
                      <Tr key={result.itemId}>
                        <Td>
                          {selectedFiles.find((f) => f.id === result.itemId)?.name || result.itemId}
                        </Td>
                        <Td>
                          <Badge colorScheme="green">Success</Badge>
                        </Td>
                        <Td>
                          <Text fontSize="xs" fontFamily="mono">
                            {result.document?.id}
                          </Text>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}

            {importErrors.length > 0 && (
              <Box>
                <Text mb={2} fontWeight="semibold" color="red.600">
                  Import Errors ({importErrors.length})
                </Text>
                {importErrors.map((error, index) => (
                  <Alert key={index} status="error" mb={2}>
                    <AlertIcon />
                    <AlertDescription>
                      <Text fontWeight="semibold">
                        {error.name || error.itemId}
                      </Text>
                      <Text fontSize="sm">{error.error}</Text>
                    </AlertDescription>
                  </Alert>
                ))}
              </Box>
            )}

            {importResults.length > 0 && importErrors.length === 0 && (
              <Button
                onClick={() => navigate('/admin/documents/documents')}
                colorScheme="blue"
                width="fit-content"
              >
                View Imported Documents
              </Button>
            )}
          </VStack>
        </Box>
      )}

      <SharePointFileBrowser
        isOpen={isOpen}
        onClose={onClose}
        onSelect={() => {}} // Not used in multi-select mode
        multiSelect={true}
        onMultiSelect={handleFileSelection}
      />
    </VStack>
  );
}

