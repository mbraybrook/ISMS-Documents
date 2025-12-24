/* eslint-disable @typescript-eslint/no-explicit-any */
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
  Input,
  VStack,
  Textarea,
  Select,
  Checkbox,
  Progress,
  HStack,
  Text,
  Alert,
  AlertIcon,
  useToast,
  Box,
  useDisclosure,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supplierApi } from '../services/api';
import { SharePointFileBrowser } from './SharePointFileBrowser';
import {
  SupplierType,
  RiskRating,
  Criticality,
  PciStatus,
  IsoStatus,
  GdprStatus,
} from '../types/supplier';

interface SupplierOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierOnboardingWizard({ isOpen, onClose }: SupplierOnboardingWizardProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [step1Data, setStep1Data] = useState({
    name: '',
    tradingName: '',
    supplierType: 'SERVICE_PROVIDER' as SupplierType,
    isSaaS: false, // Simplified: just track if it's SaaS
    serviceDescription: '',
    processesCardholderData: false,
    processesPersonalData: false,
    hostingRegions: [] as string[],
    customerFacingImpact: false,
  });

  const [step2Data, setStep2Data] = useState({
    riskRating: null as RiskRating | null,
    rationale: '',
  });

  const [step3Data, setStep3Data] = useState({
    criticality: null as Criticality | null,
    rationale: '',
  });

  const [step4Data, setStep4Data] = useState({
    pciStatus: null as PciStatus | null,
    iso27001Status: null as IsoStatus | null,
    iso22301Status: null as IsoStatus | null,
    iso9001Status: null as IsoStatus | null,
    gdprStatus: null as GdprStatus | null,
    complianceEvidenceLinks: [] as string[],
  });

  const [newEvidenceLink, setNewEvidenceLink] = useState('');
  const { isOpen: isSharePointBrowserOpen, onOpen: onSharePointBrowserOpen, onClose: onSharePointBrowserClose } = useDisclosure();

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setStep1Data({
        name: '',
        tradingName: '',
        supplierType: 'SERVICE_PROVIDER',
        isSaaS: false,
        serviceDescription: '',
        processesCardholderData: false,
        processesPersonalData: false,
        hostingRegions: [],
        customerFacingImpact: false,
      });
      setStep2Data({
        riskRating: null,
        rationale: '',
      });
      setStep3Data({
        criticality: null,
        rationale: '',
      });
      setStep4Data({
        pciStatus: null,
        iso27001Status: null,
        iso22301Status: null,
        iso9001Status: null,
        gdprStatus: null,
        complianceEvidenceLinks: [],
      });
    }
  }, [isOpen]);

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      return step1Data.name.trim() !== '' && step1Data.supplierType !== null;
    }
    if (step === 2) {
      return step2Data.riskRating !== null;
    }
    if (step === 3) {
      return step3Data.criticality !== null;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getApprovalRequirements = () => {
    const requirements: string[] = [];
    if (step1Data.supplierType === 'CONNECTED_ENTITY' || step1Data.supplierType === 'PCI_SERVICE_PROVIDER') {
      requirements.push('CISO approval required');
    }
    if (step3Data.criticality === 'HIGH') {
      requirements.push('CISO approval required (High Criticality)');
    }
    if (requirements.length === 0) {
      requirements.push('Editor or Admin approval required');
    }
    return requirements;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Create supplier - convert isSaaS to serviceSubType for backend compatibility
      // Include all data (risk, criticality, and compliance) in the initial create call
      // Note: Backend validation expects optional fields to be omitted if null, not sent as null
      const { isSaaS, ...supplierData } = step1Data;
      
      // Build payload, only including fields that have values (omit null/empty)
      const payload: any = {
        ...supplierData,
        status: 'IN_ONBOARDING',
        lifecycleState: 'DRAFT',
      };

      // Add serviceSubType only if it has a value
      if (isSaaS) {
        payload.serviceSubType = 'SAAS';
      }

      // Add risk and criticality data only if they have values
      if (step2Data.riskRating) {
        payload.overallRiskRating = step2Data.riskRating;
      }
      if (step2Data.rationale) {
        payload.riskRationale = step2Data.rationale;
      }
      if (step3Data.criticality) {
        payload.criticality = step3Data.criticality;
      }
      if (step3Data.rationale) {
        payload.criticalityRationale = step3Data.rationale;
      }

      // Add compliance statuses only if they have values (not null)
      if (step4Data.pciStatus) {
        payload.pciStatus = step4Data.pciStatus;
      }
      if (step4Data.iso27001Status) {
        payload.iso27001Status = step4Data.iso27001Status;
      }
      if (step4Data.iso22301Status) {
        payload.iso22301Status = step4Data.iso22301Status;
      }
      if (step4Data.iso9001Status) {
        payload.iso9001Status = step4Data.iso9001Status;
      }
      if (step4Data.gdprStatus) {
        payload.gdprStatus = step4Data.gdprStatus;
      }
      if (step4Data.complianceEvidenceLinks.length > 0) {
        payload.complianceEvidenceLinks = step4Data.complianceEvidenceLinks;
      }

      const supplier = await supplierApi.createSupplier(payload);

      // Create risk assessment (non-blocking - continue even if it fails)
      if (step2Data.riskRating) {
        try {
          await (supplierApi as any).createRiskAssessment(supplier.id, {
            supplierType: step1Data.supplierType,
            riskRating: step2Data.riskRating,
            rationale: step2Data.rationale || null,
            status: 'DRAFT',
          });
        } catch (assessmentError: any) {
          console.warn('Failed to create risk assessment (non-critical):', assessmentError);
          // Continue - assessment creation is not critical for supplier creation
        }
      }

      // Create criticality assessment (non-blocking - continue even if it fails)
      if (step3Data.criticality) {
        try {
          await (supplierApi as any).createCriticalityAssessment(supplier.id, {
            criticality: step3Data.criticality,
            rationale: step3Data.rationale || null,
            status: 'DRAFT',
          });
        } catch (assessmentError: any) {
          console.warn('Failed to create criticality assessment (non-critical):', assessmentError);
          // Continue - assessment creation is not critical for supplier creation
        }
      }

      toast({
        title: 'Supplier created successfully',
        status: 'success',
        duration: 3000,
      });

      onClose();
      navigate(`/admin/suppliers/${supplier.id}`);
    } catch (error: any) {
      console.error('Supplier creation error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'An error occurred';
      const errorDetails = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
      
      toast({
        title: 'Failed to create supplier',
        description: errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const addEvidenceLink = (_step: 'step4') => {
    if (newEvidenceLink.trim()) {
      setStep4Data({
        ...step4Data,
        complianceEvidenceLinks: [...step4Data.complianceEvidenceLinks, newEvidenceLink.trim()],
      });
      setNewEvidenceLink('');
    }
  };

  const removeEvidenceLink = (index: number, _step: 'step4') => {
    setStep4Data({
      ...step4Data,
      complianceEvidenceLinks: step4Data.complianceEvidenceLinks.filter((_, i) => i !== index),
    });
  };

  const progress = (currentStep / 5) * 100;
  const requirements = getApprovalRequirements();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>Supplier Onboarding Wizard</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Progress value={progress} mb={4} colorScheme="blue" />
          <Text fontSize="sm" color="gray.600" mb={4}>
            Step {currentStep} of 5
          </Text>

          {currentStep === 1 && (
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Supplier Name</FormLabel>
                <Input
                  value={step1Data.name}
                  onChange={(e) => setStep1Data({ ...step1Data, name: e.target.value })}
                  placeholder="Enter supplier name"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Trading Name</FormLabel>
                <Input
                  value={step1Data.tradingName}
                  onChange={(e) => setStep1Data({ ...step1Data, tradingName: e.target.value })}
                  placeholder="Enter trading name (optional)"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Supplier Type</FormLabel>
                <Select
                  value={step1Data.supplierType}
                  onChange={(e) => setStep1Data({ ...step1Data, supplierType: e.target.value as SupplierType })}
                >
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                  <option value="CONNECTED_ENTITY">Connected Entity</option>
                  <option value="PCI_SERVICE_PROVIDER">PCI Service Provider</option>
                </Select>
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={step1Data.isSaaS}
                  onChange={(e) => setStep1Data({ ...step1Data, isSaaS: e.target.checked })}
                >
                  Is this a SaaS supplier?
                </Checkbox>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Check this box if the supplier provides Software as a Service
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Service Description</FormLabel>
                <Textarea
                  value={step1Data.serviceDescription}
                  onChange={(e) => setStep1Data({ ...step1Data, serviceDescription: e.target.value })}
                  placeholder="Describe the service provided"
                  rows={4}
                />
              </FormControl>

              <Checkbox
                isChecked={step1Data.processesCardholderData}
                onChange={(e) => setStep1Data({ ...step1Data, processesCardholderData: e.target.checked })}
              >
                Processes Cardholder Data
              </Checkbox>

              <Checkbox
                isChecked={step1Data.processesPersonalData}
                onChange={(e) => setStep1Data({ ...step1Data, processesPersonalData: e.target.checked })}
              >
                Processes Personal Data
              </Checkbox>

              <Checkbox
                isChecked={step1Data.customerFacingImpact}
                onChange={(e) => setStep1Data({ ...step1Data, customerFacingImpact: e.target.checked })}
              >
                Customer Facing Impact
              </Checkbox>
            </VStack>
          )}

          {currentStep === 2 && (
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Risk Rating</FormLabel>
                <Select
                  value={step2Data.riskRating || ''}
                  onChange={(e) => setStep2Data({ ...step2Data, riskRating: e.target.value as RiskRating || null })}
                >
                  <option value="">Select Risk Rating</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Rationale</FormLabel>
                <Textarea
                  value={step2Data.rationale}
                  onChange={(e) => setStep2Data({ ...step2Data, rationale: e.target.value })}
                  placeholder="Explain the risk assessment rationale"
                  rows={4}
                />
              </FormControl>
            </VStack>
          )}

          {currentStep === 3 && (
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Criticality</FormLabel>
                <Select
                  value={step3Data.criticality || ''}
                  onChange={(e) => setStep3Data({ ...step3Data, criticality: e.target.value as Criticality || null })}
                >
                  <option value="">Select Criticality</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Rationale</FormLabel>
                <Textarea
                  value={step3Data.rationale}
                  onChange={(e) => setStep3Data({ ...step3Data, rationale: e.target.value })}
                  placeholder="Explain the criticality assessment rationale"
                  rows={4}
                />
              </FormControl>
            </VStack>
          )}

          {currentStep === 4 && (
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>PCI Status</FormLabel>
                <Select
                  value={step4Data.pciStatus || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep4Data({ ...step4Data, pciStatus: value === '' ? null : (value as PciStatus) });
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>ISO 27001 Status</FormLabel>
                <Select
                  value={step4Data.iso27001Status || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep4Data({ ...step4Data, iso27001Status: value === '' ? null : (value as IsoStatus) });
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="CERTIFIED">Certified</option>
                  <option value="NOT_CERTIFIED">Not Certified</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>ISO 22301 Status</FormLabel>
                <Select
                  value={step4Data.iso22301Status || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep4Data({ ...step4Data, iso22301Status: value === '' ? null : (value as IsoStatus) });
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="CERTIFIED">Certified</option>
                  <option value="NOT_CERTIFIED">Not Certified</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>ISO 9001 Status</FormLabel>
                <Select
                  value={step4Data.iso9001Status || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep4Data({ ...step4Data, iso9001Status: value === '' ? null : (value as IsoStatus) });
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="CERTIFIED">Certified</option>
                  <option value="NOT_CERTIFIED">Not Certified</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>GDPR Status</FormLabel>
                <Select
                  value={step4Data.gdprStatus || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep4Data({ ...step4Data, gdprStatus: value === '' ? null : (value as GdprStatus) });
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="ADEQUATE">Adequate</option>
                  <option value="HIGH_RISK">High Risk</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Compliance Evidence Links</FormLabel>
                <HStack>
                  <Input
                    value={newEvidenceLink}
                    onChange={(e) => setNewEvidenceLink(e.target.value)}
                    placeholder="Enter evidence URL"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addEvidenceLink('step4');
                      }
                    }}
                  />
                  <Button onClick={() => addEvidenceLink('step4')}>Add</Button>
                  <Button onClick={onSharePointBrowserOpen} variant="outline">
                    Browse SharePoint
                  </Button>
                </HStack>
                {step4Data.complianceEvidenceLinks.length > 0 && (
                  <VStack align="stretch" mt={2}>
                    {step4Data.complianceEvidenceLinks.map((link, idx) => (
                      <HStack key={idx} justify="space-between" p={2} bg="gray.50" borderRadius="md">
                        <Text fontSize="sm" isTruncated flex="1">
                          {link}
                        </Text>
                        <Button size="xs" onClick={() => removeEvidenceLink(idx, 'step4')}>
                          Remove
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </FormControl>
            </VStack>
          )}

          {currentStep === 5 && (
            <VStack spacing={4} align="stretch">
              <Alert status="info">
                <AlertIcon />
                Review the information below before submitting
              </Alert>

              <Box p={4} borderWidth="1px" borderRadius="md">
                <Text fontWeight="bold" mb={2}>Supplier Profile</Text>
                <Text>Name: {step1Data.name}</Text>
                <Text>Type: {step1Data.supplierType}</Text>
                <Text>Service: {step1Data.serviceDescription || 'Not specified'}</Text>
              </Box>

              <Box p={4} borderWidth="1px" borderRadius="md">
                <Text fontWeight="bold" mb={2}>Risk Assessment</Text>
                <Text>Risk Rating: {step2Data.riskRating || 'Not set'}</Text>
              </Box>

              <Box p={4} borderWidth="1px" borderRadius="md">
                <Text fontWeight="bold" mb={2}>Criticality Assessment</Text>
                <Text>Criticality: {step3Data.criticality || 'Not set'}</Text>
              </Box>

              <Box p={4} borderWidth="1px" borderRadius="md" bg="yellow.50">
                <Text fontWeight="bold" mb={2}>Approval Requirements</Text>
                <VStack align="stretch" spacing={1}>
                  {requirements.map((req, idx) => (
                    <Text key={idx} fontSize="sm">• {req}</Text>
                  ))}
                </VStack>
              </Box>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            {currentStep > 1 && (
              <Button onClick={handleBack} variant="ghost">
                Back
              </Button>
            )}
            {currentStep < 5 ? (
              <Button
                onClick={handleNext}
                colorScheme="blue"
                isDisabled={!validateStep(currentStep)}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                colorScheme="green"
                isLoading={loading}
              >
                Submit
              </Button>
            )}
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>

      {/* SharePoint File Browser for Compliance Evidence Links */}
      <SharePointFileBrowser
        isOpen={isSharePointBrowserOpen}
        onClose={onSharePointBrowserClose}
        onSelect={(item) => {
          setStep4Data({
            ...step4Data,
            complianceEvidenceLinks: [...step4Data.complianceEvidenceLinks, item.webUrl],
          });
          onSharePointBrowserClose();
        }}
      />
    </Modal>
  );
}

