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
import { ArrowBackIcon, DeleteIcon, AddIcon, InfoIcon } from '@chakra-ui/icons';
import { supplierApi } from '../services/api';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, SupplierContact } from '../types/supplier';
import {
  getLifecycleStateDisplayName,
} from '../types/supplier';
import { SupplierRisksControlsTab } from '../components/SupplierRisksControlsTab';
import { SupplierExitPlanTab } from '../components/SupplierExitPlanTab';
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
  const { isOpen: isEvidenceBrowserOpen, onOpen: onEvidenceBrowserOpen, onClose: onEvidenceBrowserClose } = useDisclosure();
  const { isOpen: isContractBrowserOpen, onOpen: onContractBrowserOpen, onClose: onContractBrowserClose } = useDisclosure();
  const [editingContractIndex, setEditingContractIndex] = useState<number | null>(null);
  const [editingEvidenceIndex, setEditingEvidenceIndex] = useState<number | null>(null);
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
    overallRiskRating: null as string | null,
    criticality: null as string | null,
    riskRationale: '',
    criticalityRationale: '',
    pciStatus: null as string | null,
    iso27001Status: null as string | null,
    iso22301Status: null as string | null,
    iso9001Status: null as string | null,
    gdprStatus: null as string | null,
    reviewDate: '',
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
  }, [id, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

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
        overallRiskRating: data.overallRiskRating,
        criticality: data.criticality,
        riskRationale: data.riskRationale || '',
        criticalityRationale: data.criticalityRationale || '',
        pciStatus: data.pciStatus,
        iso27001Status: data.iso27001Status,
        iso22301Status: data.iso22301Status,
        iso9001Status: data.iso9001Status,
        gdprStatus: data.gdprStatus,
        reviewDate: data.reviewDate ? new Date(data.reviewDate).toISOString().split('T')[0] : '',
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
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to fetch supplier';
      toast({
        title: 'Error',
        description: errorMessage,
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
      const dataToSave: Partial<Supplier> = {
        ...formData,
        hostingRegions: formData.hostingRegions.filter(r => r.trim()),
        complianceEvidenceLinks: formData.complianceEvidenceLinks.filter(l => l.trim()),
        contractReferences: formData.contractReferences.filter(r => r.trim()),
        primaryContacts: formData.primaryContacts.filter(c => c.name.trim()),
        reviewDate: formData.reviewDate && formData.reviewDate.trim() !== '' ? formData.reviewDate : null,
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
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save supplier';
      toast({
        title: 'Error',
        description: errorMessage,
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

  const handleContractFileSelect = (item: { webUrl: string }) => {
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

  const isUrl = (str: string): boolean => {
    if (!str || !str.trim()) return false;
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
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

      <Tabs>
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Supplier Assessment</Tab>
          <Tab>ISMS Risks & Controls</Tab>
          <Tab>Compliance</Tab>
          <Tab>Contracts & Contacts</Tab>
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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Supplier['status'] })}
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
                      onChange={(e) => setFormData({ ...formData, supplierType: e.target.value as Supplier['supplierType'] })}
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
                  <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                    <HStack spacing={2} mb={2}>
                      <FormLabel mb={0}>Regions</FormLabel>
                      <Tooltip
                        label="Regions where the supplier operates, provides services, or hosts for us"
                        fontSize="sm"
                        hasArrow
                      >
                        <InfoIcon color="gray.500" boxSize={4} />
                      </Tooltip>
                    </HStack>
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

            </VStack>
          </TabPanel>

          {/* Tab 2: Supplier Assessment */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Data Processing & Impact</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
                </SimpleGrid>
              </Box>

              <Divider />

              <Box>
                <Heading size="md" mb={4}>Review Date</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Last Review Date</FormLabel>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={formData.reviewDate}
                        onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                      />
                    ) : (
                      supplier?.reviewDate ? (
                        <Text>{new Date(supplier.reviewDate).toLocaleDateString()}</Text>
                      ) : (
                        <Text color="gray.400">Not set</Text>
                      )
                    )}
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Update this date when you perform a review of the supplier
                    </Text>
                  </FormControl>
                </SimpleGrid>
              </Box>

            </VStack>
          </TabPanel>

          {/* Tab 3: ISMS Risks & Controls */}
          <TabPanel>
            {supplier && (
              <SupplierRisksControlsTab
                supplierId={supplier.id}
                canEdit={canEdit}
                criticality={supplier.criticality}
              />
            )}
          </TabPanel>

          {/* Tab 4: Compliance */}
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
              </SimpleGrid>

              {(user?.role === 'ADMIN' || (user?.role as string) === 'CISO') && (
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
                      {isEditing ? (
                        <Input
                          value={link}
                          onChange={(e) => updateComplianceEvidenceLink(index, e.target.value)}
                          placeholder="URL to certificate or evidence (SharePoint or public website)"
                          flex={1}
                        />
                      ) : (
                        <Box flex={1} p={2} borderWidth="1px" borderRadius="md" borderColor="gray.200">
                          {link ? (
                            isUrl(link) ? (
                              <Text fontSize="sm" wordBreak="break-all">
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#3182ce', textDecoration: 'underline' }}
                                >
                                  {link}
                                </a>
                              </Text>
                            ) : (
                              <Text fontSize="sm" wordBreak="break-all">{link}</Text>
                            )
                          ) : (
                            <Text fontSize="sm" color="gray.400">No link</Text>
                          )}
                        </Box>
                      )}
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
                    <HStack>
                      <Button leftIcon={<AddIcon />} size="sm" onClick={addComplianceEvidenceLink}>
                        Add Evidence Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingEvidenceIndex(null);
                          onEvidenceBrowserOpen();
                        }}
                      >
                        Browse SharePoint
                      </Button>
                    </HStack>
                  )}
                </VStack>
              </FormControl>


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
                    {isEditing ? (
                      <Input
                        value={formData.dataProcessingAgreementRef}
                        onChange={(e) => setFormData({ ...formData, dataProcessingAgreementRef: e.target.value })}
                        placeholder="DPA reference or link"
                      />
                    ) : (
                      formData.dataProcessingAgreementRef ? (
                        isUrl(formData.dataProcessingAgreementRef) ? (
                          <Text fontSize="md">
                            <a
                              href={formData.dataProcessingAgreementRef}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#3182ce', textDecoration: 'underline' }}
                            >
                              {formData.dataProcessingAgreementRef}
                            </a>
                          </Text>
                        ) : (
                          <Text fontSize="md">{formData.dataProcessingAgreementRef}</Text>
                        )
                      ) : (
                        <Text fontSize="md" color="gray.400">Not provided</Text>
                      )
                    )}
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
                          {isEditing ? (
                            <Input
                              value={ref}
                              onChange={(e) => updateContractReference(index, e.target.value)}
                              placeholder="Contract reference, ID, or SharePoint URL"
                              flex={1}
                            />
                          ) : (
                            <Box flex={1} p={2} borderWidth="1px" borderRadius="md" borderColor="gray.200">
                              {ref ? (
                                isUrl(ref) ? (
                                  <Text fontSize="sm" wordBreak="break-all">
                                    <a
                                      href={ref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: '#3182ce', textDecoration: 'underline' }}
                                    >
                                      {ref}
                                    </a>
                                  </Text>
                                ) : (
                                  <Text fontSize="sm" wordBreak="break-all">{ref}</Text>
                                )
                              ) : (
                                <Text fontSize="sm" color="gray.400">No reference</Text>
                              )}
                            </Box>
                          )}
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

          {/* Tab 6: Exit Plan */}
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

