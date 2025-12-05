import React, { useState, useEffect } from 'react';
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
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  useToast,
  Tooltip,
  Link,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Checkbox,
} from '@chakra-ui/react';
import { ChevronDownIcon, WarningIcon, TimeIcon, CheckCircleIcon, InfoIcon } from '@chakra-ui/icons';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ReviewFormModal } from '../components/ReviewFormModal';
import { DocumentFormModal } from '../components/DocumentFormModal';
import { useAuth } from '../contexts/AuthContext';

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

interface OverdueItem {
  type: 'REVIEW_TASK' | 'DOCUMENT';
  id: string;
  documentId: string;
  document: {
    id: string;
    title: string;
    version: string;
    type: string;
    nextReviewDate?: string | null;
    owner?: {
      id: string;
      displayName: string;
      email: string;
    };
  };
  dueDate: string;
  reviewDate: string;
  reviewer: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  status: string | null;
  hasAssignedTask: boolean;
  daysOverdue: number;
}

interface DashboardData {
  upcomingReviews: ReviewTask[];
  overdueReviews: ReviewTask[];
  recentlyCompletedReviews: ReviewTask[];
  documentsNeedingReview: Document[];
  overdueDocuments?: Document[];
  upcomingDocuments?: Document[];
  needsReviewDate?: Document[];
  overdueItems?: OverdueItem[];
}

