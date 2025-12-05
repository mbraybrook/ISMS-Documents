import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Checkbox,
  SimpleGrid,
  Divider,
  Heading,
  Alert,
  AlertIcon,
  HStack,
  IconButton,
  useToast,
  Box,
  useDisclosure,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { supplierApi } from '../services/api';
import { SharePointFileBrowser } from './SharePointFileBrowser';
import {
  ReviewType,
  ReviewOutcome,
  PerformanceRating,
  RiskRating,
  Criticality,
  PciStatus,
  IsoStatus,
  GdprStatus,
} from '../types/supplier';

interface SupplierReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  currentSupplier?: {
    overallRiskRating?: string | null;
    criticality?: string | null;
    riskRationale?: string | null;
    criticalityRationale?: string | null;
    pciStatus?: string | null;
    iso27001Status?: string | null;
    iso22301Status?: string | null;
    iso9001Status?: string | null;
    gdprStatus?: string | null;
    performanceRating?: string | null;
    complianceEvidenceLinks?: string[] | null;
    lastRiskAssessmentAt?: string | null;
    lastCriticalityAssessmentAt?: string | null;
    lastComplianceReviewAt?: string | null;
    supplierType?: string;
  };
  onReviewCreated?: () => void;
}

export function SupplierReviewModal({
  isOpen,
  onClose,
  supplierId,
  currentSupplier,
  onReviewCreated,
}: SupplierReviewModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [creatingAssessments, setCreatingAssessments] = useState(false);
  const { isOpen: isEvidenceBrowserOpen, onOpen: onEvidenceBrowserOpen, onClose: onEvidenceBrowserClose } = useDisclosure();
  const [editingEvidenceIndex, setEditingEvidenceIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    reviewType: 'SCHEDULED' as ReviewType,
    plannedAt: new Date().toISOString().split('T')[0],
    checksPerformed: '',
    notes: '',
    evidenceLinks: [] as string[],
    
    // Risk & Criticality fields
    overallRiskRating: currentSupplier?.overallRiskRating || '',
    criticality: currentSupplier?.criticality || '',
    riskRationale: currentSupplier?.riskRationale || '',
    criticalityRationale: currentSupplier?.criticalityRationale || '',
    lastRiskAssessmentAt: currentSupplier?.lastRiskAssessmentAt
      ? new Date(currentSupplier.lastRiskAssessmentAt).toISOString().split('T')[0]
      : '',
    lastCriticalityAssessmentAt: currentSupplier?.lastCriticalityAssessmentAt
      ? new Date(currentSupplier.lastCriticalityAssessmentAt).toISOString().split('T')[0]
      : '',
    
    // Compliance fields
    pciStatus: currentSupplier?.pciStatus || '',
    iso27001Status: currentSupplier?.iso27001Status || '',
    iso22301Status: currentSupplier?.iso22301Status || '',
    iso9001Status: currentSupplier?.iso9001Status || '',
    gdprStatus: currentSupplier?.gdprStatus || '',
    complianceEvidenceLinks: currentSupplier?.complianceEvidenceLinks || [] as string[],
    
    // Performance
    updatedPerformanceRating: currentSupplier?.performanceRating || '',
    
    // Assessment creation options
    createRiskAssessment: false,
    createCriticalityAssessment: false,
  });

  const addEvidenceLink = () => {
    setFormData({
      ...formData,
      evidenceLinks: [...formData.evidenceLinks, ''],
    });
  };

  const updateEvidenceLink = (index: number, value: string) => {
    const newLinks = [...formData.evidenceLinks];
    newLinks[index] = value;
    setFormData({ ...formData, evidenceLinks: newLinks });
  };

  const removeEvidenceLink = (index: number) => {
    const newLinks = formData.evidenceLinks.filter((_, i) => i !== index);
    setFormData({ ...formData, evidenceLinks: newLinks });
  };

  const addComplianceEvidenceLink = () => {
    setFormData({
      ...formData,
      complianceEvidenceLinks: [...formData.complianceEvidenceLinks, ''],
    });
  };

  const updateComplianceEvidenceLink = (index: number, value: string) => {
    const newLinks = [...formData.complianceEvidenceLinks];
    newLinks[index] = value;
    setFormData({ ...formData, complianceEvidenceLinks: newLinks });
  };

  const removeComplianceEvidenceLink = (index: number) => {
    const newLinks = formData.complianceEvidenceLinks.filter((_, i) => i !== index);
    setFormData({ ...formData, complianceEvidenceLinks: newLinks });
  };

  const handleCreateReview = async () => {
    try {
      setSaving(true);

      // First, create the compliance review
      // Convert date string to ISO8601 datetime (YYYY-MM-DD to ISO8601)
      let plannedAtDate: string;
      if (formData.plannedAt) {
        // Create date at midnight UTC to ensure valid ISO8601 format
        const date = new Date(formData.plannedAt + 'T00:00:00.000Z');
        plannedAtDate = date.toISOString();
      } else {
        plannedAtDate = new Date().toISOString();
      }
      
      // Build request payload, only including fields with actual values (not null/empty)
      const reviewPayload: any = {
        reviewType: formData.reviewType,
        plannedAt: plannedAtDate,
      };
      
      if (formData.checksPerformed && formData.checksPerformed.trim()) {
        reviewPayload.checksPerformed = formData.checksPerformed;
      }
      
      if (formData.notes && formData.notes.trim()) {
        reviewPayload.notes = formData.notes;
      }
      
      const filteredEvidenceLinks = formData.evidenceLinks.filter(link => link.trim());
      if (filteredEvidenceLinks.length > 0) {
        reviewPayload.evidenceLinks = filteredEvidenceLinks;
      }
      
      const review = await supplierApi.createComplianceReview(supplierId, reviewPayload);

      // Build completion payload, only including fields with actual values
      const completionPayload: any = {
        outcome: 'PASS', // Default to PASS, can be changed later
      };
      
      if (formData.updatedPerformanceRating) {
        completionPayload.updatedPerformanceRating = formData.updatedPerformanceRating;
      }
      
      if (formData.notes && formData.notes.trim()) {
        completionPayload.notes = formData.notes;
      }
      
      // Risk & Criticality updates
      if (formData.overallRiskRating) {
        completionPayload.overallRiskRating = formData.overallRiskRating;
      }
      if (formData.criticality) {
        completionPayload.criticality = formData.criticality;
      }
      if (formData.riskRationale && formData.riskRationale.trim()) {
        completionPayload.riskRationale = formData.riskRationale;
      }
      if (formData.criticalityRationale && formData.criticalityRationale.trim()) {
        completionPayload.criticalityRationale = formData.criticalityRationale;
      }
      if (formData.lastRiskAssessmentAt) {
        completionPayload.lastRiskAssessmentAt = formData.lastRiskAssessmentAt;
      }
      if (formData.lastCriticalityAssessmentAt) {
        completionPayload.lastCriticalityAssessmentAt = formData.lastCriticalityAssessmentAt;
      }
      
      // Compliance updates
      if (formData.pciStatus) {
        completionPayload.pciStatus = formData.pciStatus;
      }
      if (formData.iso27001Status) {
        completionPayload.iso27001Status = formData.iso27001Status;
      }
      if (formData.iso22301Status) {
        completionPayload.iso22301Status = formData.iso22301Status;
      }
      if (formData.iso9001Status) {
        completionPayload.iso9001Status = formData.iso9001Status;
      }
      if (formData.gdprStatus) {
        completionPayload.gdprStatus = formData.gdprStatus;
      }
      
      const filteredComplianceLinks = formData.complianceEvidenceLinks.filter(link => link.trim());
      if (filteredComplianceLinks.length > 0) {
        completionPayload.complianceEvidenceLinks = filteredComplianceLinks;
      }
      
      await supplierApi.completeComplianceReview(supplierId, review.id, completionPayload);

      // Optionally create assessments if requested
      if (formData.createRiskAssessment && formData.overallRiskRating) {
        setCreatingAssessments(true);
        try {
          await supplierApi.createRiskAssessment(supplierId, {
            supplierType: currentSupplier?.supplierType || 'SERVICE_PROVIDER',
            riskRating: formData.overallRiskRating as RiskRating,
            rationale: formData.riskRationale || null,
            status: 'DRAFT',
          });
        } catch (error) {
          console.error('Error creating risk assessment:', error);
          toast({
            title: 'Warning',
            description: 'Review completed but failed to create risk assessment',
            status: 'warning',
            duration: 3000,
          });
        }
      }

      if (formData.createCriticalityAssessment && formData.criticality) {
        try {
          await supplierApi.createCriticalityAssessment(supplierId, {
            criticality: formData.criticality as Criticality,
            rationale: formData.criticalityRationale || null,
            status: 'DRAFT',
          });
        } catch (error) {
          console.error('Error creating criticality assessment:', error);
          toast({
            title: 'Warning',
            description: 'Review completed but failed to create criticality assessment',
            status: 'warning',
            duration: 3000,
          });
        }
      }

      setCreatingAssessments(false);

      toast({
        title: 'Success',
        description: 'Review created and completed successfully',
        status: 'success',
        duration: 3000,
      });

      onReviewCreated?.();
      onClose();
    } catch (error: any) {
      console.error('Error creating review:', error);
      const errorMessage = error.response?.data?.details 
        || error.response?.data?.error 
        || error.response?.data?.errors?.[0]?.msg
        || error.message 
        || 'Failed to create review';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSaving(false);
      setCreatingAssessments(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>Create Supplier Review</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Alert status="info">
              <AlertIcon />
              This review will update supplier fields directly when completed. You can optionally create formal Assessments for approval workflows.
            </Alert>

            {/* Review Basic Info */}
            <Box>
              <Heading size="sm" mb={4}>Review Information</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Review Type</FormLabel>
                  <Select
                    value={formData.reviewType}
                    onChange={(e) => setFormData({ ...formData, reviewType: e.target.value as ReviewType })}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="TRIGGERED_BY_INCIDENT">Triggered by Incident</option>
                    <option value="TRIGGERED_BY_CHANGE">Triggered by Change</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Planned Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.plannedAt}
                    onChange={(e) => setFormData({ ...formData, plannedAt: e.target.value })}
                  />
                </FormControl>
                <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                  <FormLabel>Checks Performed</FormLabel>
                  <Textarea
                    value={formData.checksPerformed}
                    onChange={(e) => setFormData({ ...formData, checksPerformed: e.target.value })}
                    rows={3}
                    placeholder="Describe the checks and validations performed during this review..."
                  />
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Risk & Criticality */}
            <Box>
              <Heading size="sm" mb={4}>Risk & Criticality</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Risk Rating</FormLabel>
                  <Select
                    value={formData.overallRiskRating}
                    onChange={(e) => setFormData({ ...formData, overallRiskRating: e.target.value })}
                  >
                    <option value="">Not assessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Criticality</FormLabel>
                  <Select
                    value={formData.criticality}
                    onChange={(e) => setFormData({ ...formData, criticality: e.target.value })}
                  >
                    <option value="">Not assessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
              <FormControl mt={4}>
                <FormLabel>Risk Rationale</FormLabel>
                <Textarea
                  value={formData.riskRationale}
                  onChange={(e) => setFormData({ ...formData, riskRationale: e.target.value })}
                  rows={3}
                  placeholder="Explain the risk assessment rationale..."
                />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Criticality Rationale</FormLabel>
                <Textarea
                  value={formData.criticalityRationale}
                  onChange={(e) => setFormData({ ...formData, criticalityRationale: e.target.value })}
                  rows={3}
                  placeholder="Explain the criticality assessment rationale..."
                />
              </FormControl>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
                <FormControl>
                  <FormLabel>Last Risk Assessment Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastRiskAssessmentAt}
                    onChange={(e) => setFormData({ ...formData, lastRiskAssessmentAt: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Criticality Assessment Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastCriticalityAssessmentAt}
                    onChange={(e) => setFormData({ ...formData, lastCriticalityAssessmentAt: e.target.value })}
                  />
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Compliance */}
            <Box>
              <Heading size="sm" mb={4}>Compliance Status</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>PCI Status</FormLabel>
                  <Select
                    value={formData.pciStatus}
                    onChange={(e) => setFormData({ ...formData, pciStatus: e.target.value })}
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
                    value={formData.iso27001Status}
                    onChange={(e) => setFormData({ ...formData, iso27001Status: e.target.value })}
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
                    value={formData.iso22301Status}
                    onChange={(e) => setFormData({ ...formData, iso22301Status: e.target.value })}
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
                    value={formData.iso9001Status}
                    onChange={(e) => setFormData({ ...formData, iso9001Status: e.target.value })}
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
                    value={formData.gdprStatus}
                    onChange={(e) => setFormData({ ...formData, gdprStatus: e.target.value })}
                  >
                    <option value="">Unknown</option>
                    <option value="ADEQUATE">Adequate</option>
                    <option value="HIGH_RISK">High Risk</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Performance Rating</FormLabel>
                  <Select
                    value={formData.updatedPerformanceRating}
                    onChange={(e) => setFormData({ ...formData, updatedPerformanceRating: e.target.value })}
                  >
                    <option value="">Not rated</option>
                    <option value="GOOD">Good</option>
                    <option value="CAUTION">Caution</option>
                    <option value="BAD">Bad</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl mt={4}>
                <FormLabel>Compliance Evidence Links</FormLabel>
                <VStack align="stretch" spacing={2}>
                  {formData.complianceEvidenceLinks.map((link, index) => (
                    <HStack key={index}>
                      <Input
                        value={link}
                        onChange={(e) => updateComplianceEvidenceLink(index, e.target.value)}
                        placeholder="URL to certificate or evidence (SharePoint or public website)"
                      />
                      <IconButton
                        aria-label="Remove link"
                        icon={<DeleteIcon />}
                        onClick={() => removeComplianceEvidenceLink(index)}
                        size="sm"
                      />
                    </HStack>
                  ))}
                  <Button leftIcon={<AddIcon />} size="sm" onClick={addComplianceEvidenceLink}>
                    Add Evidence Link
                  </Button>
                </VStack>
              </FormControl>
            </Box>

            <Divider />

            {/* Assessment Creation Options */}
            <Box>
              <Heading size="sm" mb={4}>Formal Assessments (Optional)</Heading>
              <Alert status="info" mb={4}>
                <AlertIcon />
                Create formal Risk/Criticality Assessments if you need approval workflows. These will be created in DRAFT status.
              </Alert>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <Checkbox
                    isChecked={formData.createRiskAssessment}
                    onChange={(e) => setFormData({ ...formData, createRiskAssessment: e.target.checked })}
                  >
                    Create Risk Assessment (requires Risk Rating)
                  </Checkbox>
                </FormControl>
                <FormControl>
                  <Checkbox
                    isChecked={formData.createCriticalityAssessment}
                    onChange={(e) => setFormData({ ...formData, createCriticalityAssessment: e.target.checked })}
                  >
                    Create Criticality Assessment (requires Criticality)
                  </Checkbox>
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Review Notes & Evidence */}
            <Box>
              <Heading size="sm" mb={4}>Review Notes & Evidence</Heading>
              <FormControl>
                <FormLabel>Review Notes</FormLabel>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Add notes about this review..."
                />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel>Evidence Links</FormLabel>
                <VStack align="stretch" spacing={2}>
                  {formData.evidenceLinks.map((link, index) => (
                    <HStack key={index}>
                      <Input
                        value={link}
                        onChange={(e) => updateEvidenceLink(index, e.target.value)}
                        placeholder="URL to evidence"
                      />
                      <IconButton
                        aria-label="Remove link"
                        icon={<DeleteIcon />}
                        onClick={() => removeEvidenceLink(index)}
                        size="sm"
                      />
                    </HStack>
                  ))}
                  <Button leftIcon={<AddIcon />} size="sm" onClick={addEvidenceLink}>
                    Add Evidence Link
                  </Button>
                </VStack>
              </FormControl>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleCreateReview}
            isLoading={saving || creatingAssessments}
            loadingText={creatingAssessments ? 'Creating assessments...' : 'Creating review...'}
          >
            Create & Complete Review
          </Button>
        </ModalFooter>
      </ModalContent>

      {/* SharePoint File Browser for Evidence Links */}
      <SharePointFileBrowser
        isOpen={isEvidenceBrowserOpen}
        onClose={() => {
          onEvidenceBrowserClose();
          setEditingEvidenceIndex(null);
        }}
        onSelect={(item) => {
          if (editingEvidenceIndex !== null) {
            updateComplianceEvidenceLink(editingEvidenceIndex, item.webUrl);
          }
          onEvidenceBrowserClose();
          setEditingEvidenceIndex(null);
        }}
      />
    </Modal>
  );
}

