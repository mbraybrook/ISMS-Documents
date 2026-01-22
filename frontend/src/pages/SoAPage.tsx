import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  Text,
  Alert,
  AlertIcon,
  useToast,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
} from '@chakra-ui/react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';

interface SoAExport {
  id: string;
  generatedAt: string;
  exportFormat: string;
  generatedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

export function SoAPage() {
  usePageTitle('Statement of Applicability', true);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [updatingApplicability, setUpdatingApplicability] = useState(false);
  const [exports, setExports] = useState<SoAExport[]>([]);
  const [_loadingExports, setLoadingExports] = useState(false);
  const toast = useToast();

  const isAdminOrEditor = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  const handleExport = async (format: 'EXCEL' | 'PDF' = 'EXCEL') => {
    if (!isAdminOrEditor) {
      toast({
        title: 'Unauthorized',
        description: 'Only Admins and Editors can generate SoA exports.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        '/api/soa/export',
        { format },
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `SoA_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'SoA export generated successfully.',
        status: 'success',
        duration: 3000,
      });

      // Refresh exports list
      loadExports();
    } catch (error: unknown) {
      console.error('Error generating SoA export:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to generate SoA export';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExports = async () => {
    if (!isAdminOrEditor) return;

    setLoadingExports(true);
    try {
      const response = await api.get('/api/soa/exports');
      setExports(response.data);
    } catch (error) {
      console.error('Error loading exports:', error);
    } finally {
      setLoadingExports(false);
    }
  };

  const handleUpdateControlApplicability = async () => {
    if (!isAdminOrEditor) {
      toast({
        title: 'Unauthorized',
        description: 'Only Admins and Editors can update control applicability.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setUpdatingApplicability(true);
    try {
      const response = await api.post('/api/soa/update-control-applicability');
      const { message, before, after, changed } = response.data;

      toast({
        title: 'Success',
        description: message,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Log detailed stats in console for debugging
      console.log('Control Applicability Update:', {
        before: `${before.selected}/${before.total} selected`,
        after: `${after.selected}/${after.total} selected`,
        changed,
      });
    } catch (error: unknown) {
      console.error('Error updating control applicability:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update control applicability';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdatingApplicability(false);
    }
  };

  // Load exports on mount
  useEffect(() => {
    loadExports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdminOrEditor) {
    return (
      <Box>
        <Alert status="warning">
          <AlertIcon />
          You do not have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="xl" mb={4}>
          Statement of Applicability (SoA) Export
        </Heading>
        <Text fontSize="md" color="gray.600" mb={6}>
          Generate a Statement of Applicability report in Excel format. The
          report includes all Annex A controls with their applicability status,
          justifications, and links to risks and documents.
        </Text>
      </Box>

      <Box>
        <HStack spacing={4} mb={6}>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={() => handleExport('EXCEL')}
            isLoading={loading}
            loadingText="Generating..."
          >
            Generate SoA (Excel)
          </Button>
        </HStack>
        <Box mb={6} p={4} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            Administrative Actions
          </Text>
          <Text fontSize="xs" color="gray.600" mb={3}>
            Update control applicability flags based on current Risk-Control linkages. This ensures controls
            linked to active risks are correctly marked as "Selected" for implementation.
          </Text>
          <Button
            colorScheme="orange"
            size="sm"
            onClick={handleUpdateControlApplicability}
            isLoading={updatingApplicability}
            loadingText="Updating..."
          >
            Update Control Applicability
          </Button>
        </Box>
      </Box>

      {exports.length > 0 && (
        <Box>
          <Heading size="md" mb={4}>
            Previous Exports
          </Heading>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Generated At</Th>
                <Th>Format</Th>
                <Th>Generated By</Th>
              </Tr>
            </Thead>
            <Tbody>
              {exports.map((exportItem) => (
                <Tr key={exportItem.id}>
                  <Td>
                    {new Date(exportItem.generatedAt).toLocaleString()}
                  </Td>
                  <Td>
                    <Badge colorScheme="blue">
                      {exportItem.exportFormat}
                    </Badge>
                  </Td>
                  <Td>{exportItem.generatedBy?.displayName || 'Unknown'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </VStack>
  );
}

