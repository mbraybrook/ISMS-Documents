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
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
} from '@chakra-ui/react';
import { SearchIcon, DeleteIcon, CopyIcon, AddIcon, EditIcon } from '@chakra-ui/icons';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { similarityApi, supplierApi } from '../services/api';
import { SimilarRisk, Department } from '../types/risk';
import { SimilarRisksPanel } from './SimilarRisksPanel';
import { SimilarityAlert } from './SimilarityAlert';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';

interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  risk: any;
  isDuplicateMode?: boolean;
  viewMode?: boolean;
  onDuplicate?: (risk: any) => void;
  onDelete?: (risk: any) => void;
  onEdit?: () => void;
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

const RISK_CATEGORIES = [
  'INFORMATION_SECURITY',
  'OPERATIONAL',
  'FINANCIAL',
  'COMPLIANCE',
  'REPUTATIONAL',
  'STRATEGIC',
  'OTHER',
];

const RISK_NATURES = ['STATIC', 'INSTANCE'];

const TREATMENT_CATEGORIES = ['RETAIN', 'MODIFY', 'SHARE', 'AVOID'];

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'BUSINESS_STRATEGY', label: 'Business Strategy' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'HR', label: 'HR' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'MARKETING', label: 'Marketing' },
];

export function RiskFormModal({ isOpen, onClose, risk, isDuplicateMode = false, viewMode = false, onDuplicate, onDelete, onEdit }: RiskFormModalProps) {
  const { getEffectiveRole } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [_assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [assetCategories, setAssetCategories] = useState<any[]>([]);
  const [interestedParties, setInterestedParties] = useState<Array<{ id: string; name: string; group: string | null }>>([]);
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const controlSearchInputRef = useRef<HTMLInputElement>(null);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [suggestedControls, setSuggestedControls] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const assetSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dateAdded: new Date().toISOString().split('T')[0],
    riskCategory: '',
    riskNature: '',
    archived: false,
    archivedDate: '',
    expiryDate: '',
    lastReviewDate: '',
    nextReviewDate: '',
    ownerUserId: '',
    assetCategory: '',
    assetIds: [] as string[],
    assetCategoryId: '',
    interestedPartyId: '',
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
    existingControlsDescription: '',
    residualRiskTreatmentCategory: '',
    isSupplierRisk: false,
    department: null as Department | null,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [linkedSuppliers, setLinkedSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const { isOpen: isSupplierModalOpen, onOpen: onSupplierModalOpen, onClose: onSupplierModalClose } = useDisclosure();
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [linkingSupplier, setLinkingSupplier] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<any>(null);

  // Similarity features state
  const [similarRisks, setSimilarRisks] = useState<SimilarRisk[]>([]);
  const [showSimilarRisks, setShowSimilarRisks] = useState(false);
  const [similarRisksLoading, setSimilarRisksLoading] = useState(false);
  const [selectedSimilarRiskIds, setSelectedSimilarRiskIds] = useState<Set<string>>(new Set());
  const [similarityAlertRisks, setSimilarityAlertRisks] = useState<SimilarRisk[]>([]);
  const [showSimilarityAlert, setShowSimilarityAlert] = useState(false);
  const [similarityProgress, setSimilarityProgress] = useState({ current: 0, total: 0, percentage: 0 });

  // Debounced values for similarity checking during creation
  const debouncedTitle = useDebounce(formData.title, 1500);
  const debouncedThreatDescription = useDebounce(formData.threatDescription, 1500);
  const debouncedDescription = useDebounce(formData.description, 1500);

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

  // Similarity handlers
  const handleFindSimilarRisks = async () => {
    if (!risk?.id) return;

    setSimilarRisksLoading(true);
    setShowSimilarRisks(true);
    setSimilarityProgress({ current: 0, total: 0, percentage: 0 });

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // First, get total risk count for progress estimation
      const countResponse = await api.get('/api/risks?page=1&limit=1');
      const totalRisks = countResponse.data.pagination?.total || 0;
      setSimilarityProgress({ current: 0, total: totalRisks, percentage: 0 });

      // Estimate: ~100ms per risk for embeddings (processed in batches of 50)
      // This accounts for network latency and processing time
      // Start progress animation
      const startTime = Date.now();
      const estimatedTimePerRisk = 100; // milliseconds per risk (conservative estimate)
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const estimatedProcessed = Math.min(totalRisks, Math.floor(elapsed / estimatedTimePerRisk));
        const percentage = Math.min(95, Math.round((estimatedProcessed / totalRisks) * 100)); // Cap at 95% until done
        setSimilarityProgress({
          current: estimatedProcessed,
          total: totalRisks,
          percentage,
        });
      }, 200); // Update every 200ms for smoother animation

      const response = await similarityApi.findSimilarRisks(risk.id, 10);

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setSimilarityProgress({ current: totalRisks, total: totalRisks, percentage: 100 });

      // Small delay to show 100% before hiding
      setTimeout(() => {
        setSimilarRisks(response.similarRisks);
        setSimilarRisksLoading(false);
        setSimilarityProgress({ current: 0, total: 0, percentage: 0 });
      }, 300);
    } catch (error: any) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      console.error('Error finding similar risks:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to find similar risks. Similarity checking may be temporarily unavailable.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setSimilarRisks([]);
      setSimilarRisksLoading(false);
      setSimilarityProgress({ current: 0, total: 0, percentage: 0 });
    }
  };

  const handleViewSimilarRisk = (riskId: string) => {
    window.open(`/admin/risks/risks?view=${riskId}`, '_blank');
  };

  const handleUseAsTemplate = async (riskId: string) => {
    try {
      const response = await api.get(`/api/risks/${riskId}`);
      const templateRisk = response.data;

      // Populate form with template risk data (excluding ID, dates)
      setFormData({
        title: templateRisk.title || '',
        description: templateRisk.description || '',
        dateAdded: new Date().toISOString().split('T')[0],
        riskCategory: templateRisk.riskCategory || '',
        riskNature: templateRisk.riskNature || '',
        archived: false,
        archivedDate: '',
        expiryDate: templateRisk.expiryDate ? new Date(templateRisk.expiryDate).toISOString().split('T')[0] : '',
        lastReviewDate: templateRisk.lastReviewDate ? new Date(templateRisk.lastReviewDate).toISOString().split('T')[0] : '',
        nextReviewDate: templateRisk.nextReviewDate ? new Date(templateRisk.nextReviewDate).toISOString().split('T')[0] : '',
        ownerUserId: templateRisk.ownerUserId || '',
        assetCategory: templateRisk.assetCategory || '',
        assetIds: templateRisk.assets?.map((a: any) => a.id) || [],
        assetCategoryId: templateRisk.assetCategoryId || '',
        interestedPartyId: templateRisk.interestedPartyId || '',
        threatDescription: templateRisk.threatDescription || '',
        confidentialityScore: templateRisk.confidentialityScore || 1,
        integrityScore: templateRisk.integrityScore || 1,
        availabilityScore: templateRisk.availabilityScore || 1,
        riskScore: templateRisk.riskScore || null,
        likelihood: templateRisk.likelihood || 1,
        initialRiskTreatmentCategory: templateRisk.initialRiskTreatmentCategory || '',
        mitigatedConfidentialityScore: templateRisk.mitigatedConfidentialityScore || null,
        mitigatedIntegrityScore: templateRisk.mitigatedIntegrityScore || null,
        mitigatedAvailabilityScore: templateRisk.mitigatedAvailabilityScore || null,
        mitigatedRiskScore: templateRisk.mitigatedRiskScore || null,
        mitigatedLikelihood: templateRisk.mitigatedLikelihood || null,
        mitigationImplemented: templateRisk.mitigationImplemented || false,
        mitigationDescription: templateRisk.mitigationDescription || '',
          existingControlsDescription: templateRisk.existingControlsDescription || '',
          residualRiskTreatmentCategory: templateRisk.residualRiskTreatmentCategory || '',
          department: templateRisk.department || null,
          isSupplierRisk: templateRisk.isSupplierRisk || false,
        });

      // Load control associations if available
      if (templateRisk.riskControls && templateRisk.riskControls.length > 0) {
        setSelectedControlIds(templateRisk.riskControls.map((rc: any) => rc.control.id));
      } else {
        setSelectedControlIds([]);
      }

      // Load assets if available
      if (templateRisk.assets && templateRisk.assets.length > 0) {
        setSelectedAssets(templateRisk.assets);
        setAssets(templateRisk.assets);
        setFilteredAssets(templateRisk.assets);
        setFormData((prev) => ({
          ...prev,
          assetIds: templateRisk.assets.map((a: any) => a.id),
        }));
      }

      setShowSimilarityAlert(false);
      toast({
        title: 'Template Loaded',
        description: 'Risk data loaded. Review and save as new risk.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error loading template risk:', error);
      toast({
        title: 'Error',
        description: 'Failed to load risk template',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSelectSimilarRisk = (riskId: string, selected: boolean) => {
    setSelectedSimilarRiskIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(riskId);
      } else {
        newSet.delete(riskId);
      }
      return newSet;
    });
  };

  const handleBulkDeleteSimilarRisks = async () => {
    if (selectedSimilarRiskIds.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedSimilarRiskIds.size} selected risk(s)?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const deletePromises = Array.from(selectedSimilarRiskIds).map((id) =>
        api.delete(`/api/risks/${id}`)
      );
      await Promise.all(deletePromises);

      toast({
        title: 'Success',
        description: `Deleted ${selectedSimilarRiskIds.size} risk(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Remove deleted risks from the list
      setSimilarRisks((prev) => prev.filter((sr) => !selectedSimilarRiskIds.has(sr.risk.id)));
      setSelectedSimilarRiskIds(new Set());
    } catch (error: any) {
      console.error('Error deleting risks:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete some risks',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Debounced similarity checking during creation
  useEffect(() => {
    // Only check similarity during creation (not editing existing risk)
    if (!risk && !isDuplicateMode && debouncedTitle.length >= 3) {
      const checkSimilarity = async () => {
        try {
          const response = await similarityApi.checkSimilarity({
            title: debouncedTitle,
            threatDescription: debouncedThreatDescription || undefined,
            description: debouncedDescription || undefined,
          });

          if (response.similarRisks.length > 0) {
            setSimilarityAlertRisks(response.similarRisks);
            setShowSimilarityAlert(true);
          } else {
            setShowSimilarityAlert(false);
          }
        } catch (error: any) {
          // Silently fail - don't show error to user, just don't show alert
          console.error('Error checking similarity:', error);
          setShowSimilarityAlert(false);
        }
      };

      checkSimilarity();
    } else {
      setShowSimilarityAlert(false);
    }
  }, [debouncedTitle, debouncedThreatDescription, debouncedDescription, risk, isDuplicateMode]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchControls();
      fetchAssetCategories();
      fetchInterestedParties();
      // Don't fetch assets upfront - only when user searches
      setAssets([]);
      setFilteredAssets([]);
      setSelectedAssets([]);
      setAssetSearchTerm('');
      setShowAssetDropdown(false);
      // Reset similarity state
      setSimilarRisks([]);
      setShowSimilarRisks(false);
      setSelectedSimilarRiskIds(new Set());
      setSimilarityAlertRisks([]);
      setShowSimilarityAlert(false);
      let initialData: any;
      if (risk) {
        initialData = {
          title: risk.title || '',
          description: risk.description || '',
          dateAdded: risk.dateAdded
            ? new Date(risk.dateAdded).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          riskCategory: risk.riskCategory || risk.riskType || '',
          riskNature: risk.riskNature || '',
          archived: risk.archived || false,
          archivedDate: risk.archivedDate
            ? new Date(risk.archivedDate).toISOString().split('T')[0]
            : '',
          expiryDate: risk.expiryDate
            ? new Date(risk.expiryDate).toISOString().split('T')[0]
            : '',
          lastReviewDate: risk.lastReviewDate
            ? new Date(risk.lastReviewDate).toISOString().split('T')[0]
            : '',
          nextReviewDate: risk.nextReviewDate
            ? new Date(risk.nextReviewDate).toISOString().split('T')[0]
            : '',
          ownerUserId: risk.ownerUserId || '',
          assetCategory: risk.assetCategory || '',
          assetIds: risk.assets?.map((a: any) => a.id) || [],
          assetCategoryId: risk.assetCategoryId || '',
          interestedPartyId: risk.interestedParty?.id || '',
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
          existingControlsDescription: risk.existingControlsDescription || '',
          residualRiskTreatmentCategory: risk.residualRiskTreatmentCategory || '',
          isSupplierRisk: risk.isSupplierRisk || false,
          department: risk.department || null,
        };
        setFormData(initialData);
        // Load existing control associations
        if (risk.riskControls && risk.riskControls.length > 0) {
          setSelectedControlIds(risk.riskControls.map((rc: any) => rc.control.id));
        } else {
          setSelectedControlIds([]);
        }
        // Fetch linked suppliers
        if (risk.id) {
          fetchLinkedSuppliers(risk.id);
        }
        // If risk has assets, load them
        if (risk.assets && risk.assets.length > 0) {
          setSelectedAssets(risk.assets);
          setAssets(risk.assets);
          setFilteredAssets(risk.assets);
        }
      } else {
        initialData = {
          title: '',
          description: '',
          dateAdded: new Date().toISOString().split('T')[0],
          riskCategory: '',
          riskNature: '',
        archived: false,
        archivedDate: '',
        expiryDate: '',
          lastReviewDate: '',
          nextReviewDate: '',
          ownerUserId: '',
          assetCategory: '',
          assetIds: [],
          assetCategoryId: '',
          interestedPartyId: '',
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
          existingControlsDescription: '',
          residualRiskTreatmentCategory: '',
          isSupplierRisk: false,
          department: null,
        };
        setFormData(initialData);
        setSelectedControlIds([]);
        setLinkedSuppliers([]);
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
      setAssetSearchTerm('');
      setShowAssetDropdown(false);
      setAssets([]);
      setFilteredAssets([]);
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

  const fetchAssets = async (searchTerm: string = '') => {
    try {
      setLoadingAssets(true);
      const params: any = {
        limit: 50, // Limit results for performance
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.get('/api/assets', { params });
      // Ensure response.data.data is always an array
      const fetchedAssets = Array.isArray(response.data?.data) ? response.data.data : [];
      setAssets(fetchedAssets);
      setFilteredAssets(fetchedAssets);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoadingAssets(false);
    }
  };

  // Debounced asset search
  useEffect(() => {
    if (assetSearchTimeoutRef.current) {
      clearTimeout(assetSearchTimeoutRef.current);
    }

    if (assetSearchTerm.length >= 2) {
      assetSearchTimeoutRef.current = setTimeout(() => {
        fetchAssets(assetSearchTerm);
        setShowAssetDropdown(true);
      }, 300); // 300ms debounce
    } else if (assetSearchTerm.length === 0) {
      setFilteredAssets([]);
      setShowAssetDropdown(false);
    }

    return () => {
      if (assetSearchTimeoutRef.current) {
        clearTimeout(assetSearchTimeoutRef.current);
      }
    };
  }, [assetSearchTerm]);

  const fetchAssetCategories = async () => {
    try {
      const response = await api.get('/api/asset-categories');
      // Ensure response.data is always an array
      setAssetCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching asset categories:', error);
      // Set empty array on error to prevent map errors
      setAssetCategories([]);
    }
  };

  const fetchLinkedSuppliers = async (riskId: string) => {
    try {
      setLoadingSuppliers(true);
      const suppliers = await api.get(`/api/risks/${riskId}/suppliers`);
      setLinkedSuppliers(suppliers.data);
    } catch (error: any) {
      console.error('Error fetching linked suppliers:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const searchSuppliers = async () => {
    if (!supplierSearchTerm.trim()) {
      setAvailableSuppliers([]);
      return;
    }

    try {
      setSearchingSuppliers(true);
      const response = await supplierApi.getSuppliers({ search: supplierSearchTerm });
      // Filter out suppliers already linked
      const linkedSupplierIds = new Set(linkedSuppliers.map((s) => s.id));
      setAvailableSuppliers(response.filter((s: any) => !linkedSupplierIds.has(s.id)));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search suppliers',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingSuppliers(false);
    }
  };

  const handleLinkSupplier = async (supplierId: string) => {
    if (!risk?.id) return;
    try {
      setLinkingSupplier(true);
      await api.post(`/api/risks/${risk.id}/suppliers`, { supplierId });
      toast({
        title: 'Success',
        description: 'Supplier linked successfully',
        status: 'success',
        duration: 3000,
      });
      onSupplierModalClose();
      setSupplierSearchTerm('');
      setAvailableSuppliers([]);
      fetchLinkedSuppliers(risk.id);
      // Auto-check isSupplierRisk if not already checked
      if (!formData.isSupplierRisk) {
        setFormData({ ...formData, isSupplierRisk: true });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link supplier',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingSupplier(false);
    }
  };

  const handleUnlinkSupplier = async (supplierId: string) => {
    if (!risk?.id) return;
    try {
      await api.delete(`/api/suppliers/${supplierId}/risks/${risk.id}`);
      toast({
        title: 'Success',
        description: 'Supplier unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchLinkedSuppliers(risk.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to unlink supplier',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchInterestedParties = async () => {
    try {
      const response = await api.get('/api/interested-parties');
      // Ensure response.data is always an array
      setInterestedParties(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching interested parties:', error);
      // Set empty array on error to prevent map errors
      setInterestedParties([]);
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

    if (!formData.interestedPartyId) {
      newErrors.interestedPartyId = 'Interested Party is required';
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
      if (payload.riskCategory === '') payload.riskCategory = undefined;
      if (payload.riskNature === '') payload.riskNature = undefined;
      if (payload.archivedDate === '') payload.archivedDate = undefined;
      if (payload.expiryDate === '') payload.expiryDate = undefined;
      if (payload.lastReviewDate === '') payload.lastReviewDate = undefined;
      if (payload.nextReviewDate === '') payload.nextReviewDate = undefined;
      if (payload.ownerUserId === '') payload.ownerUserId = undefined;
      if (payload.assetCategory === '') payload.assetCategory = undefined;
      // Send undefined to preserve existing associations, or empty array [] to clear them
      // Backend validation expects undefined (skip update) or array (update associations)
      if (payload.assetIds && payload.assetIds.length === 0) payload.assetIds = undefined;
      if (payload.assetCategoryId === '') payload.assetCategoryId = null;
      // interestedPartyId is required, so don't remove it if it's set
      if (payload.threatDescription === '') payload.threatDescription = undefined;
      if (payload.initialRiskTreatmentCategory === '') payload.initialRiskTreatmentCategory = undefined;
      if (payload.mitigationDescription === '') payload.mitigationDescription = undefined;
      if (payload.existingControlsDescription === '') payload.existingControlsDescription = undefined;
      if (payload.residualRiskTreatmentCategory === '') payload.residualRiskTreatmentCategory = undefined;
      if (payload.department === '' || payload.department === null) payload.department = null;

      // Remove null values for optional fields
      if (payload.mitigatedConfidentialityScore === null) payload.mitigatedConfidentialityScore = undefined;
      if (payload.mitigatedIntegrityScore === null) payload.mitigatedIntegrityScore = undefined;
      if (payload.mitigatedAvailabilityScore === null) payload.mitigatedAvailabilityScore = undefined;
      if (payload.mitigatedRiskScore === null) payload.mitigatedRiskScore = undefined;
      if (payload.mitigatedLikelihood === null) payload.mitigatedLikelihood = undefined;

      // Include test department in query params if testing as CONTRIBUTOR
      const testDepartment = localStorage.getItem('departmentOverride');
      const roleOverride = localStorage.getItem('roleOverride');
      const isTestingAsContributor = roleOverride === 'CONTRIBUTOR' && testDepartment;
      
      let response;
      let riskId: string;
      if (risk && !isDuplicateMode) {
        const url = `/api/risks/${risk.id}`;
        const config: any = {};
        
        // Add testDepartment as query param if testing
        if (isTestingAsContributor) {
          config.params = { testDepartment };
        }
        
        response = await api.put(url, payload, config);
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
          // Ensure selectedControlIds is an array
          const controlIdsArray = Array.isArray(selectedControlIds)
            ? selectedControlIds.filter(id => id && typeof id === 'string')
            : [];

          console.log('Updating control associations:', {
            riskId,
            controlIdsCount: controlIdsArray.length,
            controlIds: controlIdsArray,
          });

          await api.post(`/api/risks/${riskId}/controls`, {
            controlIds: controlIdsArray,
          });
        } catch (error: any) {
          console.error('Error updating control associations:', error);
          console.error('Error response data:', error.response?.data);
          console.error('Error response status:', error.response?.status);
          console.error('Selected control IDs:', selectedControlIds);
          console.error('Selected control IDs type:', typeof selectedControlIds, Array.isArray(selectedControlIds));
          toast({
            title: 'Warning',
            description: error.response?.data?.error || error.response?.data?.message || 'Risk saved but control associations may not have updated',
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
      let errorMessage = error.response?.data?.error || error.message || 'Failed to save risk';

      // Use the backend error message if available, otherwise provide a generic message
      if (error.response?.status === 403 || error.response?.status === 401) {
        // Use the specific backend error message if provided, otherwise show generic message
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = 'You do not have permission to create or edit risks. Please contact an administrator if you need this access.';
        }
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.error || 'Invalid data provided. Please check all required fields.';
      }

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
                  <Tab>Essentials</Tab>
                  <Tab>Additional Details</Tab>
                  <Tab>Existing Controls Assessment</Tab>
                  <Tab>
                    Additional Controls Assessment
                    {formData.initialRiskTreatmentCategory === 'MODIFY' && (() => {
                      const hasMitigatedScores = 
                        formData.mitigatedConfidentialityScore !== null ||
                        formData.mitigatedIntegrityScore !== null ||
                        formData.mitigatedAvailabilityScore !== null ||
                        formData.mitigatedLikelihood !== null ||
                        formData.mitigatedRiskScore !== null;
                      const hasMitigationDescription = formData.mitigationDescription && formData.mitigationDescription.trim().length > 0;
                      const isComplete = hasMitigatedScores && hasMitigationDescription;
                      const currentRiskLevel = getRiskLevel(calculatedRiskScore);
                      // Only show warning badge for MEDIUM/HIGH risks
                      const shouldShowWarning = currentRiskLevel !== 'LOW' && !isComplete;
                      return shouldShowWarning ? (
                        <Badge ml={2} colorScheme="red" fontSize="xs">
                          !
                        </Badge>
                      ) : null;
                    })()}
                  </Tab>
                  <Tab>Controls Linkage</Tab>
                </TabList>

                <TabPanels>
                  {/* Tab 1: Essentials */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      {/* Similarity Alert for creation mode */}
                      {showSimilarityAlert && similarityAlertRisks.length > 0 && !risk && (
                        <SimilarityAlert
                          similarRisks={similarityAlertRisks}
                          onViewRisk={handleViewSimilarRisk}
                          onUseAsTemplate={handleUseAsTemplate}
                          onDismiss={() => setShowSimilarityAlert(false)}
                        />
                      )}
                      <FormControl isRequired isInvalid={!!errors.title}>
                        <FormLabel>
                          Title
                          <Tooltip label="A brief, descriptive title that identifies the risk (e.g., 'Unauthorized Access to Customer Data')">
                            <IconButton
                              aria-label="Info"
                              icon={<Text fontSize="xs">?</Text>}
                              size="xs"
                              variant="ghost"
                              ml={1}
                              verticalAlign="middle"
                            />
                          </Tooltip>
                        </FormLabel>
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
                          <Tooltip label="Describe the specific threat or event that could cause harm to the organization (e.g., 'Malicious actor gains unauthorized access to systems')">
                            <IconButton
                              aria-label="Info"
                              icon={<Text fontSize="xs">?</Text>}
                              size="xs"
                              variant="ghost"
                              ml={1}
                              verticalAlign="middle"
                            />
                          </Tooltip>
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
                        <FormLabel>
                          Risk Description
                          <Tooltip label="Provide a detailed description of the risk, including its potential impact on the organization, assets, or operations">
                            <IconButton
                              aria-label="Info"
                              icon={<Text fontSize="xs">?</Text>}
                              size="xs"
                              variant="ghost"
                              ml={1}
                              verticalAlign="middle"
                            />
                          </Tooltip>
                        </FormLabel>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          isReadOnly={viewMode}
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Owner</FormLabel>
                        <Select
                          value={formData.ownerUserId}
                          onChange={(e) => setFormData({ ...formData, ownerUserId: e.target.value })}
                          placeholder="Select owner"
                          isDisabled={viewMode}
                        >
                          {Array.isArray(users) && users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName} ({user.email})
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl isRequired isInvalid={!!errors.interestedPartyId}>
                        <FormLabel>Interested Party</FormLabel>
                        <Select
                          value={formData.interestedPartyId}
                          onChange={(e) => setFormData({ ...formData, interestedPartyId: e.target.value })}
                          isDisabled={viewMode}
                          placeholder="Select an interested party"
                        >
                          {Array.isArray(interestedParties) && interestedParties.map((party) => (
                            <option key={party.id} value={party.id}>
                              {party.name} {party.group ? `(${party.group})` : ''}
                            </option>
                          ))}
                        </Select>
                        {errors.interestedPartyId && (
                          <FormErrorMessage>{errors.interestedPartyId}</FormErrorMessage>
                        )}
                      </FormControl>

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
                    </VStack>
                  </TabPanel>

                  {/* Tab 2: Additional Details */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>Risk Category</FormLabel>
                        <Select
                          value={formData.riskCategory}
                          onChange={(e) => setFormData({ ...formData, riskCategory: e.target.value })}
                          placeholder="Select risk category"
                          isDisabled={viewMode}
                        >
                          {RISK_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Department</FormLabel>
                        <Select
                          value={formData.department || ''}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value as Department || null })}
                          placeholder="Select department"
                          isDisabled={viewMode || getEffectiveRole() === 'CONTRIBUTOR'}
                        >
                          <option value="">Not assigned</option>
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </Select>
                        {getEffectiveRole() === 'CONTRIBUTOR' && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Department cannot be changed by Contributors
                          </Text>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Risk Nature</FormLabel>
                        <Select
                          value={formData.riskNature}
                          onChange={(e) => {
                            const newNature = e.target.value;
                            setFormData({
                              ...formData,
                              riskNature: newNature,
                              // Clear incompatible fields when changing nature
                              expiryDate: newNature === 'STATIC' ? '' : formData.expiryDate,
                              lastReviewDate: newNature === 'INSTANCE' ? '' : formData.lastReviewDate,
                              nextReviewDate: newNature === 'INSTANCE' ? '' : formData.nextReviewDate,
                            });
                          }}
                          placeholder="Select risk nature"
                          isDisabled={viewMode}
                        >
                          {RISK_NATURES.map((nature) => (
                            <option key={nature} value={nature}>
                              {nature}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {formData.riskNature === 'STATIC' && 'Static risks are always present and require periodic review'}
                          {formData.riskNature === 'INSTANCE' && 'Instance risks are transient and may expire'}
                        </Text>
                      </FormControl>

                      {formData.riskNature === 'INSTANCE' && (
                        <FormControl>
                          <FormLabel>Expiry Date (Optional)</FormLabel>
                          <Input
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                            isReadOnly={viewMode}
                          />
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Instance risks can expire when they are no longer relevant
                          </Text>
                        </FormControl>
                      )}

                      {formData.riskNature === 'STATIC' && (
                        <>
                          <FormControl>
                            <FormLabel>Last Review Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.lastReviewDate}
                              onChange={(e) => setFormData({ ...formData, lastReviewDate: e.target.value })}
                              isReadOnly={viewMode}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Next Review Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.nextReviewDate}
                              onChange={(e) => setFormData({ ...formData, nextReviewDate: e.target.value })}
                              isReadOnly={viewMode}
                            />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              Static risks should be reviewed annually
                            </Text>
                          </FormControl>
                        </>
                      )}

                      <FormControl>
                        <FormLabel>Link to Assets (Optional)</FormLabel>
                        <Box position="relative">
                          {/* Selected Assets Display */}
                          {selectedAssets.length > 0 && (
                            <HStack wrap="wrap" spacing={2} mb={2}>
                              {selectedAssets.map((asset) => (
                                <Tag key={asset.id} size="md" borderRadius="full" variant="solid" colorScheme="blue">
                                  <TagLabel>
                                    {asset.nameSerialNo || asset.model || 'Unnamed Asset'}
                                    {asset.category?.name && ` (${asset.category.name})`}
                                  </TagLabel>
                                  {!viewMode && (
                                    <TagCloseButton
                                      onClick={() => {
                                        const updated = selectedAssets.filter((a) => a.id !== asset.id);
                                        setSelectedAssets(updated);
                                        setFormData({
                                          ...formData,
                                          assetIds: updated.map((a) => a.id),
                                        });
                                      }}
                                    />
                                  )}
                                </Tag>
                              ))}
                            </HStack>
                          )}
                          <InputGroup>
                            <InputLeftElement pointerEvents="none">
                              <SearchIcon color="gray.300" />
                            </InputLeftElement>
                            <Input
                              placeholder="Type to search assets (min 2 characters)..."
                              value={assetSearchTerm}
                              onChange={(e) => {
                                const value = e.target.value;
                                setAssetSearchTerm(value);
                              }}
                              onFocus={() => {
                                if (assetSearchTerm.length >= 2) {
                                  setShowAssetDropdown(true);
                                }
                              }}
                              onBlur={() => {
                                // Delay to allow clicking on dropdown items
                                setTimeout(() => setShowAssetDropdown(false), 200);
                              }}
                              isDisabled={viewMode}
                            />
                          </InputGroup>
                          {showAssetDropdown && (loadingAssets || filteredAssets.length > 0 || assetSearchTerm.length >= 2) && (
                            <Box
                              position="absolute"
                              top="100%"
                              left={0}
                              right={0}
                              zIndex={1000}
                              mt={1}
                              borderWidth="1px"
                              borderRadius="md"
                              bg="white"
                              boxShadow="lg"
                              maxH="300px"
                              overflowY="auto"
                            >
                              {loadingAssets ? (
                                <Box p={4} textAlign="center">
                                  <Spinner size="sm" />
                                  <Text fontSize="sm" color="gray.500" mt={2}>
                                    Searching assets...
                                  </Text>
                                </Box>
                              ) : filteredAssets.length === 0 && assetSearchTerm.length >= 2 ? (
                                <Box p={4} textAlign="center">
                                  <Text fontSize="sm" color="gray.500">
                                    No assets found matching "{assetSearchTerm}"
                                  </Text>
                                </Box>
                              ) : (
                                Array.isArray(filteredAssets) && filteredAssets.slice(0, 20).map((asset) => {
                                  const isSelected = selectedAssets.some((a) => a.id === asset.id);
                                  return (
                                    <Box
                                      key={asset.id}
                                      p={3}
                                      borderBottomWidth="1px"
                                      bg={isSelected ? 'blue.50' : 'white'}
                                      _hover={{ bg: isSelected ? 'blue.100' : 'blue.50', cursor: 'pointer' }}
                                      onClick={() => {
                                        if (isSelected) {
                                          // Remove asset
                                          const updated = selectedAssets.filter((a) => a.id !== asset.id);
                                          setSelectedAssets(updated);
                                          setFormData({
                                            ...formData,
                                            assetIds: updated.map((a) => a.id),
                                          });
                                        } else {
                                          // Add asset
                                          const updated = [...selectedAssets, asset];
                                          setSelectedAssets(updated);
                                          setFormData({
                                            ...formData,
                                            assetIds: updated.map((a) => a.id),
                                          });
                                        }
                                        setAssetSearchTerm('');
                                        setShowAssetDropdown(false);
                                      }}
                                    >
                                      <HStack justify="space-between">
                                        <VStack align="start" spacing={0}>
                                          <Text fontWeight="medium" fontSize="sm">
                                            {asset.nameSerialNo || asset.model || 'Unnamed Asset'}
                                            {isSelected && ' ✓'}
                                          </Text>
                                          <HStack spacing={2} fontSize="xs" color="gray.600">
                                            <Text>{asset.category?.name || ''}</Text>
                                            {asset.manufacturer && <Text>• {asset.manufacturer}</Text>}
                                            {asset.primaryUser && <Text>• User: {asset.primaryUser}</Text>}
                                          </HStack>
                                        </VStack>
                                        <Badge colorScheme="blue" fontSize="xs">
                                          {asset.classification?.name || ''}
                                        </Badge>
                                      </HStack>
                                    </Box>
                                  );
                                })
                              )}
                            </Box>
                          )}
                        </Box>
                        {selectedAssets.length > 0 && (
                          <Text fontSize="xs" color="green.600" mt={1}>
                            ✓ {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected
                          </Text>
                        )}
                      </FormControl>

                      <FormControl>
                        <FormLabel>Link to Asset Category (Optional)</FormLabel>
                        <Select
                          value={formData.assetCategoryId || ''}
                          onChange={(e) => {
                            const assetCategoryId = e.target.value;
                            setFormData({
                              ...formData,
                              assetCategoryId: assetCategoryId || '',
                            });
                          }}
                          placeholder="Select an asset category (or leave blank)"
                          isDisabled={viewMode}
                        >
                          <option value="">None</option>
                          {Array.isArray(assetCategories) && assetCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="sm" color="gray.500" mt={1}>
                          You can link to both specific assets and an asset category if needed.
                        </Text>
                      </FormControl>

                      <FormControl>
                        <Checkbox
                          isChecked={formData.archived}
                          onChange={(e) => {
                            const newArchived = e.target.checked;
                            setFormData({ 
                              ...formData, 
                              archived: newArchived,
                              archivedDate: newArchived && !formData.archivedDate 
                                ? new Date().toISOString().split('T')[0] 
                                : (!newArchived ? '' : formData.archivedDate)
                            });
                          }}
                          isDisabled={viewMode}
                        >
                          Archived
                        </Checkbox>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Archived risks are hidden by default. Instance risks are typically archived when they expire.
                        </Text>
                        {formData.archived && (
                          <FormControl mt={3}>
                            <FormLabel fontSize="sm">Archive Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.archivedDate}
                              onChange={(e) => setFormData({ ...formData, archivedDate: e.target.value })}
                              isDisabled={viewMode}
                            />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              The date when this risk was archived. Archived risks are excluded from risk scoring and control selection after this date.
                            </Text>
                          </FormControl>
                        )}
                      </FormControl>

                      <FormControl>
                        <Checkbox
                          isChecked={formData.isSupplierRisk}
                          onChange={(e) => setFormData({ ...formData, isSupplierRisk: e.target.checked })}
                          isDisabled={viewMode}
                        >
                          Supplier Risk
                        </Checkbox>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Mark this risk as related to supplier management
                        </Text>
                      </FormControl>

                      {risk && (
                        <>
                          <Divider />
                          <Box>
                            <HStack justify="space-between" mb={2}>
                              <FormLabel fontWeight="bold" color="blue.600">
                                Linked Suppliers ({linkedSuppliers.length})
                              </FormLabel>
                              {!viewMode && (
                                <Button
                                  leftIcon={<AddIcon />}
                                  size="sm"
                                  colorScheme="blue"
                                  variant="outline"
                                  onClick={onSupplierModalOpen}
                                >
                                  Link Supplier
                                </Button>
                              )}
                            </HStack>
                            {loadingSuppliers ? (
                              <Text color="gray.500">Loading suppliers...</Text>
                            ) : linkedSuppliers.length === 0 ? (
                              <Text color="gray.500" fontStyle="italic">
                                No suppliers linked to this risk
                              </Text>
                            ) : (
                              <VStack align="stretch" spacing={2}>
                                {Array.isArray(linkedSuppliers) && linkedSuppliers.map((supplier) => (
                                  <Box
                                    key={supplier.id}
                                    p={2}
                                    bg="white"
                                    borderRadius="md"
                                    border="1px"
                                    borderColor="blue.200"
                                    _hover={{ bg: "blue.100", borderColor: "blue.400" }}
                                  >
                                    <HStack justify="space-between">
                                      <Link
                                        to={`/admin/suppliers/${supplier.id}`}
                                        style={{ textDecoration: 'none', flex: 1 }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          navigate(`/admin/suppliers/${supplier.id}`);
                                          onClose();
                                        }}
                                      >
                                        <HStack spacing={2}>
                                          <Badge colorScheme="purple" fontSize="xs">
                                            Supplier
                                          </Badge>
                                          <Box fontWeight="medium" color="blue.700" _hover={{ textDecoration: "underline" }}>
                                            {supplier.name}
                                          </Box>
                                        </HStack>
                                      </Link>
                                      {!viewMode && (
                                        <IconButton
                                          aria-label="Unlink supplier"
                                          icon={<DeleteIcon />}
                                          size="xs"
                                          colorScheme="red"
                                          variant="ghost"
                                          onClick={() => handleUnlinkSupplier(supplier.id)}
                                        />
                                      )}
                                    </HStack>
                                  </Box>
                                ))}
                              </VStack>
                            )}
                          </Box>
                        </>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Tab 3: Existing Controls Assessment */}
                  <TabPanel>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel>
                          Existing Controls Description
                          <Tooltip label="Describe the controls that are already in place to mitigate this risk before any additional mitigation measures are implemented">
                            <IconButton
                              aria-label="Info"
                              icon={<Text fontSize="xs">?</Text>}
                              size="xs"
                              variant="ghost"
                              ml={1}
                              verticalAlign="middle"
                            />
                          </Tooltip>
                        </FormLabel>
                        <Textarea
                          value={formData.existingControlsDescription}
                          onChange={(e) =>
                            setFormData({ ...formData, existingControlsDescription: e.target.value })
                          }
                          placeholder="Describe the existing controls that are in place to mitigate this risk..."
                          rows={4}
                          isDisabled={viewMode}
                        />
                        {riskLevel === 'MEDIUM' && formData.initialRiskTreatmentCategory === 'RETAIN' && (
                          <Alert status="warning" borderRadius="md" mt={2}>
                            <AlertIcon />
                            <Text fontSize="sm">
                              The Existing Controls Description must justify why Retain is acceptable for a Medium risk. Per policy, Medium and higher risks typically require treatment other than Retain.
                            </Text>
                          </Alert>
                        )}
                      </FormControl>

                      {formData.initialRiskTreatmentCategory && !formData.existingControlsDescription?.trim() && (
                        <Alert status="warning" borderRadius="md">
                          <AlertIcon />
                          <Text fontSize="sm">
                            It is recommended to provide an Existing Controls Description when a treatment category is selected.
                          </Text>
                        </Alert>
                      )}

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
                        {!formData.initialRiskTreatmentCategory && (
                          <Alert status="info" borderRadius="md" mt={2}>
                            <AlertIcon />
                            <Text fontSize="sm">
                              All risks should have an Initial Risk Treatment Category. Please ensure this is set before completing the assessment.
                            </Text>
                          </Alert>
                        )}
                      </FormControl>
                    </VStack>
                  </TabPanel>

                  {/* Tab 4: Additional Controls Assessment */}
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

                      <FormControl>
                        <FormLabel>
                          Mitigation Description
                          <Tooltip label="Describe the additional mitigation measures or controls that have been implemented to reduce the risk after the initial assessment">
                            <IconButton
                              aria-label="Info"
                              icon={<Text fontSize="xs">?</Text>}
                              size="xs"
                              variant="ghost"
                              ml={1}
                              verticalAlign="middle"
                            />
                          </Tooltip>
                        </FormLabel>
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

                      {/* Guidance messages based on treatment category */}
                      {formData.initialRiskTreatmentCategory === 'RETAIN' && (
                        <Alert status="warning" borderRadius="md">
                          <AlertIcon />
                          <Text fontSize="sm">
                            This risk is set to RETAIN. Additional Controls Assessment is typically not needed for RETAIN risks, as you are accepting the risk as-is.
                          </Text>
                        </Alert>
                      )}

                      {formData.initialRiskTreatmentCategory === 'MODIFY' && (() => {
                        const hasMitigatedScores = 
                          formData.mitigatedConfidentialityScore !== null ||
                          formData.mitigatedIntegrityScore !== null ||
                          formData.mitigatedAvailabilityScore !== null ||
                          formData.mitigatedLikelihood !== null ||
                          formData.mitigatedRiskScore !== null;
                        const hasMitigationDescription = formData.mitigationDescription && formData.mitigationDescription.trim().length > 0;
                        const isComplete = hasMitigatedScores && hasMitigationDescription;
                        const currentRiskLevel = getRiskLevel(calculatedRiskScore);
                        // Non-conformance only applies to MODIFY risks with MEDIUM or HIGH initial risk scores
                        const shouldShowNonConformance = currentRiskLevel !== 'LOW';
                        
                        return (
                          <>
                            {!isComplete && shouldShowNonConformance ? (
                              <Alert status="error" borderRadius="md">
                                <AlertIcon />
                                <VStack align="start" spacing={1}>
                                  <Text fontSize="sm" fontWeight="bold">
                                    Policy Non-Conformance
                                  </Text>
                                  <Text fontSize="sm">
                                    This risk is set to MODIFY with a {currentRiskLevel} initial risk score, which requires Additional Controls Assessment to be completed. Please fill in both mitigated scores and mitigation description.
                                  </Text>
                                </VStack>
                              </Alert>
                            ) : !isComplete && !shouldShowNonConformance ? (
                              <Alert status="info" borderRadius="md">
                                <AlertIcon />
                                <Text fontSize="sm">
                                  This risk is set to MODIFY but has a LOW initial risk score. Additional Controls Assessment is recommended but not required for policy compliance.
                                </Text>
                              </Alert>
                            ) : isComplete ? (
                              <Alert status="success" borderRadius="md">
                                <AlertIcon />
                                <Text fontSize="sm">
                                  Additional Controls Assessment is complete for this MODIFY risk.
                                </Text>
                              </Alert>
                            ) : null}
                          </>
                        );
                      })()}

                      {formData.initialRiskTreatmentCategory && formData.initialRiskTreatmentCategory !== 'RETAIN' && formData.initialRiskTreatmentCategory !== 'MODIFY' && (
                        <Alert status="info" borderRadius="md">
                          <AlertIcon />
                          <Text fontSize="sm">
                            For {formData.initialRiskTreatmentCategory} risks, Additional Controls Assessment may be optional depending on your risk management approach.
                          </Text>
                        </Alert>
                      )}

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

                  {/* Tab 5: Controls Linkage */}
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
                            ref={controlSearchInputRef}
                            placeholder="Search by control code or title..."
                            value={controlSearchTerm}
                            onChange={(e) => {
                              setControlSearchTerm(e.target.value);
                              setSelectedSuggestionIndex(-1); // Reset selection when typing
                            }}
                            onKeyDown={(e) => {
                              if (viewMode) return;

                              const filteredControls = controls
                                .filter(
                                  (c) =>
                                    !selectedControlIds.includes(c.id) &&
                                    (c.code.toLowerCase().includes(controlSearchTerm.toLowerCase()) ||
                                      c.title.toLowerCase().includes(controlSearchTerm.toLowerCase()))
                                )
                                .slice(0, 10);

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSelectedSuggestionIndex((prev) =>
                                  prev < filteredControls.length - 1 ? prev + 1 : prev
                                );
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
                              } else if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent form submission
                                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < filteredControls.length) {
                                  // Select highlighted suggestion
                                  const selectedControl = filteredControls[selectedSuggestionIndex];
                                  if (!selectedControlIds.includes(selectedControl.id)) {
                                    setSelectedControlIds([...selectedControlIds, selectedControl.id]);
                                    setControlSearchTerm('');
                                    setSelectedSuggestionIndex(-1);
                                    // Return focus to input
                                    setTimeout(() => {
                                      controlSearchInputRef.current?.focus();
                                    }, 0);
                                  }
                                } else if (controlSearchTerm.trim()) {
                                  // Try to find and add control by code (fallback behavior)
                                  const found = controls.find(
                                    (c) =>
                                      c.code.toLowerCase() === controlSearchTerm.trim().toLowerCase() ||
                                      c.code.toLowerCase().includes(controlSearchTerm.trim().toLowerCase())
                                  );
                                  if (found && !selectedControlIds.includes(found.id)) {
                                    setSelectedControlIds([...selectedControlIds, found.id]);
                                    setControlSearchTerm('');
                                    setSelectedSuggestionIndex(-1);
                                    // Return focus to input
                                    setTimeout(() => {
                                      controlSearchInputRef.current?.focus();
                                    }, 0);
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                setControlSearchTerm('');
                                setSelectedSuggestionIndex(-1);
                              }
                            }}
                            isReadOnly={viewMode}
                            isDisabled={viewMode}
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
                            .map((control, index) => {
                              const isHighlighted = index === selectedSuggestionIndex;
                              return (
                                <Box
                                  key={control.id}
                                  p={2}
                                  bg={isHighlighted ? 'blue.100' : 'transparent'}
                                  _hover={viewMode ? {} : { bg: isHighlighted ? 'blue.100' : 'gray.100', cursor: 'pointer' }}
                                  onClick={() => {
                                    if (!viewMode) {
                                      setSelectedControlIds([...selectedControlIds, control.id]);
                                      setControlSearchTerm('');
                                      setSelectedSuggestionIndex(-1);
                                      // Return focus to input
                                      setTimeout(() => {
                                        controlSearchInputRef.current?.focus();
                                      }, 0);
                                    }
                                  }}
                                  cursor={viewMode ? 'not-allowed' : 'pointer'}
                                  opacity={viewMode ? 0.6 : 1}
                                >
                                  <Text fontWeight="medium">{control.code}</Text>
                                  <Text fontSize="sm" color="gray.600">
                                    {control.title}
                                  </Text>
                                </Box>
                              );
                            })}
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
                                      if (!viewMode) {
                                        setSelectedControlIds(selectedControlIds.filter((id) => id !== controlId));
                                      }
                                    }}
                                    isDisabled={viewMode}
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

              {/* Similar Risks Panel - shown when viewing existing risk */}
              {showSimilarRisks && risk && (
                <Box mt={4} pt={4} borderTopWidth="1px" borderColor="gray.200">
                  <SimilarRisksPanel
                    similarRisks={similarRisks}
                    onViewRisk={handleViewSimilarRisk}
                    onSelectRisk={handleSelectSimilarRisk}
                    selectedRiskIds={selectedSimilarRiskIds}
                    onBulkDelete={handleBulkDeleteSimilarRisks}
                    loading={similarRisksLoading}
                    threshold={70}
                    progress={similarityProgress.total > 0 ? similarityProgress : undefined}
                  />
                </Box>
              )}
            </ModalBody>

            <ModalFooter flexShrink={0}>
              <Button variant="ghost" mr={3} onClick={handleCloseAttempt}>
                {viewMode ? 'Close' : 'Cancel'}
              </Button>

              {/* Delete button on the left side (destructive action) */}
              {!isDuplicateMode && risk && onDelete && (
                <Button
                  leftIcon={<DeleteIcon />}
                  onClick={() => {
                    onDelete(risk);
                    onClose();
                  }}
                  colorScheme="red"
                  variant="outline"
                  mr="auto"
                >
                  Delete
                </Button>
              )}

              {/* Find Similar Risks button - only show when viewing existing risk */}
              {!viewMode && !isDuplicateMode && risk && (
                <Button
                  variant="outline"
                  mr={3}
                  onClick={handleFindSimilarRisks}
                  isLoading={similarRisksLoading}
                >
                  Find Similar Risks
                </Button>
              )}

              {/* Duplicate button */}
              {!isDuplicateMode && risk && onDuplicate && (
                <Button
                  leftIcon={<CopyIcon />}
                  onClick={() => {
                    onDuplicate(risk);
                  }}
                  colorScheme="blue"
                  variant="outline"
                  mr={3}
                >
                  Duplicate
                </Button>
              )}

              {/* Edit button - show when in view mode */}
              {viewMode && onEdit && (
                <Button colorScheme="blue" onClick={onEdit} leftIcon={<EditIcon />}>
                  Edit
                </Button>
              )}

              {/* Primary action button (Update/Create) */}
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

      {/* Link Supplier Modal */}
      {risk && (
        <Modal isOpen={isSupplierModalOpen} onClose={onSupplierModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Link Supplier to Risk</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Input
                  placeholder="Search suppliers by name..."
                  value={supplierSearchTerm}
                  onChange={(e) => setSupplierSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      searchSuppliers();
                    }
                  }}
                />
                <Button onClick={searchSuppliers} isLoading={searchingSuppliers} size="sm">
                  Search
                </Button>

                {availableSuppliers.length > 0 && (
                  <Box maxH="400px" overflowY="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Type</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Array.isArray(availableSuppliers) && availableSuppliers.map((supplier) => (
                          <Tr key={supplier.id}>
                            <Td>{supplier.name}</Td>
                            <Td>{supplier.supplierType?.replace(/_/g, ' ')}</Td>
                            <Td>
                              <Button
                                size="xs"
                                colorScheme="blue"
                                onClick={() => handleLinkSupplier(supplier.id)}
                                isLoading={linkingSupplier}
                              >
                                Link
                              </Button>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {supplierSearchTerm && availableSuppliers.length === 0 && !searchingSuppliers && (
                  <Text color="gray.500" fontStyle="italic">
                    No suppliers found
                  </Text>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onSupplierModalClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
