/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Badge,
  useDisclosure,
  HStack,
  VStack,
  Text,
  Spinner,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Select,
  Textarea,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { Risk, getDepartmentDisplayName } from '../types/risk';
import { RiskApprovalModal } from './RiskApprovalModal';

export function RiskReviewQueue() {
  const toast = useToast();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [targetRisks, setTargetRisks] = useState<Risk[]>([]);
  const [selectedTargetRiskId, setSelectedTargetRiskId] = useState('');
  const { isOpen: isRejectOpen, onOpen: onRejectOpen, onClose: onRejectClose } = useDisclosure();
  const [rejectionComment, setRejectionComment] = useState('');

  useEffect(() => {
    fetchRisks();
    fetchTargetRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      // Fetch risks with pagination to get all PROPOSED risks (inbox)
      let allRisksData: Risk[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await api.get('/api/risks', {
          params: {
            view: 'inbox',
            page: page,
            limit: 100, // Backend max limit is 100
          },
        });
        
        const risks = response.data.data || [];
        allRisksData = [...allRisksData, ...risks];
        
        // Check if there are more pages
        const totalPages = response.data.pagination?.totalPages || 1;
        hasMore = page < totalPages && risks.length > 0;
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 50) break;
      }
      
      setRisks(allRisksData);
    } catch (error) {
      console.error('Error fetching proposed risks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch proposed risks',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTargetRisks = async () => {
    try {
      // Fetch risks with pagination to get all ACTIVE risks
      let allRisksData: Risk[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await api.get('/api/risks', {
          params: {
            status: 'ACTIVE',
            page: page,
            limit: 100, // Backend max limit is 100
          },
        });
        
        const risks = response.data.data || [];
        allRisksData = [...allRisksData, ...risks];
        
        // Check if there are more pages
        const totalPages = response.data.pagination?.totalPages || 1;
        hasMore = page < totalPages && risks.length > 0;
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 50) break;
      }
      
      setTargetRisks(allRisksData);
    } catch (error) {
      console.error('Error fetching target risks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch target risks',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleApprove = (risk: Risk) => {
    setSelectedRisk(risk);
    setApprovalModalOpen(true);
  };

  const handleReject = (risk: Risk) => {
    setSelectedRisk(risk);
    setRejectionComment('');
    onRejectOpen();
  };

  const handleMerge = (risk: Risk) => {
    setSelectedRisk(risk);
    setSelectedTargetRiskId('');
    setMergeModalOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedRisk) return;

    if (!rejectionComment.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a rejection reason',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await api.patch(`/api/risks/${selectedRisk.id}/status`, {
        status: 'REJECTED',
        rejectionReason: rejectionComment,
      });

      toast({
        title: 'Success',
        description: 'Risk rejected',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onRejectClose();
      setRejectionComment('');
      setSelectedRisk(null);
      fetchRisks();
    } catch (error: any) {
      console.error('Error rejecting risk:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to reject risk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const confirmMerge = async () => {
    if (!selectedRisk || !selectedTargetRiskId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a target risk to merge with',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await api.post(`/api/risks/${selectedRisk.id}/merge`, {
        targetRiskId: selectedTargetRiskId,
      });

      toast({
        title: 'Success',
        description: 'Risk merged successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setMergeModalOpen(false);
      setSelectedRisk(null);
      setSelectedTargetRiskId('');
      fetchRisks();
    } catch (error: any) {
      console.error('Error merging risk:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to merge risk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getRiskLevelColor = (level: 'LOW' | 'MEDIUM' | 'HIGH'): string => {
    switch (level) {
      case 'HIGH':
        return 'red';
      case 'MEDIUM':
        return 'orange';
      case 'LOW':
        return 'green';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <Box p={8}>
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box p={8}>
      <VStack spacing={4} align="stretch">
        <Heading size="lg">Risk Review Inbox</Heading>
        <Text color="gray.600">
          Review and approve or reject proposed risks from department contributors.
        </Text>

        {risks.length === 0 ? (
          <Box p={8} textAlign="center" bg="gray.50" borderRadius="md">
            <Text color="gray.600">No proposed risks pending review.</Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Department</Th>
                  <Th>Submitted By</Th>
                  <Th>Calculated Score</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {risks.map((risk) => (
                  <Tr key={risk.id}>
                    <Td>
                      <Text fontWeight="medium" noOfLines={2}>
                        {risk.title}
                      </Text>
                    </Td>
                    <Td>
                      <Badge>{getDepartmentDisplayName(risk.department as any)}</Badge>
                    </Td>
                    <Td>{risk.owner?.displayName || 'N/A'}</Td>
                    <Td>
                      <Badge colorScheme={getRiskLevelColor(risk.riskLevel)} fontSize="md" px={3} py={1}>
                        {risk.calculatedScore} ({risk.riskLevel})
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          colorScheme="green"
                          onClick={() => handleApprove(risk)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => handleReject(risk)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="blue"
                          variant="outline"
                          onClick={() => handleMerge(risk)}
                        >
                          Merge
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>

      {/* Approval Modal */}
      {selectedRisk && (
        <RiskApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            setSelectedRisk(null);
          }}
          risk={selectedRisk}
          onSuccess={fetchRisks}
        />
      )}

      {/* Reject Modal */}
      <Modal isOpen={isRejectOpen} onClose={onRejectClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject Risk</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Rejection Reason</FormLabel>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                rows={4}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRejectClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={confirmReject}
              isDisabled={!rejectionComment.trim()}
            >
              Reject
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Merge Modal */}
      <Modal isOpen={mergeModalOpen} onClose={() => setMergeModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Merge Risk</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Merge "{selectedRisk?.title}" into an existing ACTIVE risk:
              </Text>
              <FormControl isRequired>
                <FormLabel>Target Risk</FormLabel>
                <Select
                  placeholder="Select target risk..."
                  value={selectedTargetRiskId}
                  onChange={(e) => setSelectedTargetRiskId(e.target.value)}
                >
                  {targetRisks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.title} (Score: {risk.calculatedScore})
                    </option>
                  ))}
                </Select>
              </FormControl>
              <Text fontSize="sm" color="gray.600">
                The current risk will be marked as REJECTED with reason "Merged as duplicate".
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={confirmMerge}
              isDisabled={!selectedTargetRiskId}
            >
              Merge
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

