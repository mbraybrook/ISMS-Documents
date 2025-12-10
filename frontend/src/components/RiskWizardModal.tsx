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
  Textarea,
  VStack,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Box,
  Progress,
  Badge,
  useToast,
  HStack,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getDepartmentDisplayName } from '../types/risk';

interface RiskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface WizardData {
  threat: string;
  vulnerability: string;
  riskDescription: string;
  impact: number;
  likelihood: number;
}

const IMPACT_OPTIONS = [
  { value: 1, label: 'Minor glitch, no customer impact', description: 'Maps to Impact: 1' },
  { value: 2, label: 'Internal confusion, minor rework', description: 'Maps to Impact: 2' },
  { value: 3, label: 'Single customer complaint / <£1k cost', description: 'Maps to Impact: 3' },
  { value: 4, label: 'Service outage / Regulatory breach / >£10k cost', description: 'Maps to Impact: 4' },
  { value: 5, label: 'Business closure / Loss of license', description: 'Maps to Impact: 5' },
];

const LIKELIHOOD_OPTIONS = [
  { value: 1, label: 'Almost impossible / Theoretical only', description: 'Maps to Likelihood: 1' },
  { value: 2, label: 'Once in 5-10 years', description: 'Maps to Likelihood: 2' },
  { value: 3, label: 'Once a year', description: 'Maps to Likelihood: 3' },
  { value: 4, label: 'Once a month', description: 'Maps to Likelihood: 4' },
  { value: 5, label: 'Daily / Happening now', description: 'Maps to Likelihood: 5' },
];

