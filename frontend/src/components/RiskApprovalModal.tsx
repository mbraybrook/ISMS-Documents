import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Text,
  Badge,
  Box,
  useToast,
  Textarea,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { Risk, getDepartmentDisplayName } from '../types/risk';

interface RiskApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  risk: Risk | null;
  onSuccess?: () => void;
}

export function RiskApprovalModal({ isOpen, onClose, risk, onSuccess }: RiskApprovalModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confidentialityScore, setConfidentialityScore] = useState(1);
  const [integrityScore, setIntegrityScore] = useState(1);
  const [availabilityScore, setAvailabilityScore] = useState(1);
  const [likelihood, setLikelihood] = useState(1);
  const [rejectionComment, setRejectionComment] = useState('');

  useEffect(() => {
    if (risk && isOpen) {
      // Pre-populate from wizardData if available
      if (risk.wizardData) {
        try {
          const wizard = JSON.parse(risk.wizardData);
          const impactLevel = wizard.impact || wizard.impactLevel;
          if (impactLevel) {
            // All CIA scores same value (simplified CIA)
            setConfidentialityScore(impactLevel);
            setIntegrityScore(impactLevel);
            setAvailabilityScore(impactLevel);
          }
          if (wizard.likelihood) {
            setLikelihood(wizard.likelihood);
          }
        } catch (error) {
          console.error('Error parsing wizardData:', error);
          // Fallback to existing risk scores
          setConfidentialityScore(risk.confidentialityScore);
          setIntegrityScore(risk.integrityScore);
          setAvailabilityScore(risk.availabilityScore);
          setLikelihood(risk.likelihood);
        }
      } else {
        // Use existing scores
        setConfidentialityScore(risk.confidentialityScore);
        setIntegrityScore(risk.integrityScore);
        setAvailabilityScore(risk.availabilityScore);
        setLikelihood(risk.likelihood);
      }
    }
  }, [risk, isOpen]);

  const calculateScore = () => {
    return (confidentialityScore + integrityScore + availabilityScore) * likelihood;
  };

  const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (score >= 36) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  };

  const handleApprove = async () => {
    if (!risk) return;

    setLoading(true);

    try {
      const calculatedScore = calculateScore();
      const riskLevel = getRiskLevel(calculatedScore);

      // Update risk with adjusted scores and set status to ACTIVE
      await api.put(`/api/risks/${risk.id}`, {
        confidentialityScore,
        integrityScore,
        availabilityScore,
        likelihood,
        calculatedScore,
        status: 'ACTIVE',
      });

      toast({
        title: 'Success',
        description: 'Risk approved and activated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error approving risk:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to approve risk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!risk) return;

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

    setLoading(true);

    try {
      await api.patch(`/api/risks/${risk.id}/status`, {
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

      onClose();
      setRejectionComment('');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error rejecting risk:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to reject risk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!risk) return null;

  const calculatedScore = calculateScore();
  const riskLevel = getRiskLevel(calculatedScore);
  const levelColor = riskLevel === 'HIGH' ? 'red' : riskLevel === 'MEDIUM' ? 'orange' : 'green';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Review Risk: {risk.title}</ModalHeader>
        <ModalCloseButton isDisabled={loading} />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontSize="sm" color="gray.600" mb={2}>
                <strong>Department:</strong> {getDepartmentDisplayName(risk.department as any)}
              </Text>
              <Text fontSize="sm" color="gray.600" mb={2}>
                <strong>Submitted By:</strong> {risk.owner?.displayName || 'N/A'}
              </Text>
              {risk.wizardData && (
                <Text fontSize="sm" color="gray.600" mb={2}>
                  <strong>Source:</strong> Risk Wizard
                </Text>
              )}
            </Box>

            <Text fontWeight="semibold">Adjust Risk Scores</Text>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Confidentiality (C)</FormLabel>
                <NumberInput
                  value={confidentialityScore}
                  onChange={(_, value) => setConfidentialityScore(isNaN(value) ? 1 : value)}
                  min={1}
                  max={5}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Integrity (I)</FormLabel>
                <NumberInput
                  value={integrityScore}
                  onChange={(_, value) => setIntegrityScore(isNaN(value) ? 1 : value)}
                  min={1}
                  max={5}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Availability (A)</FormLabel>
                <NumberInput
                  value={availabilityScore}
                  onChange={(_, value) => setAvailabilityScore(isNaN(value) ? 1 : value)}
                  min={1}
                  max={5}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Likelihood (L)</FormLabel>
                <NumberInput
                  value={likelihood}
                  onChange={(_, value) => setLikelihood(isNaN(value) ? 1 : value)}
                  min={1}
                  max={5}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            </HStack>

            <Box p={4} bg="blue.50" borderRadius="md">
              <HStack spacing={4}>
                <Text>
                  <strong>Calculated Score:</strong>
                </Text>
                <Badge colorScheme={levelColor} fontSize="lg" px={3} py={1}>
                  {calculatedScore} ({riskLevel})
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  (C + I + A) × L = ({confidentialityScore} + {integrityScore} + {availabilityScore}) × {likelihood}
                </Text>
              </HStack>
            </Box>

            <FormControl>
              <FormLabel>Rejection Reason (if rejecting)</FormLabel>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                rows={3}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={loading}>
            Cancel
          </Button>
          <Button
            colorScheme="red"
            onClick={handleReject}
            isLoading={loading}
            isDisabled={!rejectionComment.trim()}
            mr={2}
          >
            Reject
          </Button>
          <Button colorScheme="green" onClick={handleApprove} isLoading={loading}>
            Approve & Activate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

