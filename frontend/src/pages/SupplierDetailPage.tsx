import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Button,
  HStack,
  VStack,
  useToast,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Checkbox,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Text,
  SimpleGrid,
  Divider,
  Flex,
  Alert,
  AlertIcon,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';
import { ArrowBackIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { supplierApi } from '../services/api';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, SupplierContact } from '../types/supplier';
import {
  getSupplierStatusDisplayName,
  getSupplierTypeDisplayName,
  getServiceSubTypeDisplayName,
  getCiaImpactDisplayName,
  getRiskRatingDisplayName,
  getCriticalityDisplayName,
  getPciStatusDisplayName,
  getIsoStatusDisplayName,
  getGdprStatusDisplayName,
  getPerformanceRatingDisplayName,
  getLifecycleStateDisplayName,
  SupplierRiskAssessment,
  SupplierCriticalityAssessment,
} from '../types/supplier';
import { SupplierAssessmentTimeline } from '../components/SupplierAssessmentTimeline';
import { SupplierApprovalPanel } from '../components/SupplierApprovalPanel';
import { SupplierRisksControlsTab } from '../components/SupplierRisksControlsTab';
import { SupplierExitPlanTab } from '../components/SupplierExitPlanTab';
import { SupplierReviewModal } from '../components/SupplierReviewModal';
import { SharePointFileBrowser } from '../components/SharePointFileBrowser';

interface User {
  id: string;
  displayName: string;
  email: string;
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<SupplierRiskAssessment[]>([]);
  const [criticalityAssessments, setCriticalityAssessments] = useState<SupplierCriticalityAssessment[]>([]);
  const [assessmentHistory, setAssessmentHistory] = useState<any[]>([]);
  const [complianceReviews, setComplianceReviews] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [reviewStatus, setReviewStatus] = useState<any>(null);
  const { isOpen: isReviewModalOpen, onOpen: onReviewModalOpen, onClose: onReviewModalClose } = useDisclosure();
  const { isOpen: isEvidenceBrowserOpen, onOpen: onEvidenceBrowserOpen, onClose: onEvidenceBrowserClose } = useDisclosure();
  const { isOpen: isCertificateEvidenceBrowserOpen, onOpen: onCertificateEvidenceBrowserOpen, onClose: onCertificateEvidenceBrowserClose } = useDisclosure();
  const { isOpen: isContractBrowserOpen, onOpen: onContractBrowserOpen, onClose: onContractBrowserClose } = useDisclosure();
  const [editingContractIndex, setEditingContractIndex] = useState<number | null>(null);
  const [editingEvidenceIndex, setEditingEvidenceIndex] = useState<number | null>(null);
  const [editingCertificateId, setEditingCertificateId] = useState<string | null>(null);
  const isNew = id === 'new';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';
  
  // Determine edit mode: if mode query param is 'view', use view mode; if 'edit', use edit mode; otherwise default based on canEdit
  const modeParam = searchParams.get('mode');
  const [isEditing, setIsEditing] = useState<boolean>(() => {
    if (isNew) return true; // Always edit mode for new suppliers
    if (modeParam === 'view') return false;
    if (modeParam === 'edit') return true;
    return canEdit; // Default: edit if user can edit, view if not
  });

  const [formData, setFormData] = useState({
    name: '',
    tradingName: '',
    status: 'ACTIVE' as const,
    supplierType: 'SERVICE_PROVIDER' as const,
    serviceSubType: null as string | null,
    serviceDescription: '',
    processesCardholderData: false,
    processesPersonalData: false,
    hostingRegions: [] as string[],
    customerFacingImpact: false,
    ciaImpact: null as string | null,
    overallRiskRating: null as string | null,
    criticality: null as string | null,
    riskRationale: '',
    criticalityRationale: '',
    lastRiskAssessmentAt: '',
    lastCriticalityAssessmentAt: '',
    pciStatus: null as string | null,
    iso27001Status: null as string | null,
    iso22301Status: null as string | null,
    iso9001Status: null as string | null,
    gdprStatus: null as string | null,
    lastComplianceReviewAt: '',
    complianceEvidenceLinks: [] as string[],
    relationshipOwnerUserId: null as string | null,
    primaryContacts: [] as SupplierContact[],
    contractReferences: [] as string[],
    dataProcessingAgreementRef: '',
    contractStartDate: '',
    contractEndDate: '',
    autoRenewal: false,
    performanceRating: null as string | null,
    performanceNotes: '',
    lifecycleState: 'DRAFT' as string,
    cisoExemptionGranted: false,
    showInTrustCenter: false,
    trustCenterDisplayName: '',
    trustCenterDescription: '',
    trustCenterCategory: null as string | null,
    trustCenterComplianceSummary: '',
  });

  useEffect(() => {
    if (canEdit) {
      fetchUsers();
    }
    if (!isNew) {
      fetchSupplier();
    }
  }, [id, canEdit]);

