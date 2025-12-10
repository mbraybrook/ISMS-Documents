/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  CardHeader,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Link,
  Spinner,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { ArrowForwardIcon, CheckCircleIcon } from '@chakra-ui/icons';
import api from '../services/api';

interface StaffDashboardData {
  pendingAcknowledgmentsCount: number;
  recentlyUpdatedDocuments: Array<{
    id: string;
    title: string;
    type: string;
    version: string;
    owner: {
      id: string;
      displayName: string;
      email: string;
    };
    storageLocation: string;
    documentUrl: string | null;
    requiresAcknowledgement: boolean;
    lastChangedDate: string | null;
    isAcknowledged: boolean;
  }>;
  lastUpdated: string;
}

export function StaffHomePage() {
  const [dashboardData, setDashboardData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
    // Refresh dashboard when window gains focus
    const handleFocus = () => {
      fetchDashboard();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/dashboard/staff');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching staff dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Spinner size="xl" />
        <Text>Loading dashboard...</Text>
      </VStack>
    );
  }

  if (!dashboardData) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Text>No data available</Text>
      </VStack>
    );
  }

  const formatDateAgo = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Changed today';
    if (diffDays === 1) return 'Changed 1 day ago';
    return `Changed ${diffDays} days ago`;
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" align="center">
        <Box>
          <Heading size="xl" mb={2}>
            My ISMS
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
          </Text>
        </Box>
        <Button onClick={fetchDashboard} size="sm" variant="outline">
          Refresh
        </Button>
      </HStack>

      {/* Your Required Actions */}
      <Card>
        <CardHeader>
          <Heading size="md">Your Required Actions</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Box>
                <Text fontSize="lg" mb={2}>
                  {dashboardData.pendingAcknowledgmentsCount === 0
                    ? 'You have no documents requiring acknowledgment.'
                    : `${dashboardData.pendingAcknowledgmentsCount} document(s) need your acknowledgment.`}
                </Text>
                {dashboardData.pendingAcknowledgmentsCount === 0 ? (
                  <Alert status="success" borderRadius="md">
                    <AlertIcon />
                    You are up to date.
                  </Alert>
                ) : (
                  <Text color="gray.600" fontSize="sm">
                    Please review and acknowledge updated documents.
                  </Text>
                )}
              </Box>
              {dashboardData.pendingAcknowledgmentsCount > 0 && (
                <Button
                  colorScheme="blue"
                  rightIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/admin/staff/acknowledgments')}
                >
                  Review and Acknowledge
                </Button>
              )}
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Recently Updated Documents */}
      <Card>
        <CardHeader>
          <Heading size="md">Recently Updated Documents</Heading>
        </CardHeader>
        <CardBody>
          {dashboardData.recentlyUpdatedDocuments.length === 0 ? (
            <Text color="gray.600">No recently updated documents.</Text>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Version</Th>
                    <Th>Status</Th>
                    <Th>Changed</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData.recentlyUpdatedDocuments.map((doc) => (
                    <Tr key={doc.id}>
                      <Td>
                        {doc.documentUrl ? (
                          <Link href={doc.documentUrl} isExternal color="blue.500">
                            {doc.title}
                          </Link>
                        ) : (
                          doc.title
                        )}
                      </Td>
                      <Td>{doc.type}</Td>
                      <Td>{doc.version}</Td>
                      <Td>
                        {doc.isAcknowledged ? (
                          <Badge colorScheme="green">
                            <CheckCircleIcon mr={1} />
                            Acknowledged
                          </Badge>
                        ) : doc.requiresAcknowledgement ? (
                          <Badge colorScheme="blue">Pending acknowledgment</Badge>
                        ) : (
                          <Badge colorScheme="gray">No acknowledgment required</Badge>
                        )}
                      </Td>
                      <Td>{formatDateAgo(doc.lastChangedDate)}</Td>
                      <Td>
                        {doc.documentUrl && (
                          <Link href={doc.documentUrl} isExternal color="blue.500">
                            Open
                          </Link>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>

    </VStack>
  );
}

