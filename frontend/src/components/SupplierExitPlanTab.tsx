import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  useToast,
  Alert,
  AlertIcon,
  Text,
  Badge,
  Progress,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Checkbox,
  Divider,
  SimpleGrid,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { supplierApi } from '../services/api';
import {
  SupplierExitPlan,
  ExitPlanStatus,
  ImpactAssessment,
  DataAndIpr,
  ReplacementServiceAnalysis,
  ContractClosure,
  LessonsLearned,
} from '../types/supplier';

interface SupplierExitPlanTabProps {
  supplierId: string;
  canEdit: boolean;
  lifecycleState: string;
}

export function SupplierExitPlanTab({
  supplierId,
  canEdit,
  lifecycleState,
}: SupplierExitPlanTabProps) {
  const toast = useToast();
  const [exitPlan, setExitPlan] = useState<SupplierExitPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    isOpen: isCreateModalOpen,
    onOpen: onCreateModalOpen,
    onClose: onCreateModalClose,
  } = useDisclosure();

  const [formData, setFormData] = useState({
    reason: '',
    startDate: '',
    targetEndDate: '',
  });

  useEffect(() => {
    fetchExitPlan();
  }, [supplierId]);

  const fetchExitPlan = async () => {
    try {
      setLoading(true);
      const plan = await supplierApi.getExitPlan(supplierId);
      setExitPlan(plan); // Will be null if no exit plan exists
    } catch (error: any) {
      console.error('Error fetching exit plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to load exit plan',
        status: 'error',
        duration: 3000,
      });
      setExitPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExitPlan = async () => {
    try {
      setSaving(true);
      const newPlan = await supplierApi.createExitPlan(supplierId, {
        reason: formData.reason || null,
        startDate: formData.startDate || null,
        targetEndDate: formData.targetEndDate || null,
        status: 'PLANNED',
      });
      setExitPlan(newPlan);
      onCreateModalClose();
      setFormData({ reason: '', startDate: '', targetEndDate: '' });
      toast({
        title: 'Success',
        description: 'Exit plan created successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create exit plan',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSection = async (sectionName: string, sectionData: any) => {
    try {
      setSaving(true);
      const updateData: any = {};
      updateData[sectionName] = sectionData;
      const updated = await supplierApi.updateExitPlan(supplierId, updateData);
      setExitPlan(updated);
      toast({
        title: 'Success',
        description: 'Exit plan updated',
        status: 'success',
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update exit plan',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: ExitPlanStatus) => {
    try {
      setSaving(true);
      const updateData: any = { status: newStatus };
      if (newStatus === 'COMPLETED' && !exitPlan?.completedAt) {
        updateData.completedAt = new Date().toISOString();
      }
      const updated = await supplierApi.updateExitPlan(supplierId, updateData);
      setExitPlan(updated);
      toast({
        title: 'Success',
        description: 'Exit plan status updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update exit plan status',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateProgress = (): number => {
    if (!exitPlan) return 0;
    const sections = [
      exitPlan.impactAssessment,
      exitPlan.dataAndIpr,
      exitPlan.replacementServiceAnalysis,
      exitPlan.contractClosure,
      exitPlan.lessonsLearned,
    ];
    const completedSections = sections.filter((s) => s?.completed).length;
    return Math.round((completedSections / sections.length) * 100);
  };

  const getStatusColor = (status: ExitPlanStatus): string => {
    switch (status) {
      case 'PLANNED':
        return 'blue';
      case 'IN_PROGRESS':
        return 'orange';
      case 'COMPLETED':
        return 'green';
      case 'CANCELLED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const renderSection = (
    title: string,
    sectionData: any,
    sectionName: string,
    fields: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'array' }>
  ) => {
    const isCompleted = sectionData?.completed || false;
    const section = sectionData || {};

    return (
      <Box
        borderWidth="1px"
        borderRadius="md"
        p={4}
        bg={isCompleted ? 'green.50' : 'white'}
        borderColor={isCompleted ? 'green.200' : 'gray.200'}
      >
        <HStack justify="space-between" mb={4}>
          <Heading size="sm">{title}</Heading>
          <Checkbox
            isChecked={isCompleted}
            isDisabled={!canEdit}
            onChange={(e) => {
              handleUpdateSection(sectionName, {
                ...section,
                completed: e.target.checked,
              });
            }}
          >
            Completed
          </Checkbox>
        </HStack>

        <VStack spacing={4} align="stretch">
          {fields.map((field) => {
            if (field.type === 'array') {
              const values = section[field.key] || [];
              return (
                <FormControl key={field.key}>
                  <FormLabel>{field.label}</FormLabel>
                  <VStack align="stretch" spacing={2}>
                    {values.map((value: string, index: number) => (
                      <HStack key={index}>
                        <Input
                          value={value}
                          onChange={(e) => {
                            const newValues = [...values];
                            newValues[index] = e.target.value;
                            handleUpdateSection(sectionName, {
                              ...section,
                              [field.key]: newValues,
                            });
                          }}
                          isReadOnly={!canEdit}
                        />
                        {canEdit && (
                          <IconButton
                            aria-label="Remove"
                            icon={<DeleteIcon />}
                            size="sm"
                            onClick={() => {
                              const newValues = values.filter((_: any, i: number) => i !== index);
                              handleUpdateSection(sectionName, {
                                ...section,
                                [field.key]: newValues,
                              });
                            }}
                          />
                        )}
                      </HStack>
                    ))}
                    {canEdit && (
                      <Button
                        size="sm"
                        leftIcon={<AddIcon />}
                        onClick={() => {
                          handleUpdateSection(sectionName, {
                            ...section,
                            [field.key]: [...values, ''],
                          });
                        }}
                      >
                        Add {field.label}
                      </Button>
                    )}
                  </VStack>
                </FormControl>
              );
            }

            if (field.type === 'textarea') {
              return (
                <FormControl key={field.key}>
                  <FormLabel>{field.label}</FormLabel>
                  <Textarea
                    value={section[field.key] || ''}
                    onChange={(e) => {
                      handleUpdateSection(sectionName, {
                        ...section,
                        [field.key]: e.target.value,
                      });
                    }}
                    isReadOnly={!canEdit}
                    rows={4}
                  />
                </FormControl>
              );
            }

            return (
              <FormControl key={field.key}>
                <FormLabel>{field.label}</FormLabel>
                <Input
                  value={section[field.key] || ''}
                  onChange={(e) => {
                    handleUpdateSection(sectionName, {
                      ...section,
                      [field.key]: e.target.value,
                    });
                  }}
                  isReadOnly={!canEdit}
                />
              </FormControl>
            );
          })}
        </VStack>
      </Box>
    );
  };

  if (loading) {
    return (
      <Center py={8}>
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!exitPlan) {
    return (
      <VStack spacing={6} align="stretch">
        {lifecycleState === 'EXIT_IN_PROGRESS' && (
          <Alert status="info">
            <AlertIcon />
            This supplier is in exit process but no exit plan exists. Please create one.
          </Alert>
        )}

        {canEdit && (
          <Alert status="info">
            <AlertIcon />
            Exit plans can be created for business continuity planning without changing the supplier status. 
            The supplier lifecycle state can be updated separately when you're ready to begin the exit process.
          </Alert>
        )}

        <Box textAlign="center" py={8}>
          <Text fontSize="lg" color="gray.600" mb={4}>
            No exit plan exists for this supplier
          </Text>
          {canEdit && (
            <Button colorScheme="blue" onClick={onCreateModalOpen}>
              Create Exit Plan
            </Button>
          )}
        </Box>

        {/* Create Exit Plan Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Create Exit Plan</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Reason for Exit</FormLabel>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Describe the reason for exiting this supplier..."
                    rows={4}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Start Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Target End Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.targetEndDate}
                    onChange={(e) => setFormData({ ...formData, targetEndDate: e.target.value })}
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleCreateExitPlan}
                isLoading={saving}
              >
                Create Exit Plan
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    );
  }

  const progress = calculateProgress();

  return (
    <VStack spacing={6} align="stretch">
      {/* Header with status and progress */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Exit Plan</Heading>
          <Badge colorScheme={getStatusColor(exitPlan.status)} fontSize="md" px={3} py={1}>
            {exitPlan.status.replace(/_/g, ' ')}
          </Badge>
        </HStack>

        {exitPlan.reason && (
          <Box mb={4} p={3} bg="gray.50" borderRadius="md">
            <Text fontWeight="semibold" mb={1}>
              Reason for Exit:
            </Text>
            <Text>{exitPlan.reason}</Text>
          </Box>
        )}

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
          <Box>
            <Text fontSize="sm" color="gray.600">
              Start Date
            </Text>
            <Text fontWeight="bold">
              {exitPlan.startDate
                ? new Date(exitPlan.startDate).toLocaleDateString()
                : 'Not set'}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">
              Target End Date
            </Text>
            <Text fontWeight="bold">
              {exitPlan.targetEndDate
                ? new Date(exitPlan.targetEndDate).toLocaleDateString()
                : 'Not set'}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">
              Completed Date
            </Text>
            <Text fontWeight="bold">
              {exitPlan.completedAt
                ? new Date(exitPlan.completedAt).toLocaleDateString()
                : 'Not completed'}
            </Text>
          </Box>
        </SimpleGrid>

        <Box mb={4}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="semibold">
              Overall Progress
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {progress}%
            </Text>
          </HStack>
          <Progress value={progress} colorScheme="blue" size="lg" borderRadius="md" />
        </Box>

        {canEdit && exitPlan.status !== 'COMPLETED' && exitPlan.status !== 'CANCELLED' && (
          <HStack spacing={2} mb={4}>
            {exitPlan.status === 'PLANNED' && (
              <Button
                size="sm"
                colorScheme="orange"
                onClick={() => handleUpdateStatus('IN_PROGRESS')}
                isLoading={saving}
              >
                Start Exit Process
              </Button>
            )}
            {exitPlan.status === 'IN_PROGRESS' && (
              <Button
                size="sm"
                colorScheme="green"
                onClick={() => handleUpdateStatus('COMPLETED')}
                isLoading={saving}
              >
                Mark as Completed
              </Button>
            )}
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={() => handleUpdateStatus('CANCELLED')}
              isLoading={saving}
            >
              Cancel Exit Plan
            </Button>
          </HStack>
        )}
      </Box>

      <Divider />

      {/* Exit Plan Sections */}
      {renderSection(
        '1. Impact Assessment',
        exitPlan.impactAssessment,
        'impactAssessment',
        [
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'scopeOfServices', label: 'Scope of Services', type: 'textarea' },
          { key: 'dependencies', label: 'Dependencies', type: 'array' },
          { key: 'stakeholders', label: 'Stakeholders', type: 'array' },
        ]
      )}

      {renderSection(
        '2. Data and IPR',
        exitPlan.dataAndIpr,
        'dataAndIpr',
        [
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'dataInventory', label: 'Data Inventory', type: 'textarea' },
          { key: 'exportDetails', label: 'Export Details', type: 'textarea' },
          { key: 'integrityValidation', label: 'Integrity Validation', type: 'textarea' },
          { key: 'iprTransfer', label: 'IPR Transfer', type: 'textarea' },
          { key: 'deletionConfirmation', label: 'Deletion Confirmation', type: 'textarea' },
        ]
      )}

      {renderSection(
        '3. Replacement Service Analysis',
        exitPlan.replacementServiceAnalysis,
        'replacementServiceAnalysis',
        [
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'alternativeProviders', label: 'Alternative Providers', type: 'array' },
          { key: 'securityComplianceChecks', label: 'Security/Compliance Checks', type: 'textarea' },
          { key: 'pocNotes', label: 'Proof of Concept Notes', type: 'textarea' },
          { key: 'tcoAnalysis', label: 'Total Cost of Ownership Analysis', type: 'textarea' },
        ]
      )}

      {renderSection(
        '4. Contract Closure',
        exitPlan.contractClosure,
        'contractClosure',
        [
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'obligationsMet', label: 'Obligations Met', type: 'array' },
          { key: 'handoverDocs', label: 'Handover Documents', type: 'array' },
          { key: 'ticketClosure', label: 'Ticket Closure References', type: 'array' },
          { key: 'serviceCessationEvidence', label: 'Service Cessation Evidence', type: 'array' },
        ]
      )}

      {renderSection(
        '5. Lessons Learned',
        exitPlan.lessonsLearned,
        'lessonsLearned',
        [
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'findings', label: 'Key Findings', type: 'array' },
        ]
      )}
    </VStack>
  );
}