export function ReviewsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isCompleteOpen, onOpen: onCompleteOpen, onClose: onCompleteClose } = useDisclosure();
  const { isOpen: isDocumentOpen, onOpen: onDocumentOpen, onClose: onDocumentClose } = useDisclosure();
  const { isOpen: isDocumentEditOpen, onOpen: onDocumentEditOpen, onClose: onDocumentEditClose } = useDisclosure();
  const { isOpen: isBulkReviewOpen, onOpen: onBulkReviewOpen, onClose: onBulkReviewClose } = useDisclosure();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewTask | null>(null);
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<any>(null);
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState<any>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [bulkReviewDate, setBulkReviewDate] = useState<string>('');
  const [bulkSettingReviewDate, setBulkSettingReviewDate] = useState(false);
  const toast = useToast();
  
  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Initialize tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'overdue') {
      setTabIndex(1); // Overdue Reviews tab
      // Remove the param from URL after reading it
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('tab');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, []); // Only run on mount

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

  const handleClose = (success: boolean = false) => {
    onClose();
    setSelectedDocument(null);
    if (success) {
      toast({
        title: 'Success',
        description: 'Review scheduled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    }
    fetchDashboard();
  };

  const handleCompleteReview = (review: ReviewTask) => {
    setSelectedReview(review);
    onCompleteOpen();
  };

  const handleCompleteReviewSubmit = async (changeNotes: string) => {
    if (!selectedReview) return;
    
    try {
      await api.put(`/api/reviews/${selectedReview.id}/complete`, {
        changeNotes,
      });
      toast({
        title: 'Success',
        description: 'Review marked as completed',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      onCompleteClose();
      setSelectedReview(null);
      fetchDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to complete review',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await api.get(`/api/documents/${documentId}`);
      setSelectedDocumentForView(response.data);
      onDocumentOpen();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load document',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleEditDocument = async (documentId: string) => {
    try {
      const response = await api.get(`/api/documents/${documentId}`);
      setSelectedDocumentForEdit(response.data);
      onDocumentEditOpen();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load document for editing',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const handleNavigateToTab = (index: number) => {
    setTabIndex(index);
  };

  const handleToggleDocumentSelection = (documentId: string) => {
    const newSelection = new Set(selectedDocumentIds);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else {
      newSelection.add(documentId);
    }
    setSelectedDocumentIds(newSelection);
  };

  const handleSelectAllDocuments = () => {
    if (dashboardData?.needsReviewDate) {
      if (selectedDocumentIds.size === dashboardData.needsReviewDate.length) {
        setSelectedDocumentIds(new Set());
      } else {
        setSelectedDocumentIds(new Set(dashboardData.needsReviewDate.map(doc => doc.id)));
      }
    }
  };

  const handleBulkSetReviewDate = async () => {
    if (selectedDocumentIds.size === 0) {
      toast({
        title: 'No documents selected',
        description: 'Please select at least one document',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      return;
    }

    setBulkSettingReviewDate(true);
    try {
      await api.post('/api/reviews/bulk-set-review-date', {
        documentIds: Array.from(selectedDocumentIds),
        reviewDate: bulkReviewDate || undefined,
      });
      toast({
        title: 'Success',
        description: `Review date set for ${selectedDocumentIds.size} document(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      setSelectedDocumentIds(new Set());
      setBulkReviewDate('');
      onBulkReviewClose();
      fetchDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to set review dates',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setBulkSettingReviewDate(false);
    }
  };

  const handleQuickSetReviewDate = async (documentId: string) => {
    try {
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      
      await api.post('/api/reviews/bulk-set-review-date', {
        documentIds: [documentId],
        reviewDate: nextYear.toISOString().split('T')[0],
      });
      toast({
        title: 'Success',
        description: 'Review date set to 1 year from today',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      fetchDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to set review date',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'yellow',
    COMPLETED: 'green',
    OVERDUE: 'red',
  };

  const getStatusLabel = (status: string, dueDate?: string): string => {
    switch (status) {
      case 'PENDING':
        return 'AWAITING REVIEW';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'OVERDUE':
        return 'OVERDUE';
      default:
        return status;
    }
  };

  const getStatusTooltip = (status: string, dueDate?: string): string => {
    if (status === 'PENDING' && dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil > 0) {
        return `Review scheduled, due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
      }
      return `Review scheduled, due ${new Date(dueDate).toLocaleDateString('en-GB')}`;
    }
    return status;
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

  const calculateDaysOverdue = (nextReviewDate: string | null): number => {
    if (!nextReviewDate) return 0;
    const reviewDate = new Date(nextReviewDate);
    const now = new Date();
    const diffTime = now.getTime() - reviewDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <VStack spacing={6} align="stretch">
      <Heading size="lg">Review Dashboard</Heading>

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Tooltip label="Click to view all overdue reviews" placement="top">
          <Stat 
            p={4} 
            bg={dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? 'red.50' : 'white'}
            borderLeft={dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? '4px solid' : 'none'}
            borderColor="red.500"
            borderRadius="md" 
            boxShadow="sm"
            cursor="pointer"
            _hover={{ bg: dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? 'red.100' : 'gray.50', transform: 'translateY(-2px)', boxShadow: 'md' }}
            transition="all 0.2s"
            onClick={() => handleNavigateToTab(1)}
          >
            <HStack spacing={2} mb={2}>
              <WarningIcon color={dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? 'red.500' : 'gray.400'} />
              <StatLabel color={dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? 'red.700' : 'gray.600'}>
                Overdue Reviews
              </StatLabel>
            </HStack>
            <StatNumber color={dashboardData?.overdueItems && dashboardData.overdueItems.length > 0 ? 'red.600' : 'gray.500'}>
              {dashboardData?.overdueItems?.length || 
               ((dashboardData?.overdueReviews?.length || 0) + (dashboardData?.overdueDocuments?.length || 0)) || 0}
            </StatNumber>
          </Stat>
        </Tooltip>
        <Tooltip label="Scheduled reviews + documents with upcoming review dates in next 30 days. Click to view scheduled reviews." placement="top">
          <Stat 
            p={4} 
            bg={((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? 'yellow.50' : 'white'}
            borderLeft={((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? '4px solid' : 'none'}
            borderColor="yellow.500"
            borderRadius="md" 
            boxShadow="sm"
            cursor="pointer"
            _hover={{ bg: ((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? 'yellow.100' : 'gray.50', transform: 'translateY(-2px)', boxShadow: 'md' }}
            transition="all 0.2s"
            onClick={() => handleNavigateToTab(0)}
          >
            <HStack spacing={2} mb={2}>
              <TimeIcon color={((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? 'yellow.600' : 'gray.400'} />
              <StatLabel color={((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? 'yellow.700' : 'gray.600'}>
                Upcoming Reviews (30 days)
              </StatLabel>
            </HStack>
            <StatNumber color={((dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)) > 0 ? 'yellow.600' : 'gray.500'}>
              {(dashboardData?.upcomingReviews?.length || 0) + (dashboardData?.upcomingDocuments?.length || 0)}
            </StatNumber>
          </Stat>
        </Tooltip>
        <Tooltip label="Click to view documents needing review" placement="top">
          <Stat 
            p={4} 
            bg={dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? 'orange.50' : 'white'}
            borderLeft={dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? '4px solid' : 'none'}
            borderColor="orange.500"
            borderRadius="md" 
            boxShadow="sm"
            cursor="pointer"
            _hover={{ bg: dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? 'orange.100' : 'gray.50', transform: 'translateY(-2px)', boxShadow: 'md' }}
            transition="all 0.2s"
            onClick={() => handleNavigateToTab(3)}
          >
            <HStack spacing={2} mb={2}>
              <InfoIcon color={dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? 'orange.500' : 'gray.400'} />
              <StatLabel color={dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? 'orange.700' : 'gray.600'}>
                Missing Review Date
              </StatLabel>
            </HStack>
            <StatNumber color={dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 ? 'orange.600' : 'gray.500'}>
              {dashboardData?.needsReviewDate?.length || 0}
            </StatNumber>
          </Stat>
        </Tooltip>
      </SimpleGrid>

      <Tabs index={tabIndex} onChange={setTabIndex} variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab
            _selected={{ 
              color: 'blue.600', 
              bg: 'blue.50',
              fontWeight: 'semibold',
              borderBottom: '3px solid',
              borderColor: 'blue.500'
            }}
          >
            Upcoming Reviews
          </Tab>
          <Tab
            _selected={{ 
              color: 'red.600', 
              bg: 'red.50',
              fontWeight: 'semibold',
              borderBottom: '3px solid',
              borderColor: 'red.500'
            }}
          >
            Overdue Reviews
          </Tab>
          <Tab
            _selected={{ 
              color: 'green.600', 
              bg: 'green.50',
              fontWeight: 'semibold',
              borderBottom: '3px solid',
              borderColor: 'green.500'
            }}
          >
            Recently Completed
          </Tab>
          <Tab
            _selected={{ 
              color: 'orange.600', 
              bg: 'orange.50',
              fontWeight: 'semibold',
              borderBottom: '3px solid',
              borderColor: 'orange.500'
            }}
          >
            Documents Needing Review
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <VStack spacing={4} align="stretch">
                {/* Scheduled Review Tasks */}
                {dashboardData?.upcomingReviews && dashboardData.upcomingReviews.length > 0 && (
                  <Box>
                    <Heading size="sm" mb={2}>Scheduled Review Tasks</Heading>
                    <Table variant="simple" colorScheme="gray">
                      <Thead>
                        <Tr>
                          <Th>Document</Th>
                          <Th>Reviewer</Th>
                          <Th>Due Date</Th>
                          <Th>Status</Th>
                          {canEdit && <Th>Actions</Th>}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboardData.upcomingReviews.map((review, index) => (
                          <Tr key={review.id} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                            <Td>
                              <Link
                                color="blue.500"
                                fontWeight="medium"
                                onClick={() => handleViewDocument(review.document.id)}
                                _hover={{ textDecoration: 'underline' }}
                                cursor="pointer"
                              >
                                {review.document.title}
                              </Link>
                              <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                                v{review.document.version}
                              </Badge>
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
                              <Tooltip label={getStatusTooltip(review.status, review.dueDate)}>
                                <Badge colorScheme={statusColors[review.status] || 'gray'}>
                                  {getStatusLabel(review.status, review.dueDate)}
                                </Badge>
                              </Tooltip>
                            </Td>
                            {canEdit && (
                              <Td>
                                <HStack spacing={2}>
                                  <Button
                                    size="sm"
                                    colorScheme="blue"
                                    onClick={() => handleEditDocument(review.document.id)}
                                  >
                                    Edit Document
                                  </Button>
                                  <Menu>
                                    <MenuButton
                                      as={IconButton}
                                      icon={<ChevronDownIcon />}
                                      size="sm"
                                      variant="outline"
                                    />
                                    <MenuList>
                                      <MenuItem onClick={() => handleCompleteReview(review)}>
                                        Mark Review Complete
                                      </MenuItem>
                                    </MenuList>
                                  </Menu>
                                </HStack>
                              </Td>
                            )}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {/* Documents with Upcoming Review Dates (no task assigned yet) */}
                {dashboardData?.upcomingDocuments && dashboardData.upcomingDocuments.length > 0 && (
                  <Box>
                    <Heading size="sm" mb={2}>Documents with Upcoming Review Dates</Heading>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      These documents have review dates scheduled but no review task assigned yet.
                    </Text>
                    <Table variant="simple" colorScheme="gray">
                      <Thead>
                        <Tr>
                          <Th>Document</Th>
                          <Th>Owner</Th>
                          <Th>Review Date</Th>
                          {canEdit && <Th>Actions</Th>}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboardData.upcomingDocuments.map((doc, index) => (
                          <Tr key={doc.id} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                            <Td>
                              <Link
                                color="blue.500"
                                fontWeight="medium"
                                onClick={() => handleViewDocument(doc.id)}
                                _hover={{ textDecoration: 'underline' }}
                                cursor="pointer"
                              >
                                {doc.title}
                              </Link>
                              <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                                v{doc.version}
                              </Badge>
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
                            {canEdit && (
                              <Td>
                                <Button
                                  size="sm"
                                  colorScheme="blue"
                                  onClick={() => handleEditDocument(doc.id)}
                                >
                                  Edit Document
                                </Button>
                              </Td>
                            )}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {/* Empty state */}
                {(!dashboardData?.upcomingReviews || dashboardData.upcomingReviews.length === 0) &&
                 (!dashboardData?.upcomingDocuments || dashboardData.upcomingDocuments.length === 0) && (
                  <Box textAlign="center" p={8}>
                    <VStack spacing={3}>
                      <TimeIcon boxSize={8} color="gray.400" />
                      <Text color="gray.500" fontSize="md">No upcoming reviews</Text>
                      {canEdit && (
                        <Button
                          size="sm"
                          colorScheme="blue"
                          variant="outline"
                          onClick={() => handleNavigateToTab(3)}
                        >
                          Schedule a Review
                        </Button>
                      )}
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="gray.600">
                  Documents that are overdue for review. Items with assigned reviewers have active review tasks.
                </Text>
                <Table variant="simple" colorScheme="gray">
                  <Thead>
                    <Tr>
                      <Th>Document</Th>
                      <Th>Reviewer/Owner</Th>
                      <Th>Review Date</Th>
                      <Th>Days Overdue</Th>
                      <Th>Status</Th>
                      {canEdit && <Th>Actions</Th>}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {dashboardData?.overdueItems?.map((item, index) => (
                      <Tr key={`${item.type}-${item.id}`} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                        <Td>
                          <Link
                            color="blue.500"
                            fontWeight="medium"
                            onClick={() => handleViewDocument(item.documentId)}
                            _hover={{ textDecoration: 'underline' }}
                            cursor="pointer"
                          >
                            {item.document.title}
                          </Link>
                          <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                            v{item.document.version}
                          </Badge>
                        </Td>
                        <Td>
                          {item.hasAssignedTask && item.reviewer ? (
                            <VStack align="start" spacing={1}>
                              <Text fontWeight="medium">{item.reviewer.displayName}</Text>
                              <Badge colorScheme="blue" fontSize="xs">Task Assigned</Badge>
                            </VStack>
                          ) : (
                            <VStack align="start" spacing={1}>
                              <Text>{item.document.owner?.displayName || 'N/A'}</Text>
                              <Badge colorScheme="orange" fontSize="xs">No Task</Badge>
                            </VStack>
                          )}
                        </Td>
                        <Td>
                          {new Date(item.reviewDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </Td>
                        <Td>
                          <Badge colorScheme="red">{item.daysOverdue} days</Badge>
                        </Td>
                        <Td>
                          {item.hasAssignedTask && item.status ? (
                            <Tooltip label={getStatusTooltip(item.status, item.dueDate)}>
                              <Badge colorScheme={statusColors[item.status] || 'gray'}>
                                {getStatusLabel(item.status, item.dueDate)}
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Badge colorScheme="orange">Needs Task</Badge>
                          )}
                        </Td>
                        {canEdit && (
                          <Td>
                            <HStack spacing={2}>
                              {item.hasAssignedTask && item.type === 'REVIEW_TASK' ? (
                                <>
                                  <Button
                                    size="sm"
                                    colorScheme="blue"
                                    onClick={() => handleEditDocument(item.documentId)}
                                  >
                                    Edit Document
                                  </Button>
                                  <Menu>
                                    <MenuButton
                                      as={IconButton}
                                      icon={<ChevronDownIcon />}
                                      size="sm"
                                      variant="outline"
                                    />
                                    <MenuList>
                                      <MenuItem onClick={async () => {
                                        // Find the review task by ID
                                        const review = dashboardData?.overdueReviews?.find(r => r.id === item.id);
                                        if (review) {
                                          handleCompleteReview(review);
                                        }
                                      }}>
                                        Mark Review Complete
                                      </MenuItem>
                                    </MenuList>
                                  </Menu>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  colorScheme="blue"
                                  onClick={() => {
                                    // Create a document object from the overdue item
                                    const doc: Document = {
                                      id: item.documentId,
                                      title: item.document.title,
                                      version: item.document.version,
                                      type: item.document.type,
                                      nextReviewDate: item.document.nextReviewDate,
                                      owner: item.document.owner || {
                                        id: '',
                                        displayName: 'Unknown',
                                        email: '',
                                      },
                                    };
                                    handleCreateReview(doc);
                                  }}
                                >
                                  Schedule Review
                                </Button>
                              )}
                            </HStack>
                          </Td>
                        )}
                      </Tr>
                    ))}
                    {(!dashboardData?.overdueItems || dashboardData.overdueItems.length === 0) && (
                      <Tr>
                        <Td colSpan={canEdit ? 6 : 5} textAlign="center" py={8}>
                          <VStack spacing={3}>
                            <CheckCircleIcon boxSize={8} color="green.400" />
                            <Text color="gray.500" fontSize="md">No overdue reviews</Text>
                            <Text color="gray.400" fontSize="sm">All documents are up to date with their review schedule</Text>
                          </VStack>
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </VStack>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Table variant="simple" colorScheme="gray">
                <Thead>
                  <Tr>
                    <Th>Document</Th>
                    <Th>Reviewer</Th>
                    <Th>Completed Date</Th>
                    <Th>Change Notes</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dashboardData?.recentlyCompletedReviews.map((review, index) => (
                    <Tr key={review.id} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                      <Td>
                        <Link
                          color="blue.500"
                          fontWeight="medium"
                          onClick={() => handleViewDocument(review.document.id)}
                          _hover={{ textDecoration: 'underline' }}
                          cursor="pointer"
                        >
                          {review.document.title}
                        </Link>
                        <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                          v{review.document.version}
                        </Badge>
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
                      <Td colSpan={4} textAlign="center" py={8}>
                        <VStack spacing={3}>
                          <InfoIcon boxSize={8} color="gray.400" />
                          <Text color="gray.500" fontSize="md">No recently completed reviews</Text>
                          <Text color="gray.400" fontSize="sm">Completed reviews from the last 30 days will appear here</Text>
                        </VStack>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
              <VStack spacing={4} align="stretch">
                {/* Upcoming Documents */}
                {dashboardData?.upcomingDocuments && dashboardData.upcomingDocuments.length > 0 && (
                  <Box>
                    <Heading size="sm" mb={2}>Upcoming Reviews (Next 30 Days)</Heading>
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
                        {dashboardData.upcomingDocuments.map((doc, index) => (
                          <Tr key={doc.id} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                            <Td>
                              <Link
                                color="blue.500"
                                fontWeight="medium"
                                onClick={() => handleViewDocument(doc.id)}
                                _hover={{ textDecoration: 'underline' }}
                                cursor="pointer"
                              >
                                {doc.title}
                              </Link>
                              <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                                v{doc.version}
                              </Badge>
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
                                onClick={() => handleEditDocument(doc.id)}
                              >
                                Edit Document
                              </Button>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {/* Documents Missing Review Date */}
                {dashboardData?.needsReviewDate && dashboardData.needsReviewDate.length > 0 && (
                  <Box>
                    <HStack justify="space-between" mb={4}>
                      <Heading size="sm">Missing Review Date</Heading>
                      {canEdit && (
                        <HStack>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSelectAllDocuments}
                          >
                            {selectedDocumentIds.size === dashboardData.needsReviewDate.length
                              ? 'Deselect All'
                              : 'Select All'}
                          </Button>
                          {selectedDocumentIds.size > 0 && (
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={onBulkReviewOpen}
                            >
                              Set Review Date ({selectedDocumentIds.size})
                            </Button>
                          )}
                        </HStack>
                      )}
                    </HStack>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          {canEdit && <Th width="50px">
                            <Checkbox
                              isChecked={selectedDocumentIds.size === dashboardData.needsReviewDate.length && dashboardData.needsReviewDate.length > 0}
                              isIndeterminate={selectedDocumentIds.size > 0 && selectedDocumentIds.size < dashboardData.needsReviewDate.length}
                              onChange={handleSelectAllDocuments}
                            />
                          </Th>}
                          <Th>Document</Th>
                          <Th>Owner</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboardData.needsReviewDate.map((doc, index) => (
                          <Tr key={doc.id} bg={index % 2 === 0 ? 'white' : 'gray.50'} _hover={{ bg: 'blue.50' }}>
                            {canEdit && (
                              <Td>
                                <Checkbox
                                  isChecked={selectedDocumentIds.has(doc.id)}
                                  onChange={() => handleToggleDocumentSelection(doc.id)}
                                />
                              </Td>
                            )}
                            <Td>
                              <Link
                                color="blue.500"
                                fontWeight="medium"
                                onClick={() => handleViewDocument(doc.id)}
                                _hover={{ textDecoration: 'underline' }}
                                cursor="pointer"
                              >
                                {doc.title}
                              </Link>
                              <Badge ml={2} fontSize="xs" colorScheme="gray" variant="outline">
                                v{doc.version}
                              </Badge>
                            </Td>
                            <Td>{doc.owner.displayName}</Td>
                            <Td>
                              <HStack spacing={2}>
                                <Button
                                  size="sm"
                                  colorScheme="blue"
                                  variant="outline"
                                  onClick={() => handleQuickSetReviewDate(doc.id)}
                                >
                                  Set Review Date
                                </Button>
                                <Button
                                  size="sm"
                                  colorScheme="orange"
                                  onClick={() => handleCreateReview(doc)}
                                >
                                  Schedule Review
                                </Button>
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {(!dashboardData?.upcomingDocuments || dashboardData.upcomingDocuments.length === 0) &&
                 (!dashboardData?.needsReviewDate || dashboardData.needsReviewDate.length === 0) && (
                  <Box textAlign="center" p={8}>
                    <VStack spacing={3}>
                      <CheckCircleIcon boxSize={8} color="green.400" />
                      <Text color="gray.500" fontSize="md">No documents needing review</Text>
                      <Text color="gray.400" fontSize="sm">All documents have review dates scheduled</Text>
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ReviewFormModal
        isOpen={isOpen}
        onClose={handleClose}
        document={selectedDocument}
      />

      <CompleteReviewModal
        isOpen={isCompleteOpen}
        onClose={() => {
          onCompleteClose();
          setSelectedReview(null);
        }}
        review={selectedReview}
        onComplete={handleCompleteReviewSubmit}
      />

      <DocumentFormModal
        isOpen={isDocumentOpen}
        onClose={() => {
          onDocumentClose();
          setSelectedDocumentForView(null);
        }}
        document={selectedDocumentForView}
        readOnly={true}
      />

      <DocumentFormModal
        isOpen={isDocumentEditOpen}
        onClose={() => {
          onDocumentEditClose();
          setSelectedDocumentForEdit(null);
          fetchDashboard(); // Refresh to show updated data
        }}
        document={selectedDocumentForEdit}
        readOnly={false}
        isReviewContext={true}
      />

      {/* Bulk Set Review Date Modal */}
      <Modal isOpen={isBulkReviewOpen} onClose={onBulkReviewClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Set Review Date for Selected Documents</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>
                Set review date for <strong>{selectedDocumentIds.size}</strong> document(s).
                Leave blank to use default (1 year from today).
              </Text>
              <FormControl>
                <FormLabel>Review Date (Optional)</FormLabel>
                <Input
                  type="date"
                  value={bulkReviewDate}
                  onChange={(e) => setBulkReviewDate(e.target.value)}
                  placeholder="Leave blank for default (1 year from today)"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  If not specified, review date will be set to 1 year from today
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onBulkReviewClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleBulkSetReviewDate}
              isLoading={bulkSettingReviewDate}
            >
              Set Review Date
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

// Complete Review Modal Component
interface CompleteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: ReviewTask | null;
  onComplete: (changeNotes: string) => void;
}

function CompleteReviewModal({ isOpen, onClose, review, onComplete }: CompleteReviewModalProps) {
  const [changeNotes, setChangeNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && review) {
      setChangeNotes(review.changeNotes || '');
    } else {
      setChangeNotes('');
    }
  }, [isOpen, review]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      onComplete(changeNotes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Complete Review</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {review && (
                <>
                  <FormControl>
                    <FormLabel>Document</FormLabel>
                    <Input value={review.document.title} isReadOnly />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Reviewer</FormLabel>
                    <Input value={review.reviewer.displayName} isReadOnly />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Due Date</FormLabel>
                    <Input
                      value={new Date(review.dueDate).toLocaleDateString('en-GB')}
                      isReadOnly
                    />
                  </FormControl>
                </>
              )}
              <FormControl>
                <FormLabel>Change Notes</FormLabel>
                <Textarea
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="Describe any changes made or confirm 'No changes required'..."
                  rows={4}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="green" type="submit" isLoading={loading}>
              Mark Complete
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

