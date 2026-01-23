import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Alert,
  AlertIcon,
  useToast,
  Badge,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Input,
  Select,
  Link,
  Spinner,
} from '@chakra-ui/react';
import { AxiosError } from 'axios';
import { acknowledgmentApi, AcknowledgmentStats, DocumentAcknowledgmentDetails } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

export function AcknowledgmentReportingPage() {
  usePageTitle('Acknowledgment Reporting', true);
  const [stats, setStats] = useState<AcknowledgmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentDetails, setDocumentDetails] = useState<DocumentAcknowledgmentDetails | null>(null);
  const [_selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('required');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await acknowledgmentApi.getAcknowledgmentStats(undefined, true);
      setStats(data);
    } catch (error: unknown) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load acknowledgment statistics',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDocumentClick = async (documentId: string) => {
    try {
      setSelectedDocumentId(documentId);
      const details = await acknowledgmentApi.getDocumentAcknowledgmentDetails(documentId, 1, 50);
      setDocumentDetails(details);
      onOpen();
    } catch (error: unknown) {
      console.error('Error fetching document details:', error);
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to load document details',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    if (!stats) return;

    const headers = [
      'Document Title',
      'Version',
      'Required Date',
      'Total Users',
      'Acknowledged',
      'Not Acknowledged',
      'Percentage',
    ];

    const rows = filteredAndSortedDocuments.map((doc) => [
      doc.documentTitle,
      doc.documentVersion,
      doc.lastChangedDate
        ? new Date(doc.lastChangedDate).toLocaleDateString()
        : 'N/A',
      doc.totalUsers.toString(),
      doc.acknowledgedCount.toString(),
      doc.notAcknowledgedCount.toString(),
      `${doc.percentage.toFixed(2)}%`,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acknowledgment-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = stats
    ? stats.documents
        .filter((doc) => {
          if (filterType !== 'all' && doc.requiresAcknowledgement !== (filterType === 'required')) {
            return false;
          }
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return doc.documentTitle.toLowerCase().includes(query);
          }
          return true;
        })
        .sort((a, b) => {
          let aVal: string | number;
          let bVal: string | number;

          switch (sortColumn) {
            case 'title':
              aVal = a.documentTitle;
              bVal = b.documentTitle;
              break;
            case 'version':
              aVal = a.documentVersion;
              bVal = b.documentVersion;
              break;
            case 'requiredDate':
              aVal = a.lastChangedDate || '';
              bVal = b.lastChangedDate || '';
              break;
            case 'acknowledged':
              aVal = a.acknowledgedCount;
              bVal = b.acknowledgedCount;
              break;
            case 'percentage':
              aVal = a.percentage;
              bVal = b.percentage;
              break;
            default:
              aVal = a.documentTitle;
              bVal = b.documentTitle;
          }

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
          }
          return 0;
        })
    : [];

  const documentsRequiringAck = stats
    ? stats.documents.filter((doc) => doc.requiresAcknowledgement).length
    : 0;

  const lowAcknowledgmentDocs = stats
    ? stats.documents.filter((doc) => doc.requiresAcknowledgement && doc.percentage < 80).length
    : 0;

  if (loading) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Acknowledgment Reporting</Heading>
        <Box p={8} textAlign="center">
          <Spinner size="xl" />
        </Box>
      </VStack>
    );
  }

  if (!stats) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Acknowledgment Reporting</Heading>
        <Alert status="error">
          <AlertIcon />
          Failed to load acknowledgment statistics
        </Alert>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Acknowledgment Reporting</Heading>
        <HStack>
          <Button onClick={fetchStats} size="sm">
            Refresh
          </Button>
          <Button onClick={exportToCSV} size="sm" colorScheme="blue">
            Export CSV
          </Button>
        </HStack>
      </HStack>

      {stats.dataAsOf && (
        <Alert status="info">
          <AlertIcon />
          <Text>
            Data as of: {new Date(stats.dataAsOf).toLocaleString()}
            {!stats.dataAsOf && ' (No sync performed yet)'}
          </Text>
        </Alert>
      )}

      {!stats.dataAsOf && (
        <Alert status="warning">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">No Entra ID group configured or synced</Text>
            <Text>
              Please configure and sync the all-staff group in{' '}
              <Link href="/admin/documents/acknowledgments/config" color="blue.500">
                Acknowledgment Config
              </Link>{' '}
              to view accurate statistics.
            </Text>
          </Box>
        </Alert>
      )}

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Documents Requiring Acknowledgment</StatLabel>
          <StatNumber>{documentsRequiringAck}</StatNumber>
        </Stat>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Total Staff</StatLabel>
          <StatNumber>{stats.summary.totalUsers}</StatNumber>
          <StatHelpText>
            {stats.dataAsOf
              ? `From Entra ID group (synced ${new Date(stats.dataAsOf).toLocaleDateString()})`
              : 'Not synced'}
          </StatHelpText>
        </Stat>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Average Acknowledgment Rate</StatLabel>
          <StatNumber>{stats.summary.averageAcknowledgmentRate.toFixed(1)}%</StatNumber>
        </Stat>
        <Stat p={4} bg="white" borderRadius="md" boxShadow="sm">
          <StatLabel>Low Acknowledgment Rate</StatLabel>
          <StatNumber color={lowAcknowledgmentDocs > 0 ? 'orange.500' : 'green.500'}>
            {lowAcknowledgmentDocs}
          </StatNumber>
          <StatHelpText>Documents with &lt;80% acknowledgment</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Filters */}
      <HStack spacing={4}>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          maxW="200px"
        >
          <option value="all">All Documents</option>
          <option value="required">Requires Acknowledgment</option>
          <option value="notRequired">Does Not Require</option>
        </Select>
        <Input
          placeholder="Search by document title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          maxW="300px"
        />
      </HStack>

      {/* Document Table */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th
                cursor="pointer"
                onClick={() => handleSort('title')}
                _hover={{ bg: 'gray.100' }}
              >
                Document Title
                {sortColumn === 'title' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('version')}
                _hover={{ bg: 'gray.100' }}
              >
                Version
                {sortColumn === 'version' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('requiredDate')}
                _hover={{ bg: 'gray.100' }}
              >
                Required Date
                {sortColumn === 'requiredDate' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Th>
              <Th>Requires Ack</Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('acknowledged')}
                _hover={{ bg: 'gray.100' }}
              >
                Acknowledged
                {sortColumn === 'acknowledged' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Th>
              <Th>Not Acknowledged</Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('percentage')}
                _hover={{ bg: 'gray.100' }}
              >
                Percentage
                {sortColumn === 'percentage' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredAndSortedDocuments.map((doc) => (
              <Tr
                key={doc.documentId}
                bg={doc.requiresAcknowledgement && doc.percentage < 80 ? 'orange.50' : undefined}
                _hover={{ bg: 'gray.50' }}
              >
                <Td fontWeight="medium">{doc.documentTitle}</Td>
                <Td>{doc.documentVersion}</Td>
                <Td>
                  {doc.lastChangedDate
                    ? new Date(doc.lastChangedDate).toLocaleDateString()
                    : 'N/A'}
                </Td>
                <Td>
                  {doc.requiresAcknowledgement ? (
                    <Badge colorScheme="blue">Yes</Badge>
                  ) : (
                    <Badge colorScheme="gray">No</Badge>
                  )}
                </Td>
                <Td color="green.600" fontWeight="medium">
                  {doc.acknowledgedCount}
                </Td>
                <Td color="red.600" fontWeight="medium">
                  {doc.notAcknowledgedCount}
                </Td>
                <Td>
                  <Badge
                    colorScheme={
                      doc.percentage >= 80
                        ? 'green'
                        : doc.percentage >= 50
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {doc.percentage.toFixed(1)}%
                  </Badge>
                </Td>
                <Td>
                  {doc.requiresAcknowledgement && (
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={() => handleDocumentClick(doc.documentId)}
                    >
                      View Details
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {/* Document Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }}>
        <ModalOverlay />
        <ModalContent maxH="80vh" overflowY="auto">
          <ModalHeader>
            {documentDetails?.document.documentTitle} - User Details
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {documentDetails && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="medium">Total Users: {documentDetails.document.totalUsers}</Text>
                  <Text>
                    Acknowledged: {documentDetails.document.acknowledgedCount} | Not
                    Acknowledged: {documentDetails.document.notAcknowledgedCount}
                  </Text>
                  <Text>
                    Percentage: {documentDetails.document.percentage.toFixed(1)}%
                  </Text>
                </Box>

                <Tabs>
                  <TabList>
                    <Tab>
                      Acknowledged ({documentDetails.acknowledgedUsers.length})
                    </Tab>
                    <Tab>
                      Not Acknowledged ({documentDetails.notAcknowledgedUsers.length})
                    </Tab>
                  </TabList>

                  <TabPanels>
                    <TabPanel>
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Name</Th>
                            <Th>Email</Th>
                            <Th>Acknowledged</Th>
                            <Th>Days Since Required</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {documentDetails.acknowledgedUsers.map((user) => (
                            <Tr key={user.entraObjectId}>
                              <Td>{user.displayName}</Td>
                              <Td>{user.email}</Td>
                              <Td>
                                {user.acknowledgedAt
                                  ? new Date(user.acknowledgedAt).toLocaleDateString()
                                  : 'N/A'}
                              </Td>
                              <Td>{user.daysSinceRequired}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TabPanel>
                    <TabPanel>
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Name</Th>
                            <Th>Email</Th>
                            <Th>Days Since Required</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {documentDetails.notAcknowledgedUsers.map((user) => (
                            <Tr
                              key={user.entraObjectId}
                              bg={user.daysSinceRequired > 30 ? 'red.50' : undefined}
                            >
                              <Td>{user.displayName}</Td>
                              <Td>{user.email}</Td>
                              <Td color={user.daysSinceRequired > 30 ? 'red.600' : undefined}>
                                {user.daysSinceRequired}
                                {user.daysSinceRequired > 30 && ' (Overdue)'}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

