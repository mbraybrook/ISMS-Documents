/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
  Text,
  Badge,
  Tooltip,
  Select,
  Input,
  Button,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import api from '../services/api';

interface Document {
  id: string;
  title: string;
  type: string;
  storageLocation: string;
  version: string;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  documentUrl?: string | null;
  requiresAcknowledgement?: boolean;
  isOverdueReview?: boolean;
  isUpcomingReview?: boolean;
}

interface User {
  id: string;
  displayName: string;
  email: string;
}

export function StaffDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({
    type: '',
    ownerId: '',
    reviewStatus: '',
    requiresAcknowledgement: '',
    search: '',
  });
  const toast = useToast();

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
  }, []);

    applyFilters();
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/documents', {
        params: {
          limit: 10000, // Get all documents for client-side filtering
        },
      });
      setAllDocuments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Note: This will fail for STAFF users, but that's okay - we'll just not show owner filter
      const response = await api.get('/api/users');
      setUsers(response.data.data || []);
    } catch (error) {
      // STAFF users can't access /api/users, so we'll skip the owner filter
      console.log('Cannot fetch users (expected for STAFF role)');
    }
  };

  const applyFilters = () => {
    let filtered = [...allDocuments];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.type.toLowerCase().includes(searchLower) ||
          doc.owner.displayName.toLowerCase().includes(searchLower)
      );
    }

    if (filters.type) {
      filtered = filtered.filter((doc) => doc.type === filters.type);
    }

    if (filters.ownerId) {
      filtered = filtered.filter((doc) => doc.owner.id === filters.ownerId);
    }

    if (filters.reviewStatus === 'overdue') {
      filtered = filtered.filter((doc) => doc.isOverdueReview === true);
    } else if (filters.reviewStatus === 'upcoming') {
      filtered = filtered.filter((doc) => doc.isUpcomingReview === true);
    }

    if (filters.requiresAcknowledgement === 'true') {
      filtered = filtered.filter((doc) => doc.requiresAcknowledgement === true);
    }

    setDocuments(filtered);
  };

  // Storage location is shown as text only

  const clearFilters = () => {
    setFilters({
      type: '',
      ownerId: '',
      reviewStatus: '',
      requiresAcknowledgement: '',
      search: '',
    });
  };

  if (loading) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Spinner size="xl" />
        <Text>Loading documents...</Text>
      </VStack>
    );
  }

  const documentTypes = Array.from(new Set(allDocuments.map((doc) => doc.type))).sort();

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">Documents</Heading>

      {/* Filters */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <HStack spacing={4} flexWrap="wrap">
          <Box flex="1" minW="200px">
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Search
            </Text>
            <Input
              placeholder="Search documents..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Box>

          <Box minW="150px">
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Document Type
            </Text>
            <Select
              placeholder="All types"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Box>

          {users.length > 0 && (
            <Box minW="150px">
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Owner
              </Text>
              <Select
                placeholder="All owners"
                value={filters.ownerId}
                onChange={(e) => setFilters({ ...filters, ownerId: e.target.value })}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </Select>
            </Box>
          )}

          <Box minW="150px">
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Review Status
            </Text>
            <Select
              placeholder="All"
              value={filters.reviewStatus}
              onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value })}
            >
              <option value="overdue">Overdue review</option>
              <option value="upcoming">Upcoming review</option>
            </Select>
          </Box>

          <Box minW="180px">
            <Text fontSize="sm" mb={1} fontWeight="medium">
              Acknowledgment
            </Text>
            <Select
              placeholder="All"
              value={filters.requiresAcknowledgement}
              onChange={(e) => setFilters({ ...filters, requiresAcknowledgement: e.target.value })}
            >
              <option value="true">Requires acknowledgment</option>
            </Select>
          </Box>

          <Box alignSelf="flex-end">
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </Box>
        </HStack>
      </Box>

      {/* Documents Table */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        {documents.length === 0 ? (
          <Text color="gray.600" textAlign="center" py={8}>
            {allDocuments.length === 0
              ? 'No documents available.'
              : 'No documents match your filters.'}
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Version</Th>
                  <Th>Owner</Th>
                  <Th>Storage Location</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {documents.map((doc) => (
                  <Tr key={doc.id}>
                    <Td>
                      {doc.documentUrl ? (
                        <Link href={doc.documentUrl} isExternal color="blue.500">
                          {doc.title} <ExternalLinkIcon mx="2px" />
                        </Link>
                      ) : (
                        doc.title
                      )}
                    </Td>
                    <Td>{doc.type}</Td>
                    <Td>{doc.version}</Td>
                    <Td>{doc.owner.displayName}</Td>
                    <Td>
                      <Text>{doc.storageLocation}</Text>
                    </Td>
                    <Td>
                      <HStack spacing={2} flexWrap="wrap">
                        {doc.requiresAcknowledgement && (
                          <Tooltip label="You must read this document and acknowledge the current version.">
                            <Badge colorScheme="blue">Requires acknowledgment</Badge>
                          </Tooltip>
                        )}
                        {doc.isOverdueReview && (
                          <Tooltip label="Next review date has passed and the document has not been reviewed.">
                            <Badge colorScheme="red">Overdue for review</Badge>
                          </Tooltip>
                        )}
                        {doc.isUpcomingReview && (
                          <Tooltip label="Document review is due within the next 30 days.">
                            <Badge colorScheme="yellow">Review upcoming</Badge>
                          </Tooltip>
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      {doc.documentUrl && (
                        <Button
                          size="sm"
                          colorScheme="blue"
                          variant="outline"
                          as={Link}
                          href={doc.documentUrl}
                          isExternal
                          rightIcon={<ExternalLinkIcon />}
                        >
                          Open
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Text fontSize="sm" color="gray.600" textAlign="center">
        Showing {documents.length} of {allDocuments.length} document(s)
      </Text>
    </VStack>
  );
}

