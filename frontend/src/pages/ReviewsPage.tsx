import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  useDisclosure,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
} from '@chakra-ui/react';
import api from '../services/api';
import { ReviewFormModal } from '../components/ReviewFormModal';

interface ReviewTask {
  id: string;
  documentId: string;
  reviewerUserId: string;
  dueDate: string;
  completedDate: string | null;
  changeNotes: string | null;
  status: string;
  document: {
    id: string;
    title: string;
    version: string;
    type: string;
  };
  reviewer: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface Document {
  id: string;
  title: string;
  version: string;
  type: string;
  nextReviewDate: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface DashboardData {
  upcomingReviews: ReviewTask[];
  overdueReviews: ReviewTask[];
  recentlyCompletedReviews: ReviewTask[];
  documentsNeedingReview: Document[];
}

export function ReviewsPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/reviews/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching review dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReview = (doc: Document) => {
    setSelectedDocument(doc);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setSelectedDocument(null);
    fetchDashboard();
  };

  const statusColors: Record<string, string> = {
    PENDING: 'yellow',
    COMPLETED: 'green',
    OVERDUE: 'red',
  };

  if (loading) {
    return (
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Review Dashboard</Heading>
        <Box p={8} textAlign="center">
          Loading...
        </Box>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">Review Dashboard</Heading>

      <Tabs>
        <TabList>
          <Tab>Upcoming Reviews</Tab>
          <Tab>Overdue Reviews</Tab>
          <Tab>Recently Completed</Tab>
          <Tab>Documents Needing Review</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Document</Th>
                    <Th>Reviewer</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData?.upcomingReviews.map((review) => (
                    <Tr key={review.id}>
                      <Td>
                        <Text fontWeight="medium">{review.document.title}</Text>
                        <Text fontSize="sm" color="gray.600">
                          v{review.document.version}
                        </Text>
                      </Td>
                      <Td>{review.reviewer.displayName}</Td>
                      <Td>
                        {new Date(review.dueDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </Td>
                      <Td>
                        <Badge colorScheme={statusColors[review.status] || 'gray'}>
                          {review.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                  {dashboardData?.upcomingReviews.length === 0 && (
                    <Tr>
                      <Td colSpan={4} textAlign="center">
                        No upcoming reviews
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Document</Th>
                    <Th>Reviewer</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData?.overdueReviews.map((review) => (
                    <Tr key={review.id}>
                      <Td>
                        <Text fontWeight="medium">{review.document.title}</Text>
                        <Text fontSize="sm" color="gray.600">
                          v{review.document.version}
                        </Text>
                      </Td>
                      <Td>{review.reviewer.displayName}</Td>
                      <Td>
                        {new Date(review.dueDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </Td>
                      <Td>
                        <Badge colorScheme={statusColors[review.status] || 'gray'}>
                          {review.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                  {dashboardData?.overdueReviews.length === 0 && (
                    <Tr>
                      <Td colSpan={4} textAlign="center">
                        No overdue reviews
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Document</Th>
                    <Th>Reviewer</Th>
                    <Th>Completed Date</Th>
                    <Th>Change Notes</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData?.recentlyCompletedReviews.map((review) => (
                    <Tr key={review.id}>
                      <Td>
                        <Text fontWeight="medium">{review.document.title}</Text>
                        <Text fontSize="sm" color="gray.600">
                          v{review.document.version}
                        </Text>
                      </Td>
                      <Td>{review.reviewer.displayName}</Td>
                      <Td>
                        {review.completedDate
                          ? new Date(review.completedDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </Td>
                      <Td>{review.changeNotes || 'N/A'}</Td>
                    </Tr>
                  ))}
                  {dashboardData?.recentlyCompletedReviews.length === 0 && (
                    <Tr>
                      <Td colSpan={4} textAlign="center">
                        No recently completed reviews
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Document</Th>
                    <Th>Owner</Th>
                    <Th>Next Review Date</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData?.documentsNeedingReview.map((doc) => (
                    <Tr key={doc.id}>
                      <Td>
                        <Text fontWeight="medium">{doc.title}</Text>
                        <Text fontSize="sm" color="gray.600">
                          v{doc.version}
                        </Text>
                      </Td>
                      <Td>{doc.owner.displayName}</Td>
                      <Td>
                        {doc.nextReviewDate
                          ? new Date(doc.nextReviewDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </Td>
                      <Td>
                        <Button
                          size="sm"
                          colorScheme="blue"
                          onClick={() => handleCreateReview(doc)}
                        >
                          Schedule Review
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                  {dashboardData?.documentsNeedingReview.length === 0 && (
                    <Tr>
                      <Td colSpan={4} textAlign="center">
                        No documents needing review
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ReviewFormModal
        isOpen={isOpen}
        onClose={handleClose}
        document={selectedDocument}
      />
    </VStack>
  );
}