  // Update isEditing when mode query param changes
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'view') {
      setIsEditing(false);
    } else if (modeParam === 'edit') {
      setIsEditing(true);
    }
  }, [searchParams]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const data = await supplierApi.getSupplier(id!);
      setSupplier(data);
      
      // Fetch assessments, compliance reviews, certificates, and review status
      const [
        riskAssessmentsData,
        criticalityAssessmentsData,
        historyData,
        complianceReviewsData,
        certificatesData,
        reviewStatusData,
      ] = await Promise.all([
        supplierApi.getRiskAssessments(id!),
        supplierApi.getCriticalityAssessments(id!),
        supplierApi.getAssessmentHistory(id!),
        supplierApi.getComplianceReviews(id!),
        supplierApi.getCertificates(id!),
        supplierApi.getReviewStatus(id!),
      ]);
      setRiskAssessments(riskAssessmentsData);
      setCriticalityAssessments(criticalityAssessmentsData);
      setAssessmentHistory(historyData);
      setComplianceReviews(complianceReviewsData);
      setCertificates(certificatesData);
      setReviewStatus(reviewStatusData);
      setFormData({
        name: data.name || '',
        tradingName: data.tradingName || '',
        status: data.status,
        supplierType: data.supplierType,
        serviceSubType: data.serviceSubType,
        serviceDescription: data.serviceDescription || '',
        processesCardholderData: data.processesCardholderData,
        processesPersonalData: data.processesPersonalData,
        hostingRegions: data.hostingRegions || [],
        customerFacingImpact: data.customerFacingImpact,
        ciaImpact: data.ciaImpact,
        overallRiskRating: data.overallRiskRating,
        criticality: data.criticality,
        riskRationale: data.riskRationale || '',
        criticalityRationale: data.criticalityRationale || '',
        lastRiskAssessmentAt: data.lastRiskAssessmentAt ? new Date(data.lastRiskAssessmentAt).toISOString().split('T')[0] : '',
        lastCriticalityAssessmentAt: data.lastCriticalityAssessmentAt ? new Date(data.lastCriticalityAssessmentAt).toISOString().split('T')[0] : '',
        pciStatus: data.pciStatus,
        iso27001Status: data.iso27001Status,
        iso22301Status: data.iso22301Status,
        iso9001Status: data.iso9001Status,
        gdprStatus: data.gdprStatus,
        lastComplianceReviewAt: data.lastComplianceReviewAt ? new Date(data.lastComplianceReviewAt).toISOString().split('T')[0] : '',
        complianceEvidenceLinks: data.complianceEvidenceLinks || [],
        relationshipOwnerUserId: data.relationshipOwnerUserId,
        primaryContacts: data.primaryContacts || [],
        contractReferences: data.contractReferences || [],
        dataProcessingAgreementRef: data.dataProcessingAgreementRef || '',
        contractStartDate: data.contractStartDate ? new Date(data.contractStartDate).toISOString().split('T')[0] : '',
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString().split('T')[0] : '',
        autoRenewal: data.autoRenewal,
        performanceRating: data.performanceRating,
        performanceNotes: data.performanceNotes || '',
        lifecycleState: data.lifecycleState || 'DRAFT',
        cisoExemptionGranted: data.cisoExemptionGranted || false,
        showInTrustCenter: data.showInTrustCenter || false,
        trustCenterDisplayName: data.trustCenterDisplayName || '',
        trustCenterDescription: data.trustCenterDescription || '',
        trustCenterCategory: data.trustCenterCategory || null,
        trustCenterComplianceSummary: data.trustCenterComplianceSummary || '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch supplier',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/admin/suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Supplier name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setSaving(true);
      const dataToSave: any = {
        ...formData,
        hostingRegions: formData.hostingRegions.filter(r => r.trim()),
        complianceEvidenceLinks: formData.complianceEvidenceLinks.filter(l => l.trim()),
        contractReferences: formData.contractReferences.filter(r => r.trim()),
        primaryContacts: formData.primaryContacts.filter(c => c.name.trim()),
        lastRiskAssessmentAt: formData.lastRiskAssessmentAt && formData.lastRiskAssessmentAt.trim() !== '' ? formData.lastRiskAssessmentAt : null,
        lastCriticalityAssessmentAt: formData.lastCriticalityAssessmentAt && formData.lastCriticalityAssessmentAt.trim() !== '' ? formData.lastCriticalityAssessmentAt : null,
        lastComplianceReviewAt: formData.lastComplianceReviewAt && formData.lastComplianceReviewAt.trim() !== '' ? formData.lastComplianceReviewAt : null,
        contractStartDate: formData.contractStartDate && formData.contractStartDate.trim() !== '' ? formData.contractStartDate : null,
        contractEndDate: formData.contractEndDate && formData.contractEndDate.trim() !== '' ? formData.contractEndDate : null,
        showInTrustCenter: formData.showInTrustCenter,
        trustCenterDisplayName: formData.trustCenterDisplayName || null,
        trustCenterDescription: formData.trustCenterDescription || null,
        trustCenterCategory: formData.trustCenterCategory || null,
        trustCenterComplianceSummary: formData.trustCenterComplianceSummary || null,
      };

      if (isNew) {
        const newSupplier = await supplierApi.createSupplier(dataToSave);
        toast({
          title: 'Success',
          description: 'Supplier created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        navigate(`/admin/suppliers/${newSupplier.id}?mode=view`);
      } else {
        await supplierApi.updateSupplier(id!, dataToSave);
        toast({
          title: 'Success',
          description: 'Supplier updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setIsEditing(false);
        setSearchParams({ mode: 'view' });
        fetchSupplier();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save supplier',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const addHostingRegion = () => {
    setFormData({
      ...formData,
      hostingRegions: [...formData.hostingRegions, ''],
    });
  };

  const updateHostingRegion = (index: number, value: string) => {
    const newRegions = [...formData.hostingRegions];
    newRegions[index] = value;
    setFormData({ ...formData, hostingRegions: newRegions });
  };

  const removeHostingRegion = (index: number) => {
    const newRegions = formData.hostingRegions.filter((_, i) => i !== index);
    setFormData({ ...formData, hostingRegions: newRegions });
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

  const addContractReference = () => {
    setFormData({
      ...formData,
      contractReferences: [...formData.contractReferences, ''],
    });
  };

  const updateContractReference = (index: number, value: string) => {
    const newRefs = [...formData.contractReferences];
    newRefs[index] = value;
    setFormData({ ...formData, contractReferences: newRefs });
  };

  const removeContractReference = (index: number) => {
    const newRefs = formData.contractReferences.filter((_, i) => i !== index);
    setFormData({ ...formData, contractReferences: newRefs });
  };

  const handleContractFileSelect = (item: any) => {
    if (editingContractIndex !== null) {
      updateContractReference(editingContractIndex, item.webUrl);
    } else {
      // Add new contract reference
      setFormData({
        ...formData,
        contractReferences: [...formData.contractReferences, item.webUrl],
      });
    }
    onContractBrowserClose();
    setEditingContractIndex(null);
  };

  const addContact = () => {
    setFormData({
      ...formData,
      primaryContacts: [...formData.primaryContacts, { name: '', role: '', email: '', phone: '', notes: '' }],
    });
  };

  const updateContact = (index: number, field: keyof SupplierContact, value: string) => {
    const newContacts = [...formData.primaryContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData({ ...formData, primaryContacts: newContacts });
  };

  const removeContact = (index: number) => {
    const newContacts = formData.primaryContacts.filter((_, i) => i !== index);
    setFormData({ ...formData, primaryContacts: newContacts });
  };

  const getLifecycleStateColor = (state: string) => {
    switch (state) {
      case 'APPROVED':
        return 'green';
      case 'AWAITING_APPROVAL':
        return 'blue';
      case 'IN_ASSESSMENT':
        return 'yellow';
      case 'REJECTED':
        return 'red';
      case 'IN_REVIEW':
        return 'purple';
      case 'EXIT_IN_PROGRESS':
        return 'orange';
      case 'DRAFT':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const handleStartReview = async () => {
    if (!supplier) return;
    try {
      await supplierApi.startReview(supplier.id);
      toast({
        title: 'Review started',
        status: 'success',
        duration: 3000,
      });
      fetchSupplier();
    } catch (error: any) {
      toast({
        title: 'Failed to start review',
        description: error.response?.data?.error || 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    }
  };

  if (loading) {
    return (
      <Center minH="400px">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box>
      <HStack mb={6} justify="space-between">
        <HStack>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/suppliers')}
            variant="ghost"
          />
          <Heading size="lg">
            {isNew ? 'Create Supplier' : supplier?.name || 'Supplier Details'}
          </Heading>
          {supplier && supplier.lifecycleState && (
            <Badge colorScheme={getLifecycleStateColor(supplier.lifecycleState)} fontSize="md" px={3} py={1}>
              {getLifecycleStateDisplayName(supplier.lifecycleState)}
            </Badge>
          )}
        </HStack>
        <HStack>
          {canEdit && supplier && supplier.lifecycleState === 'APPROVED' && (
            <Button
              colorScheme="purple"
              variant="outline"
              onClick={handleStartReview}
              size="sm"
            >
              Start Review
            </Button>
          )}
          {!isNew && !isEditing && canEdit && (
            <Button
              colorScheme="blue"
              onClick={() => {
                setIsEditing(true);
                setSearchParams({ mode: 'edit' });
              }}
            >
              Edit
            </Button>
          )}
          {isEditing && (
            <>
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setSearchParams({ mode: 'view' });
                    // Reload supplier data to discard changes
                    fetchSupplier();
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button colorScheme="blue" onClick={handleSave} isLoading={saving}>
                {isNew ? 'Create' : 'Save'}
              </Button>
            </>
          )}
        </HStack>
      </HStack>

      {supplier && !isNew && (
        <Box mb={4}>
          <SupplierApprovalPanel
            supplier={supplier}
            riskAssessments={riskAssessments}
            criticalityAssessments={criticalityAssessments}
            onApprovalComplete={fetchSupplier}
          />
        </Box>
      )}

      <Tabs>
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Risk & Criticality</Tab>
          <Tab>Risks & Controls</Tab>
          <Tab>Compliance & Reviews</Tab>
          <Tab>Contracts & Contacts</Tab>
          <Tab>Assessments</Tab>
          <Tab>Exit Plan</Tab>
          <Tab>Notes/History</Tab>
        </TabList>

        <TabPanels>
          {/* Tab 1: Summary */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="md" mb={4}>Identity</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Name</FormLabel>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      isReadOnly={!isEditing}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Trading Name</FormLabel>
                    <Input
                      value={formData.tradingName}
                      onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                      isReadOnly={!isEditing}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      isDisabled={!isEditing}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="IN_ONBOARDING">In Onboarding</option>
                      <option value="IN_EXIT">In Exit</option>
                      <option value="INACTIVE">Inactive</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Lifecycle State</FormLabel>
                    <Select
                      value={formData.lifecycleState}
                      onChange={(e) => setFormData({ ...formData, lifecycleState: e.target.value })}
                      isDisabled={!isEditing}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="IN_ASSESSMENT">In Assessment</option>
                      <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="EXIT_IN_PROGRESS">Exit In Progress</option>
                    </Select>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Current lifecycle state of the supplier onboarding process
                    </Text>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Supplier Type</FormLabel>
                    <Select
                      value={formData.supplierType}
                      onChange={(e) => setFormData({ ...formData, supplierType: e.target.value as any })}
                      isDisabled={!isEditing}
                    >
                      <option value="SERVICE_PROVIDER">Service Provider</option>
                      <option value="CONNECTED_ENTITY">Connected Entity</option>
                      <option value="PCI_SERVICE_PROVIDER">PCI Service Provider</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={formData.serviceSubType === 'SAAS'}
                      onChange={(e) => setFormData({ ...formData, serviceSubType: e.target.checked ? 'SAAS' : null })}
                      isDisabled={!isEditing}
                    >
                      Is this a SaaS supplier?
                    </Checkbox>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Check this box if the supplier provides Software as a Service
                    </Text>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Relationship Owner</FormLabel>
                    <Select
                      value={formData.relationshipOwnerUserId || ''}
                      onChange={(e) => setFormData({ ...formData, relationshipOwnerUserId: e.target.value || null })}
                      isDisabled={!isEditing}
                      placeholder="Select owner"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName} ({u.email})
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Service Profile</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                    <FormLabel>Service Description</FormLabel>
                    <Textarea
                      value={formData.serviceDescription}
                      onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                      isReadOnly={!isEditing}
                      rows={3}
                    />
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={formData.processesCardholderData}
                      onChange={(e) => setFormData({ ...formData, processesCardholderData: e.target.checked })}
                      isDisabled={!isEditing}
                    >
                      Processes Cardholder Data
                    </Checkbox>
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={formData.processesPersonalData}
                      onChange={(e) => setFormData({ ...formData, processesPersonalData: e.target.checked })}
                      isDisabled={!isEditing}
                    >
                      Processes Personal Data
                    </Checkbox>
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={formData.customerFacingImpact}
                      onChange={(e) => setFormData({ ...formData, customerFacingImpact: e.target.checked })}
                      isDisabled={!isEditing}
                    >
                      Customer Facing Impact
                    </Checkbox>
                  </FormControl>
                  <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                    <FormLabel>Hosting Regions</FormLabel>
                    <VStack align="stretch" spacing={2}>
                      {formData.hostingRegions.map((region, index) => (
                        <HStack key={index}>
                          <Input
                            value={region}
                            onChange={(e) => updateHostingRegion(index, e.target.value)}
                            isReadOnly={!isEditing}
                            placeholder="Region name"
                          />
                          {isEditing && (
                            <IconButton
                              aria-label="Remove region"
                              icon={<DeleteIcon />}
                              onClick={() => removeHostingRegion(index)}
                              size="sm"
                            />
                          )}
                        </HStack>
                      ))}
                      {isEditing && (
                        <Button leftIcon={<AddIcon />} size="sm" onClick={addHostingRegion}>
                          Add Region
                        </Button>
                      )}
                    </VStack>
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Risk & Criticality Snapshot</Heading>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>CIA Impact</FormLabel>
                    {supplier?.ciaImpact ? (
                      <Badge
                        colorScheme={
                          supplier.ciaImpact === 'HIGH' ? 'red' :
                          supplier.ciaImpact === 'MEDIUM' ? 'orange' :
                          'green'
                        }
                        fontSize="md"
                        px={3}
                        py={1}
                      >
                        {getCiaImpactDisplayName(supplier.ciaImpact)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">Not assessed</Text>
                    )}
                  </FormControl>
                  <FormControl>
                    <FormLabel>Risk Rating</FormLabel>
                    {supplier?.overallRiskRating ? (
                      <Badge
                        colorScheme={
                          supplier.overallRiskRating === 'HIGH' ? 'red' :
                          supplier.overallRiskRating === 'MEDIUM' ? 'orange' :
                          'green'
                        }
                        fontSize="md"
                        px={3}
                        py={1}
                      >
                        {getRiskRatingDisplayName(supplier.overallRiskRating)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">Not assessed</Text>
                    )}
                  </FormControl>
                  <FormControl>
                    <FormLabel>Criticality</FormLabel>
                    {supplier?.criticality ? (
                      <Badge
                        colorScheme={
                          supplier.criticality === 'HIGH' ? 'red' :
                          supplier.criticality === 'MEDIUM' ? 'orange' :
                          'green'
                        }
                        fontSize="md"
                        px={3}
                        py={1}
                      >
                        {getCriticalityDisplayName(supplier.criticality)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">Not assessed</Text>
                    )}
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Review Schedule</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Last Review Date</FormLabel>
                    {supplier?.lastReviewAt ? (
                      <Text>{new Date(supplier.lastReviewAt).toLocaleDateString()}</Text>
                    ) : (
                      <Text color="gray.400">Never reviewed</Text>
                    )}
                  </FormControl>
                  <FormControl>
                    <FormLabel>Next Review Date</FormLabel>
                    {supplier?.nextReviewAt ? (
                      <Text>
                        {new Date(supplier.nextReviewAt).toLocaleDateString()}
                        {reviewStatus?.reviewStatus?.isOverdue && (
                          <Badge colorScheme="red" ml={2}>
                            Overdue
                          </Badge>
                        )}
                        {reviewStatus?.reviewStatus?.daysUntilReview !== null &&
                          reviewStatus.reviewStatus.daysUntilReview <= 30 &&
                          !reviewStatus.reviewStatus.isOverdue && (
                            <Badge colorScheme="orange" ml={2}>
                              Due Soon
                            </Badge>
                          )}
                      </Text>
                    ) : (
                      <Text color="gray.400">Not scheduled</Text>
                    )}
                  </FormControl>
                </SimpleGrid>
              </Box>
            </VStack>
          </TabPanel>

          {/* Tab 2: Risk & Criticality */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Alert status="info">
                <AlertIcon />
                <Box>
                  <Text fontWeight="bold" mb={1}>Direct Editing vs Reviews vs Assessments</Text>
                  <Text fontSize="sm" mb={1}>
                    <strong>Direct Editing:</strong> Quick updates without review tracking. Use for minor corrections.
                  </Text>
                  <Text fontSize="sm" mb={1}>
                    <strong>Reviews:</strong> Periodic/annual updates that update all fields directly. Use for regular compliance checks.
                  </Text>
                  <Text fontSize="sm">
                    <strong>Assessments:</strong> Formal approval workflows. Use when you need approval for risk/criticality changes.
                  </Text>
                </Box>
              </Alert>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <FormControl>
                  <FormLabel>
                    CIA Impact
                    <Tooltip label="CIA stands for Confidentiality, Integrity, and Availability - the three core security principles">
                      <span style={{ marginLeft: '4px', cursor: 'help' }}>ℹ️</span>
                    </Tooltip>
                  </FormLabel>
                  <Select
                    value={formData.ciaImpact || ''}
                    onChange={(e) => setFormData({ ...formData, ciaImpact: e.target.value || null })}
                    isDisabled={!isEditing}
                  >
                    <option value="">Not assessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Risk Rating</FormLabel>
                  <Select
                    value={formData.overallRiskRating || ''}
                    onChange={(e) => setFormData({ ...formData, overallRiskRating: e.target.value || null })}
                    isDisabled={!isEditing}
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
                    value={formData.criticality || ''}
                    onChange={(e) => setFormData({ ...formData, criticality: e.target.value || null })}
                    isDisabled={!isEditing}
                  >
                    <option value="">Not assessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Risk Rationale</FormLabel>
                <Textarea
                  value={formData.riskRationale}
                  onChange={(e) => setFormData({ ...formData, riskRationale: e.target.value })}
                  isReadOnly={!isEditing}
                  rows={4}
                  placeholder="Explain the risk assessment rationale..."
                />
              </FormControl>

              <FormControl>
                <FormLabel>Criticality Rationale</FormLabel>
                <Textarea
                  value={formData.criticalityRationale}
                  onChange={(e) => setFormData({ ...formData, criticalityRationale: e.target.value })}
                  isReadOnly={!isEditing}
                  rows={4}
                  placeholder="Explain the criticality assessment rationale..."
                />
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Last Risk Assessment Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastRiskAssessmentAt}
                    onChange={(e) => setFormData({ ...formData, lastRiskAssessmentAt: e.target.value })}
                    isReadOnly={!isEditing}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Criticality Assessment Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastCriticalityAssessmentAt}
                    onChange={(e) => setFormData({ ...formData, lastCriticalityAssessmentAt: e.target.value })}
                    isReadOnly={!isEditing}
                  />
                </FormControl>
              </SimpleGrid>

              {/* Current Assessment Rationale Display */}
              {(supplier?.currentRiskAssessment || supplier?.currentCriticalityAssessment) && (
                <>
                  <Divider />
                  <Box>
                    <Heading size="sm" mb={3}>Current Assessment Details</Heading>
                    <Alert status="info" mb={3}>
                      <AlertIcon />
                      These values come from the most recent approved assessments. To view full assessment history or create new assessments, see the Assessments tab.
                    </Alert>
                    {supplier?.currentRiskAssessment && (
                      <Box p={3} bg="blue.50" borderRadius="md" mb={3}>
                        <Text fontSize="sm" fontWeight="bold" mb={1}>
                          Current Risk Assessment Rationale:
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          {supplier.currentRiskAssessment.rationale || 'No rationale provided'}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Approved: {new Date(supplier.currentRiskAssessment.approvedAt || supplier.currentRiskAssessment.assessedAt).toLocaleString()}
                        </Text>
                      </Box>
                    )}
                    {supplier?.currentCriticalityAssessment && (
                      <Box p={3} bg="green.50" borderRadius="md">
                        <Text fontSize="sm" fontWeight="bold" mb={1}>
                          Current Criticality Assessment Rationale:
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          {supplier.currentCriticalityAssessment.rationale || 'No rationale provided'}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Approved: {new Date(supplier.currentCriticalityAssessment.approvedAt || supplier.currentCriticalityAssessment.assessedAt).toLocaleString()}
                        </Text>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </VStack>
          </TabPanel>

          {/* Tab 3: Risks & Controls */}
          <TabPanel>
            {supplier && (
              <SupplierRisksControlsTab
                supplierId={supplier.id}
                canEdit={canEdit}
                criticality={supplier.criticality}
              />
            )}
          </TabPanel>

          {/* Tab 4: Compliance & Reviews */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>PCI Status</FormLabel>
                  <Select
                    value={formData.pciStatus || ''}
                    onChange={(e) => setFormData({ ...formData, pciStatus: e.target.value || null })}
                    isDisabled={!isEditing}
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
                    value={formData.iso27001Status || ''}
                    onChange={(e) => setFormData({ ...formData, iso27001Status: e.target.value || null })}
                    isDisabled={!isEditing}
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
                    value={formData.iso22301Status || ''}
                    onChange={(e) => setFormData({ ...formData, iso22301Status: e.target.value || null })}
                    isDisabled={!isEditing}
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
                    value={formData.iso9001Status || ''}
                    onChange={(e) => setFormData({ ...formData, iso9001Status: e.target.value || null })}
                    isDisabled={!isEditing}
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
                    value={formData.gdprStatus || ''}
                    onChange={(e) => setFormData({ ...formData, gdprStatus: e.target.value || null })}
                    isDisabled={!isEditing}
                  >
                    <option value="">Unknown</option>
                    <option value="ADEQUATE">Adequate</option>
                    <option value="HIGH_RISK">High Risk</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Last Compliance Review Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastComplianceReviewAt}
                    onChange={(e) => setFormData({ ...formData, lastComplianceReviewAt: e.target.value })}
                    isReadOnly={!isEditing}
                  />
                </FormControl>
              </SimpleGrid>

              {(user?.role === 'ADMIN' || user?.role === 'CISO') && (
                <FormControl>
                  <Checkbox
                    isChecked={formData.cisoExemptionGranted}
                    onChange={(e) => setFormData({ ...formData, cisoExemptionGranted: e.target.checked })}
                    isDisabled={!isEditing}
                  >
                    CISO Exemption Granted
                  </Checkbox>
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    When checked, allows approval of PCI Service Providers without PASS/NOT_APPLICABLE status
                  </Text>
                </FormControl>
              )}

              <FormControl>
                <FormLabel>Compliance Evidence Links</FormLabel>
                <VStack align="stretch" spacing={2}>
                  {formData.complianceEvidenceLinks.map((link, index) => (
                    <HStack key={index}>
                      <Input
                        value={link}
                        onChange={(e) => updateComplianceEvidenceLink(index, e.target.value)}
                        isReadOnly={!isEditing}
                        placeholder="URL to certificate or evidence (SharePoint or public website)"
                        flex={1}
                      />
                      {isEditing && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingEvidenceIndex(index);
                              onEvidenceBrowserOpen();
                            }}
                          >
                            Browse SharePoint
                          </Button>
                          <IconButton
                            aria-label="Remove link"
                            icon={<DeleteIcon />}
                            onClick={() => removeComplianceEvidenceLink(index)}
                            size="sm"
                          />
                        </>
                      )}
                    </HStack>
                  ))}
                  {isEditing && (
                    <Button leftIcon={<AddIcon />} size="sm" onClick={addComplianceEvidenceLink}>
                      Add Evidence Link
                    </Button>
                  )}
                </VStack>
              </FormControl>

              {/* Compliance Status & Evidence Links Section */}
              <Box>
                <Heading size="md" mb={4}>Compliance Status</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                  <FormControl>
                    <FormLabel>PCI Status</FormLabel>
                    <Badge
                      colorScheme={
                        supplier?.pciStatus === 'PASS'
                          ? 'green'
                          : supplier?.pciStatus === 'FAIL'
                          ? 'red'
                          : 'gray'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {supplier?.pciStatus || 'UNKNOWN'}
                    </Badge>
                  </FormControl>
                  <FormControl>
                    <FormLabel>ISO 27001 Status</FormLabel>
                    <Badge
                      colorScheme={
                        supplier?.iso27001Status === 'CERTIFIED'
                          ? 'green'
                          : supplier?.iso27001Status === 'NOT_CERTIFIED'
                          ? 'red'
                          : 'gray'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {supplier?.iso27001Status || 'UNKNOWN'}
                    </Badge>
                  </FormControl>
                  <FormControl>
                    <FormLabel>ISO 22301 Status</FormLabel>
                    <Badge
                      colorScheme={
                        supplier?.iso22301Status === 'CERTIFIED'
                          ? 'green'
                          : supplier?.iso22301Status === 'NOT_CERTIFIED'
                          ? 'red'
                          : 'gray'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {supplier?.iso22301Status || 'UNKNOWN'}
                    </Badge>
                  </FormControl>
                  <FormControl>
                    <FormLabel>ISO 9001 Status</FormLabel>
                    <Badge
                      colorScheme={
                        supplier?.iso9001Status === 'CERTIFIED'
                          ? 'green'
                          : supplier?.iso9001Status === 'NOT_CERTIFIED'
                          ? 'red'
                          : 'gray'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {supplier?.iso9001Status || 'UNKNOWN'}
                    </Badge>
                  </FormControl>
                  <FormControl>
                    <FormLabel>GDPR Status</FormLabel>
                    <Badge
                      colorScheme={
                        supplier?.gdprStatus === 'ADEQUATE'
                          ? 'green'
                          : supplier?.gdprStatus === 'HIGH_RISK'
                          ? 'red'
                          : 'gray'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                    >
                      {supplier?.gdprStatus || 'UNKNOWN'}
                    </Badge>
                  </FormControl>
                </SimpleGrid>

                {/* Compliance Evidence Links */}
                {supplier?.complianceEvidenceLinks && supplier.complianceEvidenceLinks.length > 0 && (
                  <Box mt={4}>
                    <Heading size="sm" mb={3}>Compliance Evidence Links</Heading>
                    <VStack align="stretch" spacing={2}>
                      {supplier.complianceEvidenceLinks.map((link: string, index: number) => (
                        <Box
                          key={index}
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          borderColor="gray.200"
                        >
                          <HStack>
                            <Text fontSize="sm" flex={1} wordBreak="break-all">
                              {link}
                            </Text>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => window.open(link, '_blank')}
                            >
                              Open
                            </Button>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}
              </Box>

              <Divider />

              {/* Compliance Reviews Section */}
              <Box>
                <HStack justify="space-between" mb={4}>
                  <Heading size="md">Compliance Reviews</Heading>
                  {canEdit && (
                    <Button
                      leftIcon={<AddIcon />}
                      colorScheme="blue"
                      size="sm"
                      onClick={onReviewModalOpen}
                    >
                      Create Review
                    </Button>
                  )}
                </HStack>
                <Alert status="info" mb={4}>
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold" mb={1}>Compliance Reviews</Text>
                    <Text fontSize="sm">
                      Use reviews for periodic/annual updates that directly update supplier data. Reviews update all fields immediately when completed.
                    </Text>
                  </Box>
                </Alert>

                {complianceReviews.length === 0 ? (
                  <Text color="gray.500" fontStyle="italic">
                    No compliance reviews recorded
                  </Text>
                ) : (
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Planned Date</Th>
                        <Th>Completed Date</Th>
                        <Th>Type</Th>
                        <Th>Outcome</Th>
                        <Th>Reviewer</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {complianceReviews.map((review) => (
                        <Tr key={review.id}>
                          <Td>{new Date(review.plannedAt).toLocaleDateString()}</Td>
                          <Td>
                            {review.completedAt
                              ? new Date(review.completedAt).toLocaleDateString()
                              : 'Pending'}
                          </Td>
                          <Td>{review.reviewType.replace(/_/g, ' ')}</Td>
                          <Td>
                            {review.outcome ? (
                              <Badge
                                colorScheme={
                                  review.outcome === 'PASS'
                                    ? 'green'
                                    : review.outcome === 'ISSUES_FOUND'
                                    ? 'orange'
                                    : 'red'
                                }
                              >
                                {review.outcome}
                              </Badge>
                            ) : (
                              'N/A'
                            )}
                          </Td>
                          <Td>{review.reviewedBy?.displayName || 'N/A'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </Box>

              {/* Certificates Section */}
              <Box>
                <HStack justify="space-between" mb={4}>
                  <Heading size="md">Certificates</Heading>
                  {canEdit && (
                    <Button
                      leftIcon={<AddIcon />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() => {
                        // TODO: Open create certificate modal
                        toast({
                          title: 'Coming Soon',
                          description: 'Add certificate functionality will be added',
                          status: 'info',
                          duration: 3000,
                        });
                      }}
                    >
                      Add Certificate
                    </Button>
                  )}
                </HStack>

                {certificates.length === 0 ? (
                  <Text color="gray.500" fontStyle="italic">
                    No certificates recorded
                  </Text>
                ) : (
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Type</Th>
                        <Th>Certificate Number</Th>
                        <Th>Issuer</Th>
                        <Th>Issue Date</Th>
                        <Th>Expiry Date</Th>
                        <Th>Status</Th>
                        <Th>Evidence Link</Th>
                        {canEdit && <Th>Actions</Th>}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {certificates.map((cert) => {
                        const expiryDate = new Date(cert.expiryDate);
                        const now = new Date();
                        const daysUntilExpiry = Math.ceil(
                          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const isExpired = expiryDate < now;
                        const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

                        return (
                          <Tr key={cert.id}>
                            <Td>{cert.certificateType}</Td>
                            <Td>{cert.certificateNumber || 'N/A'}</Td>
                            <Td>{cert.issuer || 'N/A'}</Td>
                            <Td>
                              {cert.issueDate
                                ? new Date(cert.issueDate).toLocaleDateString()
                                : 'N/A'}
                            </Td>
                            <Td>{new Date(cert.expiryDate).toLocaleDateString()}</Td>
                            <Td>
                              <Badge
                                colorScheme={
                                  isExpired
                                    ? 'red'
                                    : isExpiringSoon
                                    ? 'orange'
                                    : 'green'
                                }
                              >
                                {isExpired
                                  ? 'Expired'
                                  : isExpiringSoon
                                  ? `Expires in ${daysUntilExpiry} days`
                                  : 'Valid'}
                              </Badge>
                            </Td>
                            <Td>
                              {cert.evidenceLink ? (
                                <HStack spacing={2}>
                                  <Text fontSize="sm" isTruncated maxW="200px">
                                    <a href={cert.evidenceLink} target="_blank" rel="noopener noreferrer">
                                      {cert.evidenceLink}
                                    </a>
                                  </Text>
                                  {canEdit && (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingCertificateId(cert.id);
                                        onCertificateEvidenceBrowserOpen();
                                      }}
                                    >
                                      Browse SharePoint
                                    </Button>
                                  )}
                                </HStack>
                              ) : (
                                canEdit ? (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCertificateId(cert.id);
                                      onCertificateEvidenceBrowserOpen();
                                    }}
                                  >
                                    Add Evidence Link
                                  </Button>
                                ) : (
                                  <Text fontSize="sm" color="gray.400">None</Text>
                                )
                              )}
                            </Td>
                            {canEdit && (
                              <Td>
                                <IconButton
                                  aria-label="Delete certificate"
                                  icon={<DeleteIcon />}
                                  size="sm"
                                  colorScheme="red"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (
                                      window.confirm(
                                        'Are you sure you want to delete this certificate?'
                                      )
                                    ) {
                                      try {
                                        await supplierApi.deleteCertificate(
                                          supplier!.id,
                                          cert.id
                                        );
                                        toast({
                                          title: 'Success',
                                          description: 'Certificate deleted',
                                          status: 'success',
                                          duration: 3000,
                                        });
                                        fetchSupplier();
                                      } catch (error: any) {
                                        toast({
                                          title: 'Error',
                                          description: 'Failed to delete certificate',
                                          status: 'error',
                                          duration: 3000,
                                        });
                                      }
                                    }
                                  }}
                                />
                              </Td>
                            )}
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                )}
              </Box>

              {/* Review Status Section */}
              {reviewStatus && (
                <Box>
                  <Heading size="md" mb={4}>
                    Review Status
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Next Review Date
                      </Text>
                      <Text fontWeight="bold">
                        {reviewStatus.supplier.nextReviewAt
                          ? new Date(reviewStatus.supplier.nextReviewAt).toLocaleDateString()
                          : 'Not scheduled'}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Last Review Date
                      </Text>
                      <Text fontWeight="bold">
                        {reviewStatus.supplier.lastReviewAt
                          ? new Date(reviewStatus.supplier.lastReviewAt).toLocaleDateString()
                          : 'Never'}
                      </Text>
                    </Box>
                    {reviewStatus.reviewStatus.daysUntilReview !== null && (
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Days Until Review
                        </Text>
                        <Text fontWeight="bold">
                          {reviewStatus.reviewStatus.daysUntilReview} days
                        </Text>
                      </Box>
                    )}
                    {reviewStatus.openTasks && reviewStatus.openTasks.length > 0 && (
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Open Review Tasks
                        </Text>
                        <Text fontWeight="bold">{reviewStatus.openTasks.length}</Text>
                      </Box>
                    )}
                  </SimpleGrid>
                </Box>
              )}

              {/* Warnings */}
              {formData.performanceRating === 'BAD' && (
                <Alert status="error">
                  <AlertIcon />
                  Performance rating is BAD - immediate attention required
                </Alert>
              )}
              {formData.pciStatus === 'FAIL' && (
                <Alert status="error">
                  <AlertIcon />
                  PCI Status is FAIL - compliance issue
                </Alert>
              )}
              {certificates.some((cert) => {
                const expiryDate = new Date(cert.expiryDate);
                return expiryDate < new Date();
              }) && (
                <Alert status="error">
                  <AlertIcon />
                  One or more certificates have expired
                </Alert>
              )}
              {certificates.some((cert) => {
                const expiryDate = new Date(cert.expiryDate);
                const now = new Date();
                const daysUntilExpiry = Math.ceil(
                  (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );
                return !(expiryDate < now) && daysUntilExpiry <= 30;
              }) && (
                <Alert status="warning">
                  <AlertIcon />
                  One or more certificates are expiring within 30 days
                </Alert>
              )}
            </VStack>
          </TabPanel>

          {/* Tab 5: Contracts & Contacts */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="md" mb={4}>Contracts</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Data Processing Agreement Reference</FormLabel>
                    <Input
                      value={formData.dataProcessingAgreementRef}
                      onChange={(e) => setFormData({ ...formData, dataProcessingAgreementRef: e.target.value })}
                      isReadOnly={!isEditing}
                      placeholder="DPA reference or link"
                    />
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={formData.autoRenewal}
                      onChange={(e) => setFormData({ ...formData, autoRenewal: e.target.checked })}
                      isDisabled={!isEditing}
                    >
                      Auto Renewal
                    </Checkbox>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Contract Start Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.contractStartDate}
                      onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                      isReadOnly={!isEditing}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Contract End Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.contractEndDate}
                      onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                      isReadOnly={!isEditing}
                    />
                  </FormControl>
                  <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                    <FormLabel>Contract References</FormLabel>
                    <VStack align="stretch" spacing={2}>
                      {formData.contractReferences.map((ref, index) => (
                        <HStack key={index}>
                          <Input
                            value={ref}
                            onChange={(e) => updateContractReference(index, e.target.value)}
                            isReadOnly={!isEditing}
                            placeholder="Contract reference, ID, or SharePoint URL"
                          />
                          {isEditing && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditingContractIndex(index);
                                  onContractBrowserOpen();
                                }}
                              >
                                Browse SharePoint
                              </Button>
                              <IconButton
                                aria-label="Remove reference"
                                icon={<DeleteIcon />}
                                onClick={() => removeContractReference(index)}
                                size="sm"
                              />
                            </>
                          )}
                        </HStack>
                      ))}
                      {isEditing && (
                        <HStack>
                          <Button leftIcon={<AddIcon />} size="sm" onClick={addContractReference}>
                            Add Contract Reference
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingContractIndex(null);
                              onContractBrowserOpen();
                            }}
                          >
                            Browse SharePoint
                          </Button>
                        </HStack>
                      )}
                    </VStack>
                  </FormControl>
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Flex justify="space-between" align="center" mb={4}>
                  <Heading size="md">Primary Contacts</Heading>
                  {isEditing && (
                    <Button leftIcon={<AddIcon />} size="sm" onClick={addContact}>
                      Add Contact
                    </Button>
                  )}
                </Flex>
                {formData.primaryContacts.length === 0 ? (
                  <Text color="gray.500">No contacts added</Text>
                ) : (
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Role</Th>
                          <Th>Email</Th>
                          <Th>Phone</Th>
                          <Th>Notes</Th>
                          {isEditing && <Th>Actions</Th>}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {formData.primaryContacts.map((contact, index) => (
                          <Tr key={index}>
                            <Td>
                              {isEditing ? (
                                <Input
                                  value={contact.name}
                                  onChange={(e) => updateContact(index, 'name', e.target.value)}
                                  size="sm"
                                />
                              ) : (
                                contact.name || '-'
                              )}
                            </Td>
                            <Td>
                              {isEditing ? (
                                <Input
                                  value={contact.role}
                                  onChange={(e) => updateContact(index, 'role', e.target.value)}
                                  size="sm"
                                />
                              ) : (
                                contact.role || '-'
                              )}
                            </Td>
                            <Td>
                              {isEditing ? (
                                <Input
                                  value={contact.email}
                                  onChange={(e) => updateContact(index, 'email', e.target.value)}
                                  size="sm"
                                  type="email"
                                />
                              ) : (
                                contact.email || '-'
                              )}
                            </Td>
                            <Td>
                              {isEditing ? (
                                <Input
                                  value={contact.phone}
                                  onChange={(e) => updateContact(index, 'phone', e.target.value)}
                                  size="sm"
                                />
                              ) : (
                                contact.phone || '-'
                              )}
                            </Td>
                            <Td>
                              {isEditing ? (
                                <Input
                                  value={contact.notes}
                                  onChange={(e) => updateContact(index, 'notes', e.target.value)}
                                  size="sm"
                                />
                              ) : (
                                contact.notes || '-'
                              )}
                            </Td>
                            {isEditing && (
                              <Td>
                                <IconButton
                                  aria-label="Remove contact"
                                  icon={<DeleteIcon />}
                                  onClick={() => removeContact(index)}
                                  size="sm"
                                  colorScheme="red"
                                />
                              </Td>
                            )}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </Box>
            </VStack>
          </TabPanel>

          {/* Tab 6: Assessments */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              {supplier && (
                <>
                  <Alert status="info">
                    <AlertIcon />
                    <Box>
                      <Text fontWeight="bold" mb={1}>Formal Assessments</Text>
                      <Text fontSize="sm">
                        Assessments are formal approval workflows (DRAFT → SUBMITTED → APPROVED/REJECTED). 
                        Use assessments when you need formal approval for risk/criticality changes, especially during onboarding or major changes.
                        Approved assessments automatically update supplier snapshot fields.
                      </Text>
                    </Box>
                  </Alert>
                  <Box>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>
                      Latest Assessments
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {supplier.currentRiskAssessment && (
                        <Box p={4} borderWidth="1px" borderRadius="md">
                          <Text fontWeight="bold" mb={2}>Current Risk Assessment</Text>
                          <Text fontSize="sm">CIA Impact: {supplier.currentRiskAssessment.ciaImpact}</Text>
                          <Text fontSize="sm">Risk Rating: {supplier.currentRiskAssessment.riskRating}</Text>
                          <Text fontSize="sm" color="gray.600" mt={2}>
                            Approved: {new Date(supplier.currentRiskAssessment.approvedAt || supplier.currentRiskAssessment.assessedAt).toLocaleString()}
                          </Text>
                        </Box>
                      )}
                      {supplier.currentCriticalityAssessment && (
                        <Box p={4} borderWidth="1px" borderRadius="md">
                          <Text fontWeight="bold" mb={2}>Current Criticality Assessment</Text>
                          <Text fontSize="sm">Criticality: {supplier.currentCriticalityAssessment.criticality}</Text>
                          <Text fontSize="sm" color="gray.600" mt={2}>
                            Approved: {new Date(supplier.currentCriticalityAssessment.approvedAt || supplier.currentCriticalityAssessment.assessedAt).toLocaleString()}
                          </Text>
                        </Box>
                      )}
                    </SimpleGrid>
                  </Box>

                  <Box>
                    <Text fontSize="lg" fontWeight="bold" mb={4}>
                      Assessment History
                    </Text>
                    <SupplierAssessmentTimeline 
                      timeline={assessmentHistory}
                      supplierId={supplier.id}
                      canEdit={canEdit}
                      onAssessmentUpdated={() => {
                        fetchSupplier();
                        // Refresh assessment history
                        if (supplier) {
                          Promise.all([
                            supplierApi.getRiskAssessments(supplier.id),
                            supplierApi.getCriticalityAssessments(supplier.id),
                          ]).then(([riskAssessments, criticalityAssessments]) => {
                            setRiskAssessments(riskAssessments);
                            setCriticalityAssessments(criticalityAssessments);
                            // Build timeline
                            const timeline: any[] = [];
                            riskAssessments.forEach((assessment: any) => {
                              timeline.push({
                                type: 'RISK_ASSESSMENT',
                                id: assessment.id,
                                createdAt: assessment.createdAt,
                                updatedAt: assessment.updatedAt,
                                status: assessment.status,
                                assessedBy: assessment.assessedBy,
                                approvedBy: assessment.approvedBy,
                                approvedAt: assessment.approvedAt,
                                data: {
                                  ciaImpact: assessment.ciaImpact,
                                  riskRating: assessment.riskRating,
                                  rationale: assessment.rationale,
                                  rejectionReason: assessment.rejectionReason,
                                },
                              });
                            });
                            criticalityAssessments.forEach((assessment: any) => {
                              timeline.push({
                                type: 'CRITICALITY_ASSESSMENT',
                                id: assessment.id,
                                createdAt: assessment.createdAt,
                                updatedAt: assessment.updatedAt,
                                status: assessment.status,
                                assessedBy: assessment.assessedBy,
                                approvedBy: assessment.approvedBy,
                                approvedAt: assessment.approvedAt,
                                data: {
                                  criticality: assessment.criticality,
                                  rationale: assessment.rationale,
                                  rejectionReason: assessment.rejectionReason,
                                },
                              });
                            });
                            timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                            setAssessmentHistory(timeline);
                          }).catch(console.error);
                        }
                      }}
                    />
                  </Box>
                </>
              )}
            </VStack>
          </TabPanel>

          {/* Tab 7: Exit Plan */}
          <TabPanel>
            {supplier && (
              <SupplierExitPlanTab
                supplierId={supplier.id}
                canEdit={canEdit}
                lifecycleState={supplier.lifecycleState}
              />
            )}
          </TabPanel>

          {/* Tab 8: Notes/History */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Performance Rating</FormLabel>
                  <Select
                    value={formData.performanceRating || ''}
                    onChange={(e) => setFormData({ ...formData, performanceRating: e.target.value || null })}
                    isDisabled={!isEditing}
                  >
                    <option value="">Not rated</option>
                    <option value="GOOD">Good</option>
                    <option value="CAUTION">Caution</option>
                    <option value="BAD">Bad</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Performance Notes</FormLabel>
                <Textarea
                  value={formData.performanceNotes}
                  onChange={(e) => setFormData({ ...formData, performanceNotes: e.target.value })}
                  isReadOnly={!isEditing}
                  rows={6}
                  placeholder="Add notes about supplier performance..."
                />
              </FormControl>

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Change History</Heading>
                <VStack align="stretch" spacing={3}>
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium">Created</Text>
                    <Text fontSize="sm" color="gray.600">
                      {supplier?.createdAt
                        ? new Date(supplier.createdAt).toLocaleString()
                        : 'Not available'}
                    </Text>
                    {supplier?.createdBy && (
                      <Text fontSize="sm" color="gray.600">
                        by {supplier.createdBy.displayName} ({supplier.createdBy.email})
                      </Text>
                    )}
                  </Box>
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium">Last Updated</Text>
                    <Text fontSize="sm" color="gray.600">
                      {supplier?.updatedAt
                        ? new Date(supplier.updatedAt).toLocaleString()
                        : 'Not available'}
                    </Text>
                    {supplier?.updatedBy && (
                      <Text fontSize="sm" color="gray.600">
                        by {supplier.updatedBy.displayName} ({supplier.updatedBy.email})
                      </Text>
                    )}
                  </Box>
                </VStack>
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Review Modal */}
      {supplier && (
        <SupplierReviewModal
          isOpen={isReviewModalOpen}
          onClose={onReviewModalClose}
          supplierId={supplier.id}
          currentSupplier={{
            ciaImpact: supplier.ciaImpact,
            overallRiskRating: supplier.overallRiskRating,
            criticality: supplier.criticality,
            riskRationale: supplier.riskRationale,
            criticalityRationale: supplier.criticalityRationale,
            pciStatus: supplier.pciStatus,
            iso27001Status: supplier.iso27001Status,
            iso22301Status: supplier.iso22301Status,
            iso9001Status: supplier.iso9001Status,
            gdprStatus: supplier.gdprStatus,
            performanceRating: supplier.performanceRating,
            complianceEvidenceLinks: supplier.complianceEvidenceLinks,
            lastRiskAssessmentAt: supplier.lastRiskAssessmentAt,
            lastCriticalityAssessmentAt: supplier.lastCriticalityAssessmentAt,
            lastComplianceReviewAt: supplier.lastReviewAt,
            supplierType: supplier.supplierType,
          }}
          onReviewCreated={() => {
            fetchSupplier();
            // Refresh compliance reviews
            if (supplier) {
              supplierApi.getComplianceReviews(supplier.id).then(setComplianceReviews).catch(console.error);
            }
          }}
        />
      )}

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

      {/* SharePoint File Browser for Certificate Evidence Links */}
      <SharePointFileBrowser
        isOpen={isCertificateEvidenceBrowserOpen}
        onClose={() => {
          onCertificateEvidenceBrowserClose();
          setEditingCertificateId(null);
        }}
        onSelect={async (item) => {
          if (editingCertificateId && supplier) {
            try {
              await supplierApi.updateCertificate(supplier.id, editingCertificateId, {
                evidenceLink: item.webUrl,
              });
              toast({
                title: 'Success',
                description: 'Certificate evidence link updated',
                status: 'success',
                duration: 3000,
              });
              fetchSupplier();
            } catch (error: any) {
              toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to update certificate evidence link',
                status: 'error',
                duration: 3000,
              });
            }
          }
          onCertificateEvidenceBrowserClose();
          setEditingCertificateId(null);
        }}
      />

      {/* SharePoint File Browser for Contract References */}
      <SharePointFileBrowser
        isOpen={isContractBrowserOpen}
        onClose={() => {
          onContractBrowserClose();
          setEditingContractIndex(null);
        }}
        onSelect={handleContractFileSelect}
      />
    </Box>
  );
}

