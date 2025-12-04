import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Textarea,
  FormControl,
  FormLabel,
  useToast,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from '@chakra-ui/react';
import { useState } from 'react';
import { supplierApi } from '../services/api';
import { SupplierRiskAssessment, SupplierCriticalityAssessment, Supplier, getAssessmentStatusDisplayName } from '../types/supplier';
import { useAuth } from '../contexts/AuthContext';

interface SupplierApprovalPanelProps {
  supplier: Supplier;
  riskAssessments: SupplierRiskAssessment[];
  criticalityAssessments: SupplierCriticalityAssessment[];
  onApprovalComplete: () => void;
}

export function SupplierApprovalPanel({
  supplier,
  riskAssessments,
  criticalityAssessments,
  onApprovalComplete,
}: SupplierApprovalPanelProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingType, setRejectingType] = useState<'RISK' | 'CRITICALITY' | null>(null);

  const pendingRiskAssessments = riskAssessments.filter((a) => a.status === 'SUBMITTED');
  const pendingCriticalityAssessments = criticalityAssessments.filter((a) => a.status === 'SUBMITTED');

  const canApprove = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  const handleApprove = async (assessmentId: string, type: 'RISK' | 'CRITICALITY') => {
    try {
      setApprovingId(assessmentId);
      if (type === 'RISK') {
        await supplierApi.approveRiskAssessment(supplier.id, assessmentId);
      } else {
        await supplierApi.approveCriticalityAssessment(supplier.id, assessmentId);
      }
      toast({
        title: 'Assessment approved',
        status: 'success',
        duration: 3000,
      });
      onApprovalComplete();
    } catch (error: any) {
      toast({
        title: 'Failed to approve assessment',
        description: error.response?.data?.error || 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (assessmentId: string, type: 'RISK' | 'CRITICALITY') => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Rejection reason required',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      setRejectingId(assessmentId);
      if (type === 'RISK') {
        await supplierApi.rejectRiskAssessment(supplier.id, assessmentId, rejectionReason);
      } else {
        await supplierApi.rejectCriticalityAssessment(supplier.id, assessmentId, rejectionReason);
      }
      toast({
        title: 'Assessment rejected',
        status: 'success',
        duration: 3000,
      });
      setRejectionReason('');
      setRejectingId(null);
      setRejectingType(null);
      onApprovalComplete();
    } catch (error: any) {
      toast({
        title: 'Failed to reject assessment',
        description: error.response?.data?.error || 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setRejectingId(null);
    }
  };

  const getApprovalRequirements = () => {
    const requirements: string[] = [];
    
    if (supplier.supplierType === 'CONNECTED_ENTITY') {
      requirements.push('CISO approval required (Connected Entity)');
    }
    if (supplier.supplierType === 'PCI_SERVICE_PROVIDER') {
      requirements.push('CISO approval required (PCI Service Provider)');
    }
    if (supplier.criticality === 'HIGH') {
      requirements.push('CISO approval required (High Criticality)');
    }
    if (requirements.length === 0) {
      requirements.push('Editor or Admin approval required');
    }
    
    return requirements;
  };

  if (pendingRiskAssessments.length === 0 && pendingCriticalityAssessments.length === 0) {
    return null;
  }

  const requirements = getApprovalRequirements();
  const needsCiso = requirements.some((r) => r.includes('CISO'));

  return (
    <Card>
      <CardHeader>
        <Text fontSize="lg" fontWeight="bold">
          Pending Approvals
        </Text>
        {needsCiso && user?.role !== 'ADMIN' && (
          <Alert status="warning" mt={2} size="sm">
            <AlertIcon />
            CISO approval required. Only ADMIN users can approve these assessments.
          </Alert>
        )}
        {requirements.length > 0 && (
          <Box mt={2}>
            <Text fontSize="sm" fontWeight="bold" mb={1}>
              Approval Requirements:
            </Text>
            <VStack align="stretch" spacing={1}>
              {requirements.map((req, idx) => (
                <Text key={idx} fontSize="xs" color="gray.600">
                  • {req}
                </Text>
              ))}
            </VStack>
          </Box>
        )}
      </CardHeader>
      <CardBody>
        <VStack spacing={4} align="stretch">
          {pendingRiskAssessments.map((assessment) => (
            <Box key={assessment.id} p={4} borderWidth="1px" borderRadius="md">
              <HStack justify="space-between" mb={2}>
                <Badge colorScheme="blue">Risk Assessment</Badge>
                <Badge variant="outline">{getAssessmentStatusDisplayName(assessment.status)}</Badge>
              </HStack>
              <VStack align="stretch" spacing={2} mb={3}>
                <Text fontSize="sm">
                  <strong>CIA Impact:</strong> {assessment.ciaImpact}
                </Text>
                <Text fontSize="sm">
                  <strong>Risk Rating:</strong> {assessment.riskRating}
                </Text>
                {assessment.rationale && (
                  <Text fontSize="sm" color="gray.600">
                    {assessment.rationale}
                  </Text>
                )}
                <Text fontSize="xs" color="gray.500">
                  Assessed by {assessment.assessedBy.displayName} on{' '}
                  {new Date(assessment.assessedAt).toLocaleString()}
                </Text>
              </VStack>
              {canApprove && (
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={() => handleApprove(assessment.id, 'RISK')}
                    isLoading={approvingId === assessment.id}
                    isDisabled={needsCiso && user?.role !== 'ADMIN'}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(assessment.id);
                      setRejectingType('RISK');
                    }}
                    isDisabled={rejectingId !== null}
                  >
                    Reject
                  </Button>
                </HStack>
              )}
              {rejectingId === assessment.id && rejectingType === 'RISK' && (
                <Box mt={3}>
                  <FormControl>
                    <FormLabel fontSize="sm">Rejection Reason</FormLabel>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      size="sm"
                    />
                  </FormControl>
                  <HStack mt={2}>
                    <Button
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleReject(assessment.id, 'RISK')}
                      isLoading={rejectingId === assessment.id}
                    >
                      Confirm Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectingType(null);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </HStack>
                </Box>
              )}
            </Box>
          ))}

          {pendingCriticalityAssessments.map((assessment) => (
            <Box key={assessment.id} p={4} borderWidth="1px" borderRadius="md">
              <HStack justify="space-between" mb={2}>
                <Badge colorScheme="purple">Criticality Assessment</Badge>
                <Badge variant="outline">{getAssessmentStatusDisplayName(assessment.status)}</Badge>
              </HStack>
              <VStack align="stretch" spacing={2} mb={3}>
                <Text fontSize="sm">
                  <strong>Criticality:</strong> {assessment.criticality}
                </Text>
                {assessment.rationale && (
                  <Text fontSize="sm" color="gray.600">
                    {assessment.rationale}
                  </Text>
                )}
                {assessment.supportingEvidenceLinks && assessment.supportingEvidenceLinks.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={1}>
                      Evidence Links:
                    </Text>
                    {assessment.supportingEvidenceLinks.map((link, idx) => (
                      <Text key={idx} fontSize="xs" color="blue.500" as="a" href={link} target="_blank" rel="noopener noreferrer">
                        {link}
                      </Text>
                    ))}
                  </Box>
                )}
                <Text fontSize="xs" color="gray.500">
                  Assessed by {assessment.assessedBy.displayName} on{' '}
                  {new Date(assessment.assessedAt).toLocaleString()}
                </Text>
              </VStack>
              {canApprove && (
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={() => handleApprove(assessment.id, 'CRITICALITY')}
                    isLoading={approvingId === assessment.id}
                    isDisabled={needsCiso && user?.role !== 'ADMIN'}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(assessment.id);
                      setRejectingType('CRITICALITY');
                    }}
                    isDisabled={rejectingId !== null}
                  >
                    Reject
                  </Button>
                </HStack>
              )}
              {rejectingId === assessment.id && rejectingType === 'CRITICALITY' && (
                <Box mt={3}>
                  <FormControl>
                    <FormLabel fontSize="sm">Rejection Reason</FormLabel>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      size="sm"
                    />
                  </FormControl>
                  <HStack mt={2}>
                    <Button
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleReject(assessment.id, 'CRITICALITY')}
                      isLoading={rejectingId === assessment.id}
                    >
                      Confirm Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectingType(null);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </HStack>
                </Box>
              )}
            </Box>
          ))}
        </VStack>
      </CardBody>
    </Card>
  );
}


