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
  Box,
  HStack,
  FormErrorMessage,
  useToast,
  IconButton,
  Tooltip,
  Text,
  Tag,
  TagLabel,
  TagCloseButton,
  InputGroup,
  InputLeftElement,
  Spinner,
  Alert,
  AlertIcon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Card,
  CardBody,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  risk: any;
  isDuplicateMode?: boolean;
  viewMode?: boolean;
}

interface User {
  id: string;
  displayName: string;
  email: string;
  role?: string;
}

interface Control {
  id: string;
  code: string;
  title: string;
  description: string | null;
}

const RISK_TYPES = [
  'INFORMATION_SECURITY',
  'OPERATIONAL',
  'FINANCIAL',
  'COMPLIANCE',
  'REPUTATIONAL',
  'STRATEGIC',
  'OTHER',
];

const TREATMENT_CATEGORIES = ['RETAIN', 'MODIFY', 'SHARE', 'AVOID'];

export function RiskFormModal({ isOpen, onClose, risk, isDuplicateMode = false, viewMode = false }: RiskFormModalProps) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [suggestedControls, setSuggestedControls] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dateAdded: new Date().toISOString().split('T')[0],
    riskType: '',
    ownerUserId: '',
    assetCategory: '',
    interestedParty: '',
    threatDescription: '',
    confidentialityScore: 1,
    integrityScore: 1,
    availabilityScore: 1,
    riskScore: null as number | null,
    likelihood: 1,
    initialRiskTreatmentCategory: '',
    mitigatedConfidentialityScore: null as number | null,
    mitigatedIntegrityScore: null as number | null,
    mitigatedAvailabilityScore: null as number | null,
    mitigatedRiskScore: null as number | null,
    mitigatedLikelihood: null as number | null,
    mitigationImplemented: false,
    mitigationDescription: '',
    residualRiskTreatmentCategory: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<any>(null);

  // Calculate Risk = C + I + A (sum)
  const calculatedRisk = formData.confidentialityScore + formData.integrityScore + formData.availabilityScore;

  // Calculate Risk Score = Risk × Likelihood
  const calculatedRiskScore = calculatedRisk * formData.likelihood;

  // Get risk level and color based on score (per framework: Low=3-14, Medium=15-35, High=36-75)
  const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (score >= 36) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  };

  const getRiskLevelColor = (level: 'LOW' | 'MEDIUM' | 'HIGH'): string => {
    switch (level) {
      case 'HIGH':
        return 'red';
      case 'MEDIUM':
        return 'yellow';
      case 'LOW':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getScoreLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Very Low';
      case 2:
        return 'Low';
      case 3:
        return 'Medium';
      case 4:
        return 'High';
      case 5:
        return 'Very High';
      default:
        return '';
    }
  };

  const getScoreLabelColor = (value: number): string => {
    switch (value) {
      case 1:
      case 2:
        return 'green';
      case 3:
        return 'yellow';
      case 4:
      case 5:
        return 'red';
      default:
        return 'gray';
    }
  };

  const riskLevel = getRiskLevel(calculatedRiskScore);
  const riskLevelColor = getRiskLevelColor(riskLevel);

  // Calculate Mitigated Risk = MC + MI + MA (sum)
  const mitigatedRisk =
    formData.mitigatedConfidentialityScore !== null &&
    formData.mitigatedIntegrityScore !== null &&
    formData.mitigatedAvailabilityScore !== null
      ? formData.mitigatedConfidentialityScore +
        formData.mitigatedIntegrityScore +
        formData.mitigatedAvailabilityScore
      : null;

  // Calculate Mitigated Risk Score = Mitigated Risk × Mitigated Likelihood
  const mitigatedRiskScore =
    mitigatedRisk !== null && formData.mitigatedLikelihood !== null
      ? mitigatedRisk * formData.mitigatedLikelihood
      : null;

  // Get mitigated risk level and color
  const mitigatedRiskLevel = mitigatedRiskScore !== null ? getRiskLevel(mitigatedRiskScore) : null;
  const mitigatedRiskLevelColor = mitigatedRiskLevel ? getRiskLevelColor(mitigatedRiskLevel) : 'gray';

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchControls();
      let initialData: any;
      if (risk) {
        initialData = {
          title: risk.title || '',
          description: risk.description || '',
          dateAdded: risk.dateAdded
            ? new Date(risk.dateAdded).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          riskType: risk.riskType || '',
          ownerUserId: risk.ownerUserId || '',
          assetCategory: risk.assetCategory || '',
          interestedParty: risk.interestedParty || '',
          threatDescription: risk.threatDescription || '',
          confidentialityScore: risk.confidentialityScore || 1,
          integrityScore: risk.integrityScore || 1,
          availabilityScore: risk.availabilityScore || 1,
          riskScore: risk.riskScore || null,
          likelihood: risk.likelihood || 1,
          initialRiskTreatmentCategory: risk.initialRiskTreatmentCategory || '',
          mitigatedConfidentialityScore: risk.mitigatedConfidentialityScore || null,
          mitigatedIntegrityScore: risk.mitigatedIntegrityScore || null,
          mitigatedAvailabilityScore: risk.mitigatedAvailabilityScore || null,
          mitigatedRiskScore: risk.mitigatedRiskScore || null,
          mitigatedLikelihood: risk.mitigatedLikelihood || null,
          mitigationImplemented: risk.mitigationImplemented || false,
          mitigationDescription: risk.mitigationDescription || '',
          residualRiskTreatmentCategory: risk.residualRiskTreatmentCategory || '',
        };
        setFormData(initialData);
        // Load existing control associations
        if (risk.riskControls && risk.riskControls.length > 0) {
          setSelectedControlIds(risk.riskControls.map((rc: any) => rc.control.id));
        } else {
          setSelectedControlIds([]);
        }
      } else {
        initialData = {
          title: '',
          description: '',
          dateAdded: new Date().toISOString().split('T')[0],
          riskType: '',
          ownerUserId: '',
          assetCategory: '',
          interestedParty: '',
          threatDescription: '',
          confidentialityScore: 1,
          integrityScore: 1,
          availabilityScore: 1,
          riskScore: null,
          likelihood: 1,
          initialRiskTreatmentCategory: '',
          mitigatedConfidentialityScore: null,
          mitigatedIntegrityScore: null,
          mitigatedAvailabilityScore: null,
          mitigatedRiskScore: null,
          mitigatedLikelihood: null,
          mitigationImplemented: false,
          mitigationDescription: '',
          residualRiskTreatmentCategory: '',
        };
        setFormData(initialData);
        setSelectedControlIds([]);
      }
        const initialControlIds = risk && risk.riskControls && risk.riskControls.length > 0
          ? risk.riskControls.map((rc: any) => rc.control.id).sort()
          : [];
        initialFormDataRef.current = JSON.stringify({ 
          ...initialData, 
          selectedControlIds: initialControlIds 
        });
      setHasUnsavedChanges(false);
      setControlSearchTerm('');
      setSuggestedControls([]);
    }
  }, [isOpen, risk]);

  // Track form changes
  useEffect(() => {
    if (isOpen && initialFormDataRef.current) {
      const currentData = JSON.stringify({ 
        ...formData, 
        selectedControlIds: [...selectedControlIds].sort() 
      });
      const hasChanges = currentData !== initialFormDataRef.current;
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, selectedControlIds, isOpen]);

  // Keyboard shortcuts: Escape to close, Enter to submit (when not in textarea)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Enter to submit (but not when in textarea)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchUsers = async () => {
    try {
      // Fetch all users and filter for ADMIN/EDITOR in frontend
      const response = await api.get('/api/users');
      const allUsers = response.data.data || [];
      setUsers(allUsers.filter((u: any) => (u.role === 'ADMIN' || u.role === 'EDITOR')));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchControls = async () => {
    try {
      const response = await api.get('/api/controls', { params: { limit: 1000 } });
      setControls(response.data.data || []);
    } catch (error) {
      console.error('Error fetching controls:', error);
    }
  };

  const getSuggestedControls = async () => {
    if (!formData.title && !formData.description && !formData.threatDescription) {
      toast({
        title: 'No content to analyze',
        description: 'Please fill in at least one of: Title, Description, or Threat Description',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await api.post('/api/risks/suggest-controls', {
        title: formData.title,
        description: formData.description,
        threatDescription: formData.threatDescription,
      });
      setSuggestedControls(response.data.suggestedControlIds || []);
      toast({
        title: 'Suggestions generated',
        description: `Found ${response.data.suggestedControlIds?.length || 0} relevant controls`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error getting suggestions:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to get control suggestions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleUnsetMitigatedScores = () => {
    setFormData({
      ...formData,
      mitigatedConfidentialityScore: null,
      mitigatedIntegrityScore: null,
      mitigatedAvailabilityScore: null,
      mitigatedLikelihood: null,
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.dateAdded) {
      newErrors.dateAdded = 'Date Added is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const payload: any = { ...formData };
      
      // Always set riskScore to calculated value
      payload.riskScore = calculatedRiskScore;
      
      // Always set mitigatedRiskScore to calculated value if mitigated values exist
      if (mitigatedRiskScore !== null) {
        payload.mitigatedRiskScore = mitigatedRiskScore;
      }
      
      // Clean up empty strings - but keep them as null/undefined for optional fields
      if (payload.description === '') payload.description = undefined;
      if (payload.riskType === '') payload.riskType = undefined;
      if (payload.ownerUserId === '') payload.ownerUserId = undefined;
      if (payload.assetCategory === '') payload.assetCategory = undefined;
      if (payload.interestedParty === '') payload.interestedParty = undefined;
      if (payload.threatDescription === '') payload.threatDescription = undefined;
      if (payload.initialRiskTreatmentCategory === '') payload.initialRiskTreatmentCategory = undefined;
      if (payload.mitigationDescription === '') payload.mitigationDescription = undefined;
      if (payload.residualRiskTreatmentCategory === '') payload.residualRiskTreatmentCategory = undefined;

      // Remove null values for optional fields
      if (payload.mitigatedConfidentialityScore === null) payload.mitigatedConfidentialityScore = undefined;
      if (payload.mitigatedIntegrityScore === null) payload.mitigatedIntegrityScore = undefined;
      if (payload.mitigatedAvailabilityScore === null) payload.mitigatedAvailabilityScore = undefined;
      if (payload.mitigatedRiskScore === null) payload.mitigatedRiskScore = undefined;
      if (payload.mitigatedLikelihood === null) payload.mitigatedLikelihood = undefined;

      let response;
      let riskId: string;
      if (risk && !isDuplicateMode) {
        response = await api.put(`/api/risks/${risk.id}`, payload);
        riskId = risk.id;
        toast({
          title: 'Success',
          description: 'Risk updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        response = await api.post('/api/risks', payload);
        riskId = response.data.id;
        toast({
          title: 'Success',
          description: isDuplicateMode ? 'Risk duplicated successfully' : 'Risk created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      // Update control associations
      if (riskId) {
        try {
          await api.post(`/api/risks/${riskId}/controls`, {
            controlIds: selectedControlIds,
          });
        } catch (error: any) {
          console.error('Error updating control associations:', error);
          toast({
            title: 'Warning',
            description: 'Risk saved but control associations may not have updated',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        }
      }

      // Auto-close modal after brief delay to show toast
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('Error saving risk:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save risk';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleCloseAttempt} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh" display="flex" flexDirection="column" overflow="hidden">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <ModalHeader flexShrink={0}>
            {viewMode ? 'View Risk' : isDuplicateMode ? 'Duplicate Risk' : risk ? 'Edit Risk' : 'Create Risk'}
          </ModalHeader>
          <ModalCloseButton onClick={handleCloseAttempt} />
          <ModalBody overflowY="auto" flex="1" pb={6} minH={0}>
            <Tabs colorScheme="blue" isLazy>
              <TabList>
                <Tab>Basic Details</Tab>
                <Tab>Existing Controls Assessment</Tab>
                <Tab>Additional Controls Assessment</Tab>
                <Tab>Controls Linkage</Tab>
              </TabList>

              <TabPanels>
                {/* Tab 1: Basic Details */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                  <FormControl isRequired isInvalid={!!errors.dateAdded}>
                    <FormLabel>Date Added</FormLabel>
                    <Input
                      type="date"
                      value={formData.dateAdded}
                      onChange={(e) => {
                        setFormData({ ...formData, dateAdded: e.target.value });
                        if (errors.dateAdded) setErrors({ ...errors, dateAdded: '' });
                      }}
                      isReadOnly={viewMode}
                    />
                    <FormErrorMessage>{errors.dateAdded}</FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Risk Type</FormLabel>
                    <Select
                      value={formData.riskType}
                      onChange={(e) => setFormData({ ...formData, riskType: e.target.value })}
                      placeholder="Select risk type"
                      isDisabled={viewMode}
                    >
                      {RISK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Owner</FormLabel>
                    <Select
                      value={formData.ownerUserId}
                      onChange={(e) => setFormData({ ...formData, ownerUserId: e.target.value })}
                      placeholder="Select owner"
                      isDisabled={viewMode}
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName} ({user.email})
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Asset/Asset Category</FormLabel>
                    <Input
                      value={formData.assetCategory}
                      onChange={(e) => setFormData({ ...formData, assetCategory: e.target.value })}
                      isReadOnly={viewMode}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Interested Party</FormLabel>
                    <Input
                      value={formData.interestedParty}
                      onChange={(e) => setFormData({ ...formData, interestedParty: e.target.value })}
                      isReadOnly={viewMode}
                    />
                  </FormControl>

                  <FormControl isRequired isInvalid={!!errors.title}>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        if (errors.title) setErrors({ ...errors, title: '' });
                      }}
                      isReadOnly={viewMode}
                    />
                    <FormErrorMessage>{errors.title}</FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel>
                      Threat Description
                      {formData.threatDescription.length > 0 && (
                        <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                          ({formData.threatDescription.length} characters)
                        </Text>
                      )}
                    </FormLabel>
                    <Textarea
                      value={formData.threatDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, threatDescription: e.target.value })
                      }
                      rows={3}
                      maxLength={2000}
                      isReadOnly={viewMode}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Risk Description</FormLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      isReadOnly={viewMode}
                    />
                  </FormControl>
                </VStack>
                </TabPanel>

                {/* Tab 2: Existing Controls Assessment */}
                <TabPanel>
                  <HStack spacing={6} align="flex-start">
                    {/* Left side: Sliders */}
                    <VStack spacing={6} flex="1">
                      <HStack spacing={4} width="100%" justify="space-around">
                        <FormControl isRequired>
                          <FormLabel textAlign="center" mb={2}>
                            Confidentiality (C)
                            <Tooltip label="Impact on confidentiality">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.confidentialityScore)}.600`} mb={1}>
                                {formData.confidentialityScore}
                              </Text>
                              <Badge colorScheme={getScoreLabelColor(formData.confidentialityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                {getScoreLabel(formData.confidentialityScore)}
                              </Badge>
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.confidentialityScore}
                                onChange={(val) => setFormData({ ...formData, confidentialityScore: val })}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb boxSize={6} bg={`${getScoreLabelColor(formData.confidentialityScore)}.500`} borderWidth="2px" borderColor="white" boxShadow="md" />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel textAlign="center" mb={2}>
                            Integrity (I)
                            <Tooltip label="Impact on integrity">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.integrityScore)}.600`} mb={1}>
                                {formData.integrityScore}
                              </Text>
                              <Badge colorScheme={getScoreLabelColor(formData.integrityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                {getScoreLabel(formData.integrityScore)}
                              </Badge>
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.integrityScore}
                                onChange={(val) => setFormData({ ...formData, integrityScore: val })}
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb boxSize={6} bg={`${getScoreLabelColor(formData.integrityScore)}.500`} borderWidth="2px" borderColor="white" boxShadow="md" />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel textAlign="center" mb={2}>
                            Availability (A)
                            <Tooltip label="Impact on availability">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.availabilityScore)}.600`} mb={1}>
                                {formData.availabilityScore}
                              </Text>
                              <Badge colorScheme={getScoreLabelColor(formData.availabilityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                {getScoreLabel(formData.availabilityScore)}
                              </Badge>
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.availabilityScore}
                                onChange={(val) => setFormData({ ...formData, availabilityScore: val })}
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb boxSize={6} bg={`${getScoreLabelColor(formData.availabilityScore)}.500`} borderWidth="2px" borderColor="white" boxShadow="md" />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel textAlign="center" mb={2}>
                            Likelihood (L)
                            <Tooltip label="Likelihood of risk occurring">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.likelihood)}.600`} mb={1}>
                                {formData.likelihood}
                              </Text>
                              <Badge colorScheme={getScoreLabelColor(formData.likelihood)} fontSize="sm" px={3} py={1} minW="80px">
                                {getScoreLabel(formData.likelihood)}
                              </Badge>
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.likelihood}
                                onChange={(val) => setFormData({ ...formData, likelihood: val })}
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb boxSize={6} bg={`${getScoreLabelColor(formData.likelihood)}.500`} borderWidth="2px" borderColor="white" boxShadow="md" />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>
                      </HStack>
                    </VStack>

                    {/* Right side: Risk and Risk Score Cards */}
                    <VStack spacing={4} minW="200px">
                      <Card width="100%" minW="200px" maxW="200px" bg={`${riskLevelColor}.50`} borderColor={`${riskLevelColor}.300`} borderWidth="2px">
                        <CardBody>
                          <VStack spacing={2} align="stretch">
                            <Text fontSize="sm" fontWeight="bold" color="gray.600">
                              Risk (C + I + A)
                            </Text>
                            <Text fontSize="3xl" fontWeight="bold" color={`${riskLevelColor}.700`} textAlign="center">
                              {calculatedRisk}
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card width="100%" minW="200px" maxW="200px" bg={`${riskLevelColor}.50`} borderColor={`${riskLevelColor}.300`} borderWidth="2px">
                        <CardBody>
                          <VStack spacing={2} align="stretch">
                            <Text fontSize="sm" fontWeight="bold" color="gray.600">
                              Risk Score
                            </Text>
                            <Text fontSize="3xl" fontWeight="bold" color={`${riskLevelColor}.700`} textAlign="center">
                              {calculatedRiskScore}
                            </Text>
                            <Badge colorScheme={riskLevelColor} size="lg" alignSelf="center" mt={2} minW="80px" justifyContent="center">
                              {riskLevel}
                            </Badge>
                            <Text fontSize="xs" color="gray.500" textAlign="center" mt={1} minH="40px" lineHeight="1.4">
                              {riskLevel === 'HIGH' && 'Unacceptable - treatment required'}
                              {riskLevel === 'MEDIUM' && 'Warning - review frequently'}
                              {riskLevel === 'LOW' && 'Acceptable - no treatment required'}
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>
                    </VStack>
                  </HStack>

                  <FormControl>
                    <FormLabel>Initial Risk Treatment Category</FormLabel>
                    <Select
                      value={formData.initialRiskTreatmentCategory}
                      onChange={(e) =>
                        setFormData({ ...formData, initialRiskTreatmentCategory: e.target.value })
                      }
                      placeholder="Select treatment category"
                      isDisabled={viewMode}
                    >
                      {TREATMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </TabPanel>

                {/* Tab 3: Additional Controls Assessment */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="md" fontWeight="semibold" color="green.600">
                        Additional Controls - Mitigated Assessment
                      </Text>
                      {mitigatedRiskScore !== null && (
                        <Button size="sm" variant="outline" onClick={handleUnsetMitigatedScores}>
                          Unset Mitigated Scores
                        </Button>
                      )}
                    </HStack>
                    {mitigatedRiskScore === null && (
                      <Alert status="info" mb={4} borderRadius="md">
                        <AlertIcon />
                        Mitigated scores are not set. Adjust the sliders below to calculate them.
                      </Alert>
                    )}
                    <HStack spacing={6} align="flex-start">
                    {/* Left side: Sliders */}
                    <VStack spacing={6} flex="1">
                      <HStack spacing={4} width="100%" justify="space-around">
                        <FormControl>
                          <FormLabel textAlign="center" mb={2}>
                            Mitigated Confidentiality (MC)
                            <Tooltip label="Mitigated impact on confidentiality">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              {formData.mitigatedConfidentialityScore !== null ? (
                                <>
                                  <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.mitigatedConfidentialityScore)}.600`} mb={1}>
                                    {formData.mitigatedConfidentialityScore}
                                  </Text>
                                  <Badge colorScheme={getScoreLabelColor(formData.mitigatedConfidentialityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                    {getScoreLabel(formData.mitigatedConfidentialityScore)}
                                  </Badge>
                                </>
                              ) : (
                                <Badge colorScheme="gray" fontSize="sm" px={3} py={1} minW="80px">
                                  Not Set
                                </Badge>
                              )}
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.mitigatedConfidentialityScore || 1}
                                onChange={(val) =>
                                  setFormData({
                                    ...formData,
                                    mitigatedConfidentialityScore: val || null,
                                  })
                                }
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb 
                                  boxSize={6} 
                                  bg={formData.mitigatedConfidentialityScore !== null ? `${getScoreLabelColor(formData.mitigatedConfidentialityScore)}.500` : 'gray.400'} 
                                  borderWidth="2px" 
                                  borderColor="white" 
                                  boxShadow="md" 
                                />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl>
                          <FormLabel textAlign="center" mb={2}>
                            Mitigated Integrity (MI)
                            <Tooltip label="Mitigated impact on integrity">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              {formData.mitigatedIntegrityScore !== null ? (
                                <>
                                  <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.mitigatedIntegrityScore)}.600`} mb={1}>
                                    {formData.mitigatedIntegrityScore}
                                  </Text>
                                  <Badge colorScheme={getScoreLabelColor(formData.mitigatedIntegrityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                    {getScoreLabel(formData.mitigatedIntegrityScore)}
                                  </Badge>
                                </>
                              ) : (
                                <Badge colorScheme="gray" fontSize="sm" px={3} py={1} minW="80px">
                                  Not Set
                                </Badge>
                              )}
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.mitigatedIntegrityScore || 1}
                                onChange={(val) =>
                                  setFormData({ ...formData, mitigatedIntegrityScore: val || null })
                                }
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb 
                                  boxSize={6} 
                                  bg={formData.mitigatedIntegrityScore !== null ? `${getScoreLabelColor(formData.mitigatedIntegrityScore)}.500` : 'gray.400'} 
                                  borderWidth="2px" 
                                  borderColor="white" 
                                  boxShadow="md" 
                                />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl>
                          <FormLabel textAlign="center" mb={2}>
                            Mitigated Availability (MA)
                            <Tooltip label="Mitigated impact on availability">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              {formData.mitigatedAvailabilityScore !== null ? (
                                <>
                                  <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.mitigatedAvailabilityScore)}.600`} mb={1}>
                                    {formData.mitigatedAvailabilityScore}
                                  </Text>
                                  <Badge colorScheme={getScoreLabelColor(formData.mitigatedAvailabilityScore)} fontSize="sm" px={3} py={1} minW="80px">
                                    {getScoreLabel(formData.mitigatedAvailabilityScore)}
                                  </Badge>
                                </>
                              ) : (
                                <Badge colorScheme="gray" fontSize="sm" px={3} py={1} minW="80px">
                                  Not Set
                                </Badge>
                              )}
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.mitigatedAvailabilityScore || 1}
                                onChange={(val) =>
                                  setFormData({ ...formData, mitigatedAvailabilityScore: val || null })
                                }
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb 
                                  boxSize={6} 
                                  bg={formData.mitigatedAvailabilityScore !== null ? `${getScoreLabelColor(formData.mitigatedAvailabilityScore)}.500` : 'gray.400'} 
                                  borderWidth="2px" 
                                  borderColor="white" 
                                  boxShadow="md" 
                                />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>

                        <FormControl>
                          <FormLabel textAlign="center" mb={2}>
                            Mitigated Likelihood (ML)
                            <Tooltip label="Mitigated likelihood of risk occurring">
                              <IconButton
                                aria-label="Help"
                                icon={<Text fontSize="xs">?</Text>}
                                size="xs"
                                variant="ghost"
                                ml={1}
                              />
                            </Tooltip>
                          </FormLabel>
                          <VStack spacing={3} align="center">
                            <VStack spacing={1} align="center">
                              {formData.mitigatedLikelihood !== null ? (
                                <>
                                  <Text fontSize="lg" fontWeight="bold" color={`${getScoreLabelColor(formData.mitigatedLikelihood)}.600`} mb={1}>
                                    {formData.mitigatedLikelihood}
                                  </Text>
                                  <Badge colorScheme={getScoreLabelColor(formData.mitigatedLikelihood)} fontSize="sm" px={3} py={1} minW="80px">
                                    {getScoreLabel(formData.mitigatedLikelihood)}
                                  </Badge>
                                </>
                              ) : (
                                <Badge colorScheme="gray" fontSize="sm" px={3} py={1} minW="80px">
                                  Not Set
                                </Badge>
                              )}
                            </VStack>
                            <Box position="relative" height="200px" width="60px" mt={3}>
                              <Slider
                                orientation="vertical"
                                min={1}
                                max={5}
                                step={1}
                                value={formData.mitigatedLikelihood || 1}
                                onChange={(val) =>
                                  setFormData({ ...formData, mitigatedLikelihood: val || null })
                                }
                                isDisabled={viewMode}
                              >
                                <SliderMark value={1} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  1
                                </SliderMark>
                                <SliderMark value={3} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  3
                                </SliderMark>
                                <SliderMark value={5} left="50%" transform="translateX(-50%)" mt="-10px" fontSize="xs">
                                  5
                                </SliderMark>
                                <SliderTrack>
                                  <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb 
                                  boxSize={6} 
                                  bg={formData.mitigatedLikelihood !== null ? `${getScoreLabelColor(formData.mitigatedLikelihood)}.500` : 'gray.400'} 
                                  borderWidth="2px" 
                                  borderColor="white" 
                                  boxShadow="md" 
                                />
                              </Slider>
                            </Box>
                          </VStack>
                        </FormControl>
                      </HStack>
                    </VStack>

                    {/* Right side: Mitigated Risk and Risk Score Cards */}
                    <VStack spacing={4} minW="200px">
                      <Card 
                        width="100%" 
                        minW="200px" 
                        maxW="200px"
                        bg={mitigatedRisk !== null ? `${mitigatedRiskLevelColor}.50` : 'gray.50'} 
                        borderColor={mitigatedRisk !== null ? `${mitigatedRiskLevelColor}.300` : 'gray.300'} 
                        borderWidth="2px"
                        borderStyle={mitigatedRisk === null ? 'dashed' : 'solid'}
                      >
                        <CardBody>
                          <VStack spacing={2} align="stretch">
                            <Text fontSize="sm" fontWeight="bold" color="gray.600">
                              Mitigated Risk (MC + MI + MA)
                            </Text>
                            <Text fontSize="3xl" fontWeight="bold" color={mitigatedRisk !== null ? `${mitigatedRiskLevelColor}.700` : 'gray.500'} textAlign="center">
                              {mitigatedRisk !== null ? mitigatedRisk : 'N/A'}
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card 
                        width="100%" 
                        minW="200px" 
                        maxW="200px"
                        bg={mitigatedRiskScore !== null ? `${mitigatedRiskLevelColor}.50` : 'gray.50'} 
                        borderColor={mitigatedRiskScore !== null ? `${mitigatedRiskLevelColor}.300` : 'gray.300'} 
                        borderWidth="2px"
                        borderStyle={mitigatedRiskScore === null ? 'dashed' : 'solid'}
                      >
                        <CardBody>
                          <VStack spacing={2} align="stretch">
                            <Text fontSize="sm" fontWeight="bold" color="gray.600">
                              Mitigated Risk Score
                            </Text>
                            <Text fontSize="3xl" fontWeight="bold" color={mitigatedRiskScore !== null ? `${mitigatedRiskLevelColor}.700` : 'gray.500'} textAlign="center">
                              {mitigatedRiskScore !== null ? mitigatedRiskScore : 'N/A'}
                            </Text>
                            {mitigatedRiskLevel ? (
                              <>
                                <Badge colorScheme={mitigatedRiskLevelColor} size="lg" alignSelf="center" mt={2} minW="80px" justifyContent="center">
                                  {mitigatedRiskLevel}
                                </Badge>
                                <Text fontSize="xs" color="gray.500" textAlign="center" mt={1} minH="40px" lineHeight="1.4">
                                  {mitigatedRiskLevel === 'HIGH' && 'Unacceptable - treatment required'}
                                  {mitigatedRiskLevel === 'MEDIUM' && 'Warning - review frequently'}
                                  {mitigatedRiskLevel === 'LOW' && 'Acceptable - no treatment required'}
                                </Text>
                              </>
                            ) : (
                              <Text fontSize="xs" color="gray.400" textAlign="center" mt={1} fontStyle="italic" minH="32px">
                                Set mitigated scores to calculate
                              </Text>
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    </VStack>
                  </HStack>

                  <FormControl>
                    <Checkbox
                      isChecked={formData.mitigationImplemented}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({ ...prev, mitigationImplemented: checked }));
                      }}
                      isDisabled={viewMode}
                    >
                      Mitigation Implemented
                    </Checkbox>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Mitigation Description</FormLabel>
                    <Textarea
                      value={formData.mitigationDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, mitigationDescription: e.target.value })
                      }
                      rows={4}
                      placeholder="Describe the mitigation measures implemented..."
                      isReadOnly={viewMode}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Residual Risk Treatment Category</FormLabel>
                    <Select
                      value={formData.residualRiskTreatmentCategory}
                      onChange={(e) =>
                        setFormData({ ...formData, residualRiskTreatmentCategory: e.target.value })
                      }
                      placeholder="Select treatment category"
                      isDisabled={viewMode}
                    >
                      {TREATMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  </VStack>
                </TabPanel>

                {/* Tab 4: Controls Linkage */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                      <FormLabel>Annex A Applicable Controls</FormLabel>
                      <Button
                        size="sm"
                        leftIcon={loadingSuggestions ? <Spinner size="sm" /> : <Text>✨</Text>}
                        onClick={getSuggestedControls}
                        isLoading={loadingSuggestions}
                        variant="outline"
                        colorScheme="purple"
                        isDisabled={viewMode}
                      >
                        Get AI Suggestions
                      </Button>
                    </HStack>

                    {suggestedControls.length > 0 && (
                      <Alert status="info" borderRadius="md">
                        <AlertIcon />
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb={2}>
                            Suggested Controls ({suggestedControls.length})
                          </Text>
                          <HStack spacing={2} flexWrap="wrap">
                            {suggestedControls.map((controlId) => {
                              const control = controls.find((c) => c.id === controlId);
                              if (!control) return null;
                              const isSelected = selectedControlIds.includes(controlId);
                              return (
                                <Tag
                                  key={controlId}
                                  colorScheme={isSelected ? 'blue' : 'gray'}
                                  cursor="pointer"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedControlIds(selectedControlIds.filter((id) => id !== controlId));
                                    } else {
                                      setSelectedControlIds([...selectedControlIds, controlId]);
                                    }
                                  }}
                                >
                                  <TagLabel>{control.code}: {control.title}</TagLabel>
                                </Tag>
                              );
                            })}
                          </HStack>
                        </Box>
                      </Alert>
                    )}

                    <FormControl>
                      <FormLabel>Search and Select Controls</FormLabel>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <SearchIcon color="gray.300" />
                        </InputLeftElement>
                        <Input
                          placeholder="Search by control code or title..."
                          value={controlSearchTerm}
                          onChange={(e) => setControlSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && controlSearchTerm.trim()) {
                              // Try to find and add control by code
                              const found = controls.find(
                                (c) =>
                                  c.code.toLowerCase() === controlSearchTerm.trim().toLowerCase() ||
                                  c.code.toLowerCase().includes(controlSearchTerm.trim().toLowerCase())
                              );
                              if (found && !selectedControlIds.includes(found.id)) {
                                setSelectedControlIds([...selectedControlIds, found.id]);
                                setControlSearchTerm('');
                              }
                            }
                          }}
                        />
                      </InputGroup>
                    </FormControl>

                    {controlSearchTerm && (
                      <Box
                        borderWidth="1px"
                        borderRadius="md"
                        p={2}
                        maxH="200px"
                        overflowY="auto"
                        bg="white"
                      >
                        {controls
                          .filter(
                            (c) =>
                              !selectedControlIds.includes(c.id) &&
                              (c.code.toLowerCase().includes(controlSearchTerm.toLowerCase()) ||
                                c.title.toLowerCase().includes(controlSearchTerm.toLowerCase()))
                          )
                          .slice(0, 10)
                          .map((control) => (
                            <Box
                              key={control.id}
                              p={2}
                              _hover={{ bg: 'gray.100', cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedControlIds([...selectedControlIds, control.id]);
                                setControlSearchTerm('');
                              }}
                            >
                              <Text fontWeight="medium">{control.code}</Text>
                              <Text fontSize="sm" color="gray.600">
                                {control.title}
                              </Text>
                            </Box>
                          ))}
                      </Box>
                    )}

                    {selectedControlIds.length > 0 && (
                      <Box>
                        <FormLabel mb={2}>Selected Controls ({selectedControlIds.length})</FormLabel>
                        <HStack spacing={2} flexWrap="wrap">
                          {selectedControlIds.map((controlId) => {
                            const control = controls.find((c) => c.id === controlId);
                            if (!control) return null;
                            return (
                              <Tag key={controlId} colorScheme="blue" size="md">
                                <TagLabel>
                                  {control.code}: {control.title}
                                </TagLabel>
                                <TagCloseButton
                                  onClick={() => {
                                    setSelectedControlIds(selectedControlIds.filter((id) => id !== controlId));
                                  }}
                                />
                              </Tag>
                            );
                          })}
                        </HStack>
                      </Box>
                    )}
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>

          <ModalFooter flexShrink={0}>
            <Button variant="ghost" mr={3} onClick={handleCloseAttempt}>
              {viewMode ? 'Close' : 'Cancel'}
            </Button>
            {!viewMode && (
              <Button colorScheme="blue" type="submit" isLoading={loading}>
                {isDuplicateMode ? 'Create' : risk ? 'Update' : 'Create'}
              </Button>
            )}
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>

    {/* Unsaved Changes Dialog */}
    <AlertDialog
      isOpen={showUnsavedDialog}
      leastDestructiveRef={useRef(null)}
      onClose={() => setShowUnsavedDialog(false)}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Unsaved Changes
          </AlertDialogHeader>
          <AlertDialogBody>
            You have unsaved changes. Are you sure you want to close without saving?
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={() => setShowUnsavedDialog(false)}>
              Continue Editing
            </Button>
            <Button colorScheme="red" onClick={handleConfirmClose} ml={3}>
              Discard Changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
    </>
  );
}