export function RiskWizardModal({ isOpen, onClose, onSuccess }: RiskWizardModalProps) {
  const toast = useToast();
  const { getUserDepartment } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    threat: '',
    vulnerability: '',
    riskDescription: '',
    impact: 0,
    likelihood: 0,
  });

  const department = getUserDepartment();

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setCurrentStep(1);
      setWizardData({
        threat: '',
        vulnerability: '',
        riskDescription: '',
        impact: 0,
        likelihood: 0,
      });
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const calculateRiskScore = () => {
    if (wizardData.impact === 0 || wizardData.likelihood === 0) return 0;
    // Impact = C + I + A (all same value for simplified CIA)
    const impactTotal = wizardData.impact * 3; // C + I + A
    return impactTotal * wizardData.likelihood;
  };

  const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (score >= 36) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  };

  const handleSubmit = async (status: 'DRAFT' | 'PROPOSED') => {
    if (!wizardData.threat.trim() || !wizardData.vulnerability.trim() || !wizardData.riskDescription.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (wizardData.impact === 0 || wizardData.likelihood === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please complete all assessment steps',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);

    try {
      const wizardDataJson = JSON.stringify({
        threat: wizardData.threat,
        vulnerability: wizardData.vulnerability,
        riskDescription: wizardData.riskDescription,
        impact: wizardData.impact,
        likelihood: wizardData.likelihood,
      });

      // Calculate CIA scores (all same value for simplified CIA)
      const ciaScore = wizardData.impact;

      const payload = {
        title: wizardData.threat.substring(0, 100) || 'Risk from Wizard',
        description: wizardData.riskDescription,
        threatDescription: wizardData.threat,
        department: department,
        status: status,
        wizardData: wizardDataJson,
        confidentialityScore: ciaScore,
        integrityScore: ciaScore,
        availabilityScore: ciaScore,
        likelihood: wizardData.likelihood,
        // interestedPartyId will be handled by backend (defaults to "Unspecified")
      };

      await api.post('/api/risks', payload);

      toast({
        title: 'Success',
        description: status === 'DRAFT' ? 'Risk saved as draft' : 'Risk proposal submitted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating risk:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create risk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>What could go wrong?</FormLabel>
              <Textarea
                placeholder="Describe the threat or risk scenario..."
                value={wizardData.threat}
                onChange={(e) => setWizardData({ ...wizardData, threat: e.target.value })}
                rows={5}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Why is this possible now?</FormLabel>
              <Textarea
                placeholder="Describe the vulnerability or reason this could occur..."
                value={wizardData.vulnerability}
                onChange={(e) => setWizardData({ ...wizardData, vulnerability: e.target.value })}
                rows={5}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Risk Description</FormLabel>
              <Textarea
                placeholder="Provide a comprehensive description of the risk, including context, potential impacts, and any relevant details..."
                value={wizardData.riskDescription}
                onChange={(e) => setWizardData({ ...wizardData, riskDescription: e.target.value })}
                rows={5}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                This description will be used as the main risk description. Include context about the risk, its potential impacts, and any relevant background information.
              </Text>
            </FormControl>
            <FormControl>
              <FormLabel>Department</FormLabel>
              <Text fontSize="sm" color="gray.600" p={2} bg="gray.50" borderRadius="md">
                {getDepartmentDisplayName(department)}
              </Text>
            </FormControl>
          </VStack>
        );

      case 2:
        return (
          <VStack spacing={4} align="stretch">
            <Text fontSize="lg" fontWeight="semibold">
              What would be the worst-case outcome?
            </Text>
            <RadioGroup
              value={wizardData.impact.toString()}
              onChange={(value) => setWizardData({ ...wizardData, impact: parseInt(value) })}
            >
              <Stack spacing={3}>
                {IMPACT_OPTIONS.map((option) => (
                  <Radio key={option.value} value={option.value.toString()}>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">{option.label}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {option.description}
                      </Text>
                    </VStack>
                  </Radio>
                ))}
              </Stack>
            </RadioGroup>
          </VStack>
        );

      case 3:
        return (
          <VStack spacing={4} align="stretch">
            <Text fontSize="lg" fontWeight="semibold">
              How realistic is this scenario?
            </Text>
            <RadioGroup
              value={wizardData.likelihood.toString()}
              onChange={(value) => setWizardData({ ...wizardData, likelihood: parseInt(value) })}
            >
              <Stack spacing={3}>
                {LIKELIHOOD_OPTIONS.map((option) => (
                  <Radio key={option.value} value={option.value.toString()}>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">{option.label}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {option.description}
                      </Text>
                    </VStack>
                  </Radio>
                ))}
              </Stack>
            </RadioGroup>
          </VStack>
        );

      case 4: {
        const score = calculateRiskScore();
        const level = getRiskLevel(score);
        const levelColor = level === 'HIGH' ? 'red' : level === 'MEDIUM' ? 'orange' : 'green';

        return (
          <VStack spacing={4} align="stretch">
            <Text fontSize="lg" fontWeight="semibold">
              Review & Submit
            </Text>
            <Box p={4} bg="gray.50" borderRadius="md">
              <VStack spacing={2} align="start">
                <Text>
                  <strong>Threat:</strong> {wizardData.threat}
                </Text>
                <Text>
                  <strong>Vulnerability:</strong> {wizardData.vulnerability}
                </Text>
                <Text>
                  <strong>Risk Description:</strong> {wizardData.riskDescription}
                </Text>
                <Text>
                  <strong>Department:</strong> {getDepartmentDisplayName(department)}
                </Text>
                <HStack spacing={4} mt={2}>
                  <Text>
                    <strong>Impact:</strong> {wizardData.impact} (C=I=A={wizardData.impact})
                  </Text>
                  <Text>
                    <strong>Likelihood:</strong> {wizardData.likelihood}
                  </Text>
                </HStack>
                <HStack spacing={4} mt={4}>
                  <Text>
                    <strong>Calculated Score:</strong>
                  </Text>
                  <Badge colorScheme={levelColor} fontSize="lg" px={3} py={1}>
                    {score} ({level})
                  </Badge>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        );
      }

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return wizardData.threat.trim() && wizardData.vulnerability.trim() && wizardData.riskDescription.trim();
      case 2:
        return wizardData.impact > 0;
      case 3:
        return wizardData.likelihood > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={!loading}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Risk Wizard - Step {currentStep} of 4</ModalHeader>
        <ModalCloseButton isDisabled={loading} />
        <ModalBody>
          <Progress value={(currentStep / 4) * 100} mb={4} colorScheme="blue" />
          {renderStep()}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            {currentStep > 1 && (
              <Button variant="ghost" onClick={handleBack} isDisabled={loading}>
                Back
              </Button>
            )}
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={loading}>
              Cancel
            </Button>
            {currentStep < 4 ? (
              <Button colorScheme="blue" onClick={handleNext} isDisabled={!canProceed() || loading}>
                Next
              </Button>
            ) : (
              <>
                <Button
                  colorScheme="gray"
                  onClick={() => handleSubmit('DRAFT')}
                  isLoading={loading}
                  isDisabled={!canProceed()}
                >
                  Save as Draft
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={() => handleSubmit('PROPOSED')}
                  isLoading={loading}
                  isDisabled={!canProceed()}
                >
                  Submit Proposal
                </Button>
              </>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

