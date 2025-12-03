import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  Icon,
  Tooltip,
  Button,
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
  useDisclosure,
} from '@chakra-ui/react';
import { CheckCircleIcon, CloseIcon, TimeIcon, EditIcon } from '@chakra-ui/icons';
import { SupplierRiskAssessment, SupplierCriticalityAssessment, getAssessmentStatusDisplayName } from '../types/supplier';
import { supplierApi } from '../services/api';

interface TimelineItem {
  type: 'RISK_ASSESSMENT' | 'CRITICALITY_ASSESSMENT';
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  assessedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  approvedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  approvedAt: string | null;
  data: any;
}

interface SupplierAssessmentTimelineProps {
  timeline: TimelineItem[];
  supplierId: string;
  canEdit: boolean;
  onAssessmentUpdated?: () => void;
}

export function SupplierAssessmentTimeline({ 
  timeline, 
  supplierId, 
  canEdit,
  onAssessmentUpdated 
}: SupplierAssessmentTimelineProps) {
  const toast = useToast();
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const { isOpen: isRejectModalOpen, onOpen: onRejectModalOpen, onClose: onRejectModalClose } = useDisclosure();
  const [selectedAssessment, setSelectedAssessment] = useState<TimelineItem | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'green';
      case 'REJECTED':
        return 'red';
      case 'SUBMITTED':
        return 'blue';
      case 'DRAFT':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return CheckCircleIcon;
      case 'REJECTED':
        return CloseIcon;
      case 'SUBMITTED':
        return TimeIcon;
      case 'DRAFT':
        return EditIcon;
      default:
        return TimeIcon;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleEdit = (item: TimelineItem) => {
    setSelectedAssessment(item);
    if (item.type === 'RISK_ASSESSMENT') {
      setEditFormData({
        ciaImpact: item.data.ciaImpact,
        riskRating: item.data.riskRating,
        rationale: item.data.rationale || '',
      });
    } else {
      setEditFormData({
        criticality: item.data.criticality,
        rationale: item.data.rationale || '',
      });
    }
    onEditModalOpen();
  };

  const handleSubmit = async (item: TimelineItem) => {
    try {
      setSaving(true);
      if (item.type === 'RISK_ASSESSMENT') {
        await supplierApi.submitRiskAssessment(supplierId, item.id);
      } else {
        await supplierApi.submitCriticalityAssessment(supplierId, item.id);
      }
      toast({
        title: 'Success',
        description: 'Assessment submitted for approval',
        status: 'success',
        duration: 3000,
      });
      onAssessmentUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to submit assessment',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (item: TimelineItem) => {
    try {
      setSaving(true);
      if (item.type === 'RISK_ASSESSMENT') {
        await supplierApi.approveRiskAssessment(supplierId, item.id);
      } else {
        await supplierApi.approveCriticalityAssessment(supplierId, item.id);
      }
      toast({
        title: 'Success',
        description: 'Assessment approved',
        status: 'success',
        duration: 3000,
      });
      onAssessmentUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to approve assessment',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (item: TimelineItem) => {
    setSelectedAssessment(item);
    setRejectionReason('');
    onRejectModalOpen();
  };

  const handleRejectConfirm = async () => {
    if (!selectedAssessment || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Rejection reason is required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      setSaving(true);
      if (selectedAssessment.type === 'RISK_ASSESSMENT') {
        await supplierApi.rejectRiskAssessment(supplierId, selectedAssessment.id, rejectionReason);
      } else {
        await supplierApi.rejectCriticalityAssessment(supplierId, selectedAssessment.id, rejectionReason);
      }
      toast({
        title: 'Success',
        description: 'Assessment rejected',
        status: 'success',
        duration: 3000,
      });
      onRejectModalClose();
      onAssessmentUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to reject assessment',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedAssessment) return;

    try {
      setSaving(true);
      if (selectedAssessment.type === 'RISK_ASSESSMENT') {
        await supplierApi.updateRiskAssessment(supplierId, selectedAssessment.id, editFormData);
      } else {
        await supplierApi.updateCriticalityAssessment(supplierId, selectedAssessment.id, editFormData);
      }
      toast({
        title: 'Success',
        description: 'Assessment updated',
        status: 'success',
        duration: 3000,
      });
      onEditModalClose();
      onAssessmentUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update assessment',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (timeline.length === 0) {
    return (
      <Box p={4} textAlign="center" color="gray.500">
        <Text>No assessment history available</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {timeline.map((item, index) => {
        const StatusIcon = getStatusIcon(item.status);
        const isLast = index === timeline.length - 1;

        return (
          <Box key={item.id} position="relative">
            <HStack spacing={4} align="flex-start">
              <Box position="relative">
                <Icon
                  as={StatusIcon}
                  boxSize={6}
                  color={`${getStatusColor(item.status)}.500`}
                />
                {!isLast && (
                  <Box
                    position="absolute"
                    left="50%"
                    top="24px"
                    transform="translateX(-50%)"
                    width="2px"
                    height="40px"
                    bg="gray.200"
                  />
                )}
              </Box>
              <Box flex="1">
                <HStack spacing={2} mb={2}>
                  <Badge colorScheme={getStatusColor(item.status)}>
                    {item.type === 'RISK_ASSESSMENT' ? 'Risk Assessment' : 'Criticality Assessment'}
                  </Badge>
                  <Badge variant="outline" colorScheme={getStatusColor(item.status)}>
                    {getAssessmentStatusDisplayName(item.status as any)}
                  </Badge>
                </HStack>

                {item.type === 'RISK_ASSESSMENT' && (
                  <VStack align="stretch" spacing={1} mb={2}>
                    <Text fontSize="sm">
                      <strong>CIA Impact:</strong> {item.data.ciaImpact}
                    </Text>
                    <Text fontSize="sm">
                      <strong>Risk Rating:</strong> {item.data.riskRating}
                    </Text>
                    {item.data.rationale && (
                      <Text fontSize="sm" color="gray.600">
                        {item.data.rationale}
                      </Text>
                    )}
                  </VStack>
                )}

                {item.type === 'CRITICALITY_ASSESSMENT' && (
                  <VStack align="stretch" spacing={1} mb={2}>
                    <Text fontSize="sm">
                      <strong>Criticality:</strong> {item.data.criticality}
                    </Text>
                    {item.data.rationale && (
                      <Text fontSize="sm" color="gray.600">
                        {item.data.rationale}
                      </Text>
                    )}
                    {item.data.supportingEvidenceLinks && item.data.supportingEvidenceLinks.length > 0 && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={1}>
                          Evidence Links:
                        </Text>
                        {item.data.supportingEvidenceLinks.map((link: string, idx: number) => (
                          <Text key={idx} fontSize="xs" color="blue.500" as="a" href={link} target="_blank" rel="noopener noreferrer">
                            {link}
                          </Text>
                        ))}
                      </Box>
                    )}
                  </VStack>
                )}

                {item.status === 'REJECTED' && item.data.rejectionReason && (
                  <Box p={2} bg="red.50" borderRadius="md" mb={2}>
                    <Text fontSize="sm" color="red.700">
                      <strong>Rejection Reason:</strong> {item.data.rejectionReason}
                    </Text>
                  </Box>
                )}

                <HStack spacing={4} fontSize="xs" color="gray.500">
                  <Text>
                    Assessed by <strong>{item.assessedBy.displayName}</strong> on {formatDate(item.createdAt)}
                  </Text>
                  {item.approvedBy && item.approvedAt && (
                    <Text>
                      Approved by <strong>{item.approvedBy.displayName}</strong> on {formatDate(item.approvedAt)}
                    </Text>
                  )}
                </HStack>

                {/* Action Buttons */}
                {canEdit && (
                  <HStack spacing={2} mt={3}>
                    {item.status === 'DRAFT' && (
                      <>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="green"
                          onClick={() => handleSubmit(item)}
                          isLoading={saving}
                        >
                          Submit for Approval
                        </Button>
                      </>
                    )}
                    {item.status === 'SUBMITTED' && (
                      <>
                        <Button
                          size="xs"
                          colorScheme="green"
                          onClick={() => handleApprove(item)}
                          isLoading={saving}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => handleReject(item)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </HStack>
                )}
              </Box>
            </HStack>
            {!isLast && <Divider mt={4} />}
          </Box>
        );
      })}

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={onEditModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Edit {selectedAssessment?.type === 'RISK_ASSESSMENT' ? 'Risk' : 'Criticality'} Assessment
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {selectedAssessment?.type === 'RISK_ASSESSMENT' && editFormData && (
                <>
                  <FormControl>
                    <FormLabel>CIA Impact</FormLabel>
                    <Select
                      value={editFormData.ciaImpact}
                      onChange={(e) => setEditFormData({ ...editFormData, ciaImpact: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Risk Rating</FormLabel>
                    <Select
                      value={editFormData.riskRating}
                      onChange={(e) => setEditFormData({ ...editFormData, riskRating: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </Select>
                  </FormControl>
                </>
              )}
              {selectedAssessment?.type === 'CRITICALITY_ASSESSMENT' && editFormData && (
                <FormControl>
                  <FormLabel>Criticality</FormLabel>
                  <Select
                    value={editFormData.criticality}
                    onChange={(e) => setEditFormData({ ...editFormData, criticality: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </FormControl>
              )}
              <FormControl>
                <FormLabel>Rationale</FormLabel>
                <Textarea
                  value={editFormData?.rationale || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, rationale: e.target.value })}
                  rows={4}
                  placeholder="Explain the assessment rationale..."
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditModalClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveEdit} isLoading={saving}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={isRejectModalOpen} onClose={onRejectModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject Assessment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Rejection Reason</FormLabel>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Explain why this assessment is being rejected..."
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRejectModalClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleRejectConfirm} isLoading={saving}>
              Reject Assessment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

