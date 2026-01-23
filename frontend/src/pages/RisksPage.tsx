/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Tr,
  Td,
  Button,
  HStack,
  VStack,
  Badge,
  useDisclosure,
  useToast,
  Checkbox,
  Text,
  Tooltip,
  Input,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { DeleteIcon, DownloadIcon, HamburgerIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { RiskFormModal } from '../components/RiskFormModal';
import { DepartmentRiskTable } from '../components/DepartmentRiskTable';
import { StaffRiskTable } from '../components/StaffRiskTable';
import { useAuth } from '../contexts/AuthContext';
import { DataTable, Column, FilterConfig, PaginationConfig, SortConfig, CSVExportConfig } from '../components/DataTable';
import { formatBoolean, generateCSV } from '../utils/tableUtils';
import { useDebounce } from '../hooks/useDebounce';
import { usePageTitle } from '../hooks/usePageTitle';

interface Risk {
  id: string;
  title: string;
  description: string | null;
  dateAdded: string;
  riskCategory: string | null;
  riskNature: string | null;
  archived: boolean;
  archivedDate: string | null;
  expiryDate: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  ownerUserId: string | null;
  assetCategory: string | null;
  assetIds: string[] | null;
  assetCategoryId: string | null;
  assets: Array<{
    id: string;
    nameSerialNo: string | null;
    model: string | null;
    category: {
      id: string;
      name: string;
    };
  }> | null;
  linkedAssetCategory: {
    id: string;
    name: string;
  } | null;
  interestedParty: {
    id: string;
    name: string;
    group: string | null;
  } | null;
  threatDescription: string | null;
  confidentialityScore: number;
  integrityScore: number;
  availabilityScore: number;
  riskScore: number | null;
  likelihood: number;
  calculatedScore: number;
  initialRiskTreatmentCategory: string | null;
  mitigatedConfidentialityScore: number | null;
  mitigatedIntegrityScore: number | null;
  mitigatedAvailabilityScore: number | null;
  mitigatedRiskScore: number | null;
  mitigatedLikelihood: number | null;
  mitigatedScore: number | null;
  mitigationImplemented: boolean;
  residualRiskTreatmentCategory: string | null;
  annexAControlsRaw: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  riskControls: Array<{
    control: {
      id: string;
      code: string;
      title: string;
    };
  }>;
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

export function RisksPage() {
  usePageTitle('Risks', true);
  const toast = useToast();
  const navigate = useNavigate();
  const { user, getEffectiveRole } = useAuth();
  const effectiveRole = getEffectiveRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set());
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [totalRisksCount, setTotalRisksCount] = useState<number>(0); // Total without filters
  const [savedViews, setSavedViews] = useState<Array<{ name: string; filters: typeof filters }>>([]);
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useDisclosure();
  const { isOpen: isSaveViewOpen, onOpen: onSaveViewOpen, onClose: onSaveViewClose } = useDisclosure();
  const [viewName, setViewName] = useState('');
  const cancelRef = useRef(null);
  const viewRiskProcessedRef = useRef<string | null>(null);

  // Initialize filters from URL params on mount
  const getInitialFilters = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      riskCategory: '',
      riskNature: '',
      archived: 'false' as 'false' | 'true' | 'all',
      ownerId: '',
      treatmentCategory: '',
      mitigationImplemented: params.get('mitigationImplemented') || '',
      mitigatedScorePresent: params.get('mitigatedScorePresent') || '',
      policyNonConformance: params.get('policyNonConformance') || '',
      controlsApplied: '',
      reviewStatus: params.get('reviewStatus') || '',
      acceptedAboveAppetite: params.get('acceptedAboveAppetite') || '',
      riskIds: params.get('riskIds') || '',
      riskLevel: params.get('riskLevel') || '',
      likelihood: params.get('likelihood') || '',
      impact: params.get('impact') || '',
      search: '',
      dateAddedFrom: '',
      dateAddedTo: '',
      assetCategoryId: params.get('assetCategoryId') || '',
      status: params.get('status') || '',
      department: params.get('department') || '',
      sortBy: 'calculatedScore',
      sortOrder: 'desc' as 'asc' | 'desc',
      page: 1,
      limit: 20,
    };
  };

  // Filters and pagination
  const [filters, setFilters] = useState(getInitialFilters);

  // Track if we've initialized filters from URL to avoid re-initializing

  // Separate search state for immediate UI updates (must be declared before useDebounce)
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounced search to reduce API calls
  const debouncedSearch = useDebounce(searchInput, 300);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Column visibility state with localStorage persistence
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('risks-visible-columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // If parsing fails, use defaults
      }
    }
    return {
      title: true,
      riskCategory: true,
      riskNature: true,
      owner: true,
      cia: true,
      likelihood: true,
      initialScore: true,
      treatment: true,
      mitigatedCIA: true,
      mitigatedLikelihood: true,
      mitigatedScore: true,
      residualTreatment: true,
      controls: true,
    };
  };

  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);

  // Persist column visibility to localStorage
  const updateVisibleColumns = (newColumns: typeof visibleColumns) => {
    setVisibleColumns(newColumns);
    localStorage.setItem('risks-visible-columns', JSON.stringify(newColumns));
  };

  // Load saved views from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('risks-saved-views');
    if (saved) {
      try {
        setSavedViews(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved views:', e);
      }
    }
  }, []);

  // Save views to localStorage when they change
  useEffect(() => {
    if (savedViews.length > 0) {
      localStorage.setItem('risks-saved-views', JSON.stringify(savedViews));
    }
  }, [savedViews]);

  // Sync debounced search with filters
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters(prev => ({ ...prev, search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch]);

  // Sync search input with filters.search when it changes externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const fetchRisks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.riskCategory) params.append('riskCategory', filters.riskCategory);
      if (filters.riskNature) params.append('riskNature', filters.riskNature);
      if (filters.archived === 'all') {
        params.append('archived', 'all');
      } else if (filters.archived === 'true') {
        params.append('archived', 'true');
      } else if (filters.archived === 'false' || !filters.archived) {
        // Default to 'false' (Active Only) if empty or explicitly 'false'
        params.append('archived', 'false');
      }
      if (filters.ownerId) params.append('ownerId', filters.ownerId);
      if (filters.treatmentCategory) params.append('treatmentCategory', filters.treatmentCategory);
      if (filters.mitigationImplemented !== '')
        params.append('mitigationImplemented', filters.mitigationImplemented === 'true' ? 'true' : 'false');
      if (filters.mitigatedScorePresent !== '')
        params.append('mitigatedScorePresent', filters.mitigatedScorePresent === 'true' ? 'true' : 'false');
      if (filters.policyNonConformance !== '')
        params.append('policyNonConformance', filters.policyNonConformance === 'true' ? 'true' : 'false');
      if (filters.controlsApplied !== '')
        params.append('controlsApplied', filters.controlsApplied === 'true' ? 'true' : 'false');
      if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
      if (filters.acceptedAboveAppetite !== '')
        params.append('acceptedAboveAppetite', filters.acceptedAboveAppetite === 'true' ? 'true' : 'false');
      if (filters.riskIds) params.append('riskIds', filters.riskIds);
      if (filters.riskLevel) {
        params.append('riskLevel', filters.riskLevel);
      }
      if (filters.likelihood) params.append('likelihood', filters.likelihood);
      if (filters.impact) params.append('impact', filters.impact);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateAddedFrom) params.append('dateAddedFrom', filters.dateAddedFrom);
      if (filters.dateAddedTo) params.append('dateAddedTo', filters.dateAddedTo);
      if (filters.status) params.append('status', filters.status);
      if (filters.department) params.append('department', filters.department);
      if (filters.assetCategoryId) params.append('assetCategoryId', filters.assetCategoryId);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await api.get(`/api/risks?${params.toString()}`);
      setRisks(response.data.data);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }

      // Fetch total count without filters for pagination display
      const totalParams = new URLSearchParams();
      totalParams.append('page', '1');
      totalParams.append('limit', '1');
      try {
        const totalResponse = await api.get(`/api/risks?${totalParams.toString()}`);
        if (totalResponse.data.pagination) {
          setTotalRisksCount(totalResponse.data.pagination.total || 0);
        }
      } catch (e) {
        // Ignore error, use current pagination total as fallback
        setTotalRisksCount(response.data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Error fetching risks:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch risks',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // Initialize filters from URL query parameters
  useEffect(() => {
    const mitigationImplementedParam = searchParams.get('mitigationImplemented');
    const mitigatedScorePresentParam = searchParams.get('mitigatedScorePresent');
    const policyNonConformanceParam = searchParams.get('policyNonConformance');
    const riskLevelParam = searchParams.get('riskLevel');
    const assetCategoryIdParam = searchParams.get('assetCategoryId');
    const statusParam = searchParams.get('status');
    const departmentParam = searchParams.get('department');
    const riskCategoryParam = searchParams.get('riskCategory');
    const ownerIdParam = searchParams.get('ownerId');
    const reviewStatusParam = searchParams.get('reviewStatus');
    const acceptedAboveAppetiteParam = searchParams.get('acceptedAboveAppetite');
    const riskIdsParam = searchParams.get('riskIds');

    
    // Skip if we're handling view/edit params (those are handled separately)
    const viewParam = searchParams.get('view');
    const editParam = searchParams.get('edit');
    if (viewParam || editParam) {
      return;
    }

    // Check if we have filter params that differ from current filters
    const hasFilterParams = mitigationImplementedParam !== null
      || mitigatedScorePresentParam !== null
      || policyNonConformanceParam !== null
      || riskLevelParam !== null
      || assetCategoryIdParam !== null
      || statusParam !== null
      || departmentParam !== null
      || riskCategoryParam !== null
      || ownerIdParam !== null
      || reviewStatusParam !== null
      || acceptedAboveAppetiteParam !== null
      || riskIdsParam !== null;
    
    if (hasFilterParams) {
      // Always update filters when URL params are present to ensure they're applied
      setFilters(prev => ({
        ...prev,
        mitigationImplemented: mitigationImplementedParam !== null ? mitigationImplementedParam : prev.mitigationImplemented,
        mitigatedScorePresent: mitigatedScorePresentParam !== null ? mitigatedScorePresentParam : prev.mitigatedScorePresent,
        policyNonConformance: policyNonConformanceParam !== null ? policyNonConformanceParam : prev.policyNonConformance,
        riskLevel: riskLevelParam !== null ? riskLevelParam : prev.riskLevel,
        assetCategoryId: assetCategoryIdParam !== null ? assetCategoryIdParam : prev.assetCategoryId,
        status: statusParam !== null ? statusParam : prev.status,
        department: departmentParam !== null ? departmentParam : prev.department,
        riskCategory: riskCategoryParam !== null ? riskCategoryParam : prev.riskCategory,
        ownerId: ownerIdParam !== null ? ownerIdParam : prev.ownerId,
        reviewStatus: reviewStatusParam !== null ? reviewStatusParam : prev.reviewStatus,
        acceptedAboveAppetite: acceptedAboveAppetiteParam !== null ? acceptedAboveAppetiteParam : prev.acceptedAboveAppetite,
        riskIds: riskIdsParam !== null ? riskIdsParam : prev.riskIds,
        page: 1, // Reset to first page when filter changes
      }));

      
      // Remove the params from URL after a delay to ensure filters are applied first
      // Keep assetCategoryId in URL longer to ensure it's applied
      const timeoutId = setTimeout(() => {
        setSearchParams(prev => {
          const newSearchParams = new URLSearchParams(prev);
          if (mitigationImplementedParam !== null) newSearchParams.delete('mitigationImplemented');
          if (mitigatedScorePresentParam !== null) newSearchParams.delete('mitigatedScorePresent');
          if (policyNonConformanceParam !== null) newSearchParams.delete('policyNonConformance');
          if (riskLevelParam !== null) newSearchParams.delete('riskLevel');
          if (reviewStatusParam !== null) newSearchParams.delete('reviewStatus');
          if (acceptedAboveAppetiteParam !== null) newSearchParams.delete('acceptedAboveAppetite');
          if (riskIdsParam !== null) newSearchParams.delete('riskIds');
          // Don't remove assetCategoryId - keep it in URL for better UX
          return newSearchParams;
        });
      }, 500);

      
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchRisks();
    // Clear selections when filters change
    setSelectedRiskIds(new Set());
  }, [fetchRisks]);

  // Handle view/edit query parameters - open risk in view or edit mode
  useEffect(() => {
    const viewRiskId = searchParams.get('view');
    const editRiskId = searchParams.get('edit');
    const riskId = editRiskId || viewRiskId;
    const shouldEdit = !!editRiskId;

    
    if (riskId && viewRiskProcessedRef.current !== riskId) {
      // First check if risk is in current list
      const risk = risks.find(r => r.id === riskId);
      if (risk) {
        viewRiskProcessedRef.current = riskId;
        setSelectedRisk(risk);
        setViewMode(!shouldEdit);
        onOpen();
        // Remove view/edit parameter from URL
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('view');
        newSearchParams.delete('edit');
        setSearchParams(newSearchParams, { replace: true });
      } else if (!loading) {
        // Risk not in current page, fetch it directly
        // Only fetch if we're not currently loading (to avoid duplicate requests)
        viewRiskProcessedRef.current = riskId;
        const fetchRiskById = async () => {
          try {
            const response = await api.get(`/api/risks/${riskId}`);
            if (response.data) {
              setSelectedRisk(response.data);
              setViewMode(!shouldEdit);
              onOpen();
              // Remove view/edit parameter from URL
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.delete('view');
              newSearchParams.delete('edit');
              setSearchParams(newSearchParams, { replace: true });
            }
          } catch (error: any) {
            console.error('Error fetching risk:', error);
            toast({
              title: 'Error',
              description: 'Risk not found',
              status: 'error',
              duration: 3000,
              isClosable: true,
            });
            // Remove view/edit parameter even on error
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('view');
            newSearchParams.delete('edit');
            setSearchParams(newSearchParams, { replace: true });
          }
        };
        fetchRiskById();
      }
    } else if (!riskId && viewRiskProcessedRef.current) {
      // Reset when view/edit parameter is removed
      viewRiskProcessedRef.current = null;
    }
  }, [searchParams, risks, loading, onOpen, setSearchParams, toast]);

  // Handle highlighting a risk when navigating from control detail
  useEffect(() => {
    const highlightRiskId = sessionStorage.getItem('highlightRiskId');
    if (highlightRiskId && risks.length > 0) {
      sessionStorage.removeItem('highlightRiskId');
      // Wait a bit for the DOM to update, then scroll to the risk
      const scrollToRisk = () => {
        const riskElement = document.getElementById(`risk-${highlightRiskId}`);
        if (riskElement) {
          riskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Temporarily highlight the row with a yellow background
          const originalBg = riskElement.style.backgroundColor;
          riskElement.style.backgroundColor = '#fef3c7';
          riskElement.style.transition = 'background-color 0.3s';
          setTimeout(() => {
            riskElement.style.backgroundColor = originalBg || '';
            setTimeout(() => {
              riskElement.style.transition = '';
            }, 300);
          }, 2000);
        } else {
          // If element not found yet, try again after a short delay
          setTimeout(scrollToRisk, 100);
        }
      };
      // Small delay to ensure DOM is ready
      setTimeout(scrollToRisk, 100);
    }
  }, [risks, loading]);

  const handleEdit = useCallback((risk: Risk) => {
    setSelectedRisk(risk);
    setIsDuplicateMode(false);
    setViewMode(false);
    onOpen();
  }, [onOpen]);



  const handleCreate = useCallback(() => {
    setSelectedRisk(null);
    setIsDuplicateMode(false);
    setViewMode(false);
    onOpen();
  }, [onOpen]);

  const handleDuplicate = useCallback((risk: Risk) => {
    // Create a copy of the risk without the id and with "Copy of" prefix
    // Copy ALL fields including text areas and dropdown selections
    const duplicatedRisk = {
      ...risk,
      id: undefined,
      title: `Copy of ${risk.title}`,
      description: risk.description || '',
      threatDescription: risk.threatDescription || '',
      assetCategory: risk.assetCategory || '',
      interestedPartyId: risk.interestedParty?.id || '',
      dateAdded: new Date().toISOString().split('T')[0],
      // Reset mitigated scores for the duplicate
      mitigatedConfidentialityScore: null,
      mitigatedIntegrityScore: null,
      mitigatedAvailabilityScore: null,
      mitigatedRiskScore: null,
      mitigatedLikelihood: null,
      mitigatedScore: null,
      mitigatedRiskLevel: null,
      mitigationImplemented: false,
      residualRiskTreatmentCategory: null,
      // Keep control associations
      riskControls: risk.riskControls || [],
    };
    setSelectedRisk(duplicatedRisk as any);
    setIsDuplicateMode(true);
    onOpen();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    onClose();
    setSelectedRisk(null);
    setIsDuplicateMode(false);
    setViewMode(false);
    fetchRisks();
    // Success toast will be shown by RiskFormModal
  }, [onClose, fetchRisks]);

  const handleDelete = useCallback((risk: Risk) => {
    setRiskToDelete(risk);
    onDeleteOpen();
  }, [onDeleteOpen]);

  const confirmDelete = async () => {
    if (!riskToDelete) return;

    try {
      await api.delete(`/api/risks/${riskToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Risk deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      setRiskToDelete(null);
      fetchRisks();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete risk';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.riskCategory) count++;
    if (filters.riskNature) count++;
    if (filters.archived && filters.archived !== 'all' && filters.archived !== 'false') count++;
    if (filters.ownerId) count++;
    if (filters.treatmentCategory) count++;
    if (filters.mitigationImplemented) count++;
    if (filters.policyNonConformance) count++;
    if (filters.controlsApplied) count++;
    if (filters.riskLevel) count++;
    if (filters.search) count++;
    if (filters.dateAddedFrom || filters.dateAddedTo) count++;
    return count;
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdminOrEditor = user?.role === 'ADMIN' || user?.role === 'EDITOR';

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
        return 'orange';
      case 'LOW':
        return 'green';
      default:
        return 'gray';
    }
  };

  // Get color for score badge - uses risk level color for consistency
  const getScoreColor = (score: number): string => {
    const level = getRiskLevel(score);
    return getRiskLevelColor(level);
  };

  const getRowBgColor = (risk: Risk): string => {
    // Highlight selected rows
    if (selectedRiskIds.has(risk.id)) {
      return 'blue.100';
    }
    // Color by risk level
    const level = risk.mitigatedScore ? risk.mitigatedRiskLevel : risk.riskLevel;
    if (level === 'HIGH') return 'red.50';
    if (level === 'MEDIUM') return 'orange.50';
    return 'green.50';
  };

  const handleSort = (field: string) => {
    // If clicking a different field, sort ascending
    if (filters.sortBy !== field) {
      setFilters({
        ...filters,
        sortBy: field,
        sortOrder: 'asc',
        page: 1,
      });
    } 
    // If clicking the same field and it's ascending, sort descending
    else if (filters.sortOrder === 'asc') {
      setFilters({
        ...filters,
        sortBy: field,
        sortOrder: 'desc',
        page: 1,
      });
    }
    // If clicking the same field and it's descending, clear sort (reset to default)
    else {
      setFilters({
        ...filters,
        sortBy: 'calculatedScore',
        sortOrder: 'desc',
        page: 1,
      });
    }
  };

  const handleSelectRisk = (riskId: string, isSelected: boolean) => {
    setSelectedRiskIds((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(riskId);
      } else {
        newSet.delete(riskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      // Select all risks on current page
      setSelectedRiskIds(new Set(risks.map((r) => r.id)));
    } else {
      // Deselect all
      setSelectedRiskIds(new Set());
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedRiskIds.size === 0) return;

    try {
      const deletePromises = Array.from(selectedRiskIds).map((id) =>
        api.delete(`/api/risks/${id}`)
      );
      await Promise.all(deletePromises);

      const deletedCount = selectedRiskIds.size;
      toast({
        title: 'Success',
        description: `${deletedCount} risk(s) deleted successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onBulkDeleteClose();
      setSelectedRiskIds(new Set());
      fetchRisks();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete risks';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Saved views functions
  const handleSaveView = useCallback(() => {
    if (!viewName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for this view',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    const newView = { name: viewName.trim(), filters: { ...filters } };
    setSavedViews([...savedViews, newView]);
    setViewName('');
    onSaveViewClose();
    toast({
      title: 'View Saved',
      description: `Saved view "${newView.name}"`,
      status: 'success',
      duration: 3000,
    });
  }, [viewName, filters, savedViews, onSaveViewClose, toast]);

  const handleLoadView = useCallback((view: { name: string; filters: typeof filters }) => {
    setFilters(view.filters);
    setSearchInput(view.filters.search);
    toast({
      title: 'View Loaded',
      description: `Loaded view "${view.name}"`,
      status: 'success',
      duration: 3000,
    });
  }, [toast]);

  const handleDeleteView = useCallback((index: number) => {
    const view = savedViews[index];
    setSavedViews(savedViews.filter((_, i) => i !== index));
    toast({
      title: 'View Deleted',
      description: `Deleted view "${view.name}"`,
      status: 'success',
      duration: 3000,
    });
  }, [savedViews, toast]);

  // Build columns dynamically based on visibleColumns - memoized for performance
  const buildColumns = useMemo((): Column<Risk>[] => {
    const cols: Column<Risk>[] = [];

    // Date Added column - always first, always visible
    cols.push({
      key: 'dateAdded',
      header: 'Date Added',
      sortable: true,
      minW: '130px',
      render: (risk) => {
        if (!risk.dateAdded) {
          return <Text fontSize="xs" color="gray.400">—</Text>;
        }
        const date = new Date(risk.dateAdded);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear().toString().slice(-2);
        return <Text fontSize="sm">{`${month}-${year}`}</Text>;
      },
    });

    if (visibleColumns.title) {
      cols.push({
        key: 'title',
        header: 'Title',
        sortable: true,
        sticky: true, // Make title column sticky
        width: '300px',
        minW: '300px',
        render: (risk) => (
          <Tooltip label={risk.title} placement="top-start">
            <VStack align="start" spacing={0}>
              <Text
                fontWeight="medium"
                fontSize="sm"
                whiteSpace="normal"
                noOfLines={2}
                textOverflow="ellipsis"
                overflow="hidden"
                lineHeight="1.4"
              >
                {risk.title}
              </Text>
              {risk.archived && risk.archivedDate && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Archived: {new Date(risk.archivedDate).toLocaleDateString()}
                </Text>
              )}
            </VStack>
          </Tooltip>
        ),
      });
    }

    if (visibleColumns.riskCategory) {
      cols.push({
        key: 'riskCategory',
        header: 'Risk Category',
        sortable: false,
        minW: '150px',
        render: (risk) =>
          risk.riskCategory ? (
            <Text fontSize="sm">{risk.riskCategory.replace(/_/g, ' ')}</Text>
          ) : (
            <Text fontSize="xs" color="gray.400">—</Text>
          ),
      });
    }

    if (visibleColumns.riskNature) {
      cols.push({
        key: 'riskNature',
        header: 'Risk Nature',
        sortable: false,
        minW: '120px',
        render: (risk) =>
          risk.riskNature ? (
            <Badge colorScheme={risk.riskNature === 'STATIC' ? 'blue' : 'purple'}>
              {risk.riskNature}
            </Badge>
          ) : (
            <Text color="gray.400">N/A</Text>
          ),
      });
    }

    if (visibleColumns.owner) {
      cols.push({
        key: 'owner',
        header: 'Owner',
        sortable: false,
        minW: '150px',
        render: (risk) => (
          risk.owner ? (
            <Text fontSize="sm">{risk.owner.displayName}</Text>
          ) : (
            <Text fontSize="xs" color="gray.400">—</Text>
          )
        ),
      });
    }

    // Asset/Category is always visible
    cols.push({
      key: 'asset',
      header: 'Asset/Category',
      sortable: false,
      minW: '200px',
      render: (risk) => {
        const parts: string[] = [];
        if (risk.linkedAssetCategory) {
          parts.push(`Category: ${risk.linkedAssetCategory.name}`);
        }
        if (risk.assets && risk.assets.length > 0) {
          if (risk.assets.length === 1) {
            parts.push(`Asset: ${risk.assets[0].nameSerialNo || risk.assets[0].model || 'Asset'}`);
          } else {
            parts.push(`${risk.assets.length} assets`);
          }
        }
        if (parts.length === 0) {
          return <Text fontSize="xs" color="gray.400">—</Text>;
        }
        return (
          <VStack align="start" spacing={1}>
            {parts.map((part, idx) => (
              <Badge key={idx} colorScheme={idx === 0 && risk.linkedAssetCategory ? "purple" : "blue"} fontSize="xs">
                {part}
              </Badge>
            ))}
          </VStack>
        );
      },
    });

    // Interested Party is always visible
    cols.push({
      key: 'interestedParty',
      header: 'Interested Party',
      sortable: false,
      minW: '200px',
      render: (risk) => {
        // Treat "Unspecified" as empty - show emdash instead
        if (!risk.interestedParty || risk.interestedParty.name === 'Unspecified') {
          return <Text fontSize="xs" color="gray.400">—</Text>;
        }
        return (
          <Text fontSize="sm">
            {risk.interestedParty.name}
            {risk.interestedParty.group && ` (${risk.interestedParty.group})`}
          </Text>
        );
      },
    });

    if (visibleColumns.cia) {
      cols.push(
        {
          key: 'confidentialityScore',
          header: 'C',
          sortable: false,
          render: (risk) => risk.confidentialityScore,
        },
        {
          key: 'integrityScore',
          header: 'I',
          sortable: false,
          render: (risk) => risk.integrityScore,
        },
        {
          key: 'availabilityScore',
          header: 'A',
          sortable: false,
          render: (risk) => risk.availabilityScore,
        },
        {
          key: 'likelihood',
          header: 'L',
          sortable: false,
          render: (risk) => risk.likelihood,
        }
      );
    }

    if (visibleColumns.initialScore) {
      cols.push({
        key: 'calculatedScore',
        header: 'Initial Score',
        sortable: true,
        minW: '120px',
        render: (risk) => (
          <Box bg={`${getRiskLevelColor(risk.riskLevel)}.50`} px={3} py={2}>
            <VStack spacing={1} align="center">
              <Badge
                colorScheme={getScoreColor(risk.calculatedScore)}
                fontSize="md"
                px={3}
                py={1}
                minW="60px"
              >
                {risk.calculatedScore}
              </Badge>
              <Badge
                colorScheme={getRiskLevelColor(risk.riskLevel)}
                size="md"
                px={3}
                py={1}
                minW="60px"
              >
                {risk.riskLevel}
              </Badge>
            </VStack>
          </Box>
        ),
      });
    }

    if (visibleColumns.treatment) {
      cols.push({
        key: 'initialRiskTreatmentCategory',
        header: 'Treatment',
        sortable: false,
        minW: '120px',
        render: (risk) => {
          const hasMitigatedScores = 
            risk.mitigatedConfidentialityScore !== null ||
            risk.mitigatedIntegrityScore !== null ||
            risk.mitigatedAvailabilityScore !== null ||
            risk.mitigatedLikelihood !== null ||
            risk.mitigatedScore !== null;
          const hasMitigationDescription = (risk as any).mitigationDescription && (risk as any).mitigationDescription.trim().length > 0;
          // Non-conformance only applies to MODIFY risks with MEDIUM or HIGH initial risk scores
          const hasNonConformance =
            risk.initialRiskTreatmentCategory === 'MODIFY' &&
            risk.riskLevel !== 'LOW' &&
            !(hasMitigatedScores && hasMitigationDescription);
          
          return risk.initialRiskTreatmentCategory ? (
            <HStack spacing={2}>
              <Text fontSize="sm">{risk.initialRiskTreatmentCategory}</Text>
              {hasNonConformance && (
                <Tooltip label="Policy Non-Conformance: MODIFY risk without complete Additional Controls Assessment">
                  <Badge colorScheme="red" fontSize="xs" cursor="help">
                    !
                  </Badge>
                </Tooltip>
              )}
            </HStack>
          ) : (
            <Text fontSize="xs" color="gray.400">—</Text>
          );
        },
      });
    }

    if (visibleColumns.mitigatedCIA) {
      cols.push(
        {
          key: 'mitigatedConfidentialityScore',
          header: 'MC',
          sortable: false,
          render: (risk) =>
            risk.mitigatedConfidentialityScore !== null ? (
              risk.mitigatedConfidentialityScore
            ) : (
              <Text as="span" color="gray.400">—</Text>
            ),
        },
        {
          key: 'mitigatedIntegrityScore',
          header: 'MI',
          sortable: false,
          render: (risk) =>
            risk.mitigatedIntegrityScore !== null ? (
              risk.mitigatedIntegrityScore
            ) : (
              <Text as="span" color="gray.400">—</Text>
            ),
        },
        {
          key: 'mitigatedAvailabilityScore',
          header: 'MA',
          sortable: false,
          render: (risk) =>
            risk.mitigatedAvailabilityScore !== null ? (
              risk.mitigatedAvailabilityScore
            ) : (
              <Text as="span" color="gray.400">—</Text>
            ),
        },
        {
          key: 'mitigatedLikelihood',
          header: 'ML',
          sortable: false,
          render: (risk) =>
            risk.mitigatedLikelihood !== null ? (
              risk.mitigatedLikelihood
            ) : (
              <Text as="span" color="gray.400">—</Text>
            ),
        }
      );
    }

    if (visibleColumns.mitigatedScore) {
      cols.push({
        key: 'mitigatedScore',
        header: 'Mitigated Score',
        sortable: true,
        minW: '120px',
        render: (risk) =>
          risk.mitigatedScore !== null && risk.mitigatedRiskLevel ? (
            <Box bg={`${getRiskLevelColor(risk.mitigatedRiskLevel)}.50`} px={3} py={2}>
              <VStack spacing={1} align="center">
                <Badge
                  colorScheme={getScoreColor(risk.mitigatedScore)}
                  fontSize="md"
                  px={3}
                  py={1}
                  minW="60px"
                >
                  {risk.mitigatedScore}
                </Badge>
                <Badge
                  colorScheme={getRiskLevelColor(risk.mitigatedRiskLevel)}
                  size="md"
                  px={3}
                  py={1}
                  minW="60px"
                >
                  {risk.mitigatedRiskLevel}
                </Badge>
              </VStack>
            </Box>
          ) : (
            <Text color="gray.400">—</Text>
          ),
      });
    }

    if (visibleColumns.residualTreatment) {
      cols.push({
        key: 'residualRiskTreatmentCategory',
        header: 'Residual Treatment',
        sortable: false,
        render: (risk) =>
          risk.residualRiskTreatmentCategory ? (
            <Text fontSize="sm">{risk.residualRiskTreatmentCategory}</Text>
          ) : (
            <Text fontSize="xs" color="gray.400">—</Text>
          ),
      });
    }

    if (visibleColumns.controls) {
      cols.push({
        key: 'controls',
        header: 'Controls',
        sortable: false,
        minW: '200px',
        render: (risk) =>
          risk.riskControls.length > 0 ? (
            <HStack spacing={1} flexWrap="wrap">
              {risk.riskControls.map((rc) => (
                <Tooltip key={rc.control.id} label={rc.control.title}>
                  <Text
                    fontSize="xs"
                    as="a"
                    href={`/admin/risks/controls`}
                    color="blue.600"
                    _hover={{ textDecoration: 'underline', color: 'blue.800' }}
                    cursor="pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/admin/risks/controls');
                    }}
                  >
                    {rc.control.code}
                  </Text>
                </Tooltip>
              ))}
            </HStack>
          ) : (
            <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5}>
              No controls
            </Badge>
          ),
      });
    }

    return cols;
  }, [visibleColumns, user]);

  const filterConfigs: FilterConfig[] = [
    {
      key: 'search',
      type: 'search',
      placeholder: 'Search by title or description...',
    },
    {
      key: 'riskCategory',
      type: 'select',
      placeholder: 'Risk Category',
      options: RISK_CATEGORIES.map((cat) => ({ value: cat, label: cat.replace(/_/g, ' ') })),
    },
    {
      key: 'riskNature',
      type: 'select',
      placeholder: 'Risk Nature',
      options: RISK_NATURES.map((nature) => ({ value: nature, label: nature })),
    },
    {
      key: 'archived',
      type: 'select',
      placeholder: '',
      options: [
        { value: 'false', label: 'Active Only' },
        { value: 'true', label: 'Archived Only' },
        { value: 'all', label: 'All Risks' },
      ],
    },
    {
      key: 'treatmentCategory',
      type: 'select',
      placeholder: 'Treatment Category',
      options: TREATMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
    },
    {
      key: 'riskLevel',
      type: 'select',
      placeholder: 'Risk Level',
      options: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
      ],
    },
    {
      key: 'mitigationImplemented',
      type: 'select',
      placeholder: 'Mitigation Status',
      options: [
        { value: 'true', label: 'Implemented' },
        { value: 'false', label: 'Not Implemented' },
      ],
    },
    {
      key: 'policyNonConformance',
      type: 'select',
      placeholder: 'Policy Non-Conformance',
      options: [
        { value: 'true', label: 'Has Non-Conformance' },
        { value: 'false', label: 'No Non-Conformance' },
      ],
    },
    {
      key: 'controlsApplied',
      type: 'select',
      placeholder: 'Controls Applied',
      options: [
        { value: 'true', label: 'Has Controls' },
        { value: 'false', label: 'No Controls' },
      ],
    },
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PROPOSED', label: 'Proposed' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'ARCHIVED', label: 'Archived' },
      ],
    },
    {
      key: 'department',
      type: 'select',
      placeholder: 'Department',
      options: [
        { value: 'BUSINESS_STRATEGY', label: 'Business Strategy' },
        { value: 'FINANCE', label: 'Finance' },
        { value: 'HR', label: 'HR' },
        { value: 'OPERATIONS', label: 'Operations' },
        { value: 'PRODUCT', label: 'Product' },
        { value: 'MARKETING', label: 'Marketing' },
      ],
    },
  ];

  // Actions moved to RiskFormModal
  // const actions: ActionButton<Risk>[] = ...

  const paginationConfig: PaginationConfig = {
    mode: 'server',
    page: filters.page,
    pageSize: filters.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    onPageChange: handlePageChange,
    onPageSizeChange: (newSize) => {
      setFilters({ ...filters, limit: newSize, page: 1 });
    },
  };

  const sortConfig: SortConfig = {
    field: filters.sortBy,
    direction: filters.sortOrder,
    onSort: handleSort,
  };

  const csvExportConfig: CSVExportConfig = {
    enabled: true,
    filename: `risks_export_${new Date().toISOString().split('T')[0]}.csv`,
    headers: [
      'Date Added',
      'Title',
      'Risk Category',
      'Risk Nature',
      'Owner',
      'C',
      'I',
      'A',
      'L',
      'Risk (C+I+A)',
      'Initial Score',
      'Risk Level',
      'Initial Treatment',
      'MC',
      'MI',
      'MA',
      'ML',
      'Mitigated Risk',
      'Mitigated Score',
      'Mitigated Risk Level',
      'Residual Treatment',
      'Mitigation Implemented',
      'Controls',
    ],
    getRowData: (risk) => {
      const riskValue = risk.confidentialityScore + risk.integrityScore + risk.availabilityScore;
      const mitigatedRiskValue =
        risk.mitigatedConfidentialityScore !== null &&
          risk.mitigatedIntegrityScore !== null &&
          risk.mitigatedAvailabilityScore !== null
          ? risk.mitigatedConfidentialityScore +
          risk.mitigatedIntegrityScore +
          risk.mitigatedAvailabilityScore
          : '';
      const controls = risk.riskControls.map((rc: { control: { code: string } }) => rc.control.code).join('; ');

      return [
        risk.dateAdded,
        risk.title,
        risk.riskCategory || '',
        risk.riskNature || '',
        risk.owner?.displayName || '',
        risk.confidentialityScore,
        risk.integrityScore,
        risk.availabilityScore,
        risk.likelihood,
        riskValue,
        risk.calculatedScore,
        risk.riskLevel,
        risk.initialRiskTreatmentCategory || '',
        risk.mitigatedConfidentialityScore ?? '',
        risk.mitigatedIntegrityScore ?? '',
        risk.mitigatedAvailabilityScore ?? '',
        risk.mitigatedLikelihood ?? '',
        mitigatedRiskValue,
        risk.mitigatedScore ?? '',
        risk.mitigatedRiskLevel || '',
        risk.residualRiskTreatmentCategory || '',
        formatBoolean(risk.mitigationImplemented),
        controls || 'None',
      ];
    },
    onExport: () => {
      toast({
        title: 'Export Successful',
        description: `Exported ${risks.length} risk(s) to CSV`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
  };

  // Define handleExport after csvExportConfig is available
  const handleExport = useCallback(async (format: 'CSV' | 'EXCEL' | 'PDF') => {
    try {
      // Get all filtered risks (not just current page) - paginate through all pages
      const baseParams = new URLSearchParams();
      if (filters.riskCategory) baseParams.append('riskCategory', filters.riskCategory);
      if (filters.riskNature) baseParams.append('riskNature', filters.riskNature);
      if (filters.archived === 'all') {
        baseParams.append('archived', 'all');
      } else if (filters.archived === 'true') {
        baseParams.append('archived', 'true');
      } else if (filters.archived === 'false' || !filters.archived) {
        // Default to 'false' (Active Only) if empty or explicitly 'false'
        baseParams.append('archived', 'false');
      }
      if (filters.ownerId) baseParams.append('ownerId', filters.ownerId);
      if (filters.treatmentCategory) baseParams.append('treatmentCategory', filters.treatmentCategory);
      if (filters.mitigationImplemented !== '')
        baseParams.append('mitigationImplemented', filters.mitigationImplemented === 'true' ? 'true' : 'false');
      if (filters.policyNonConformance !== '')
        baseParams.append('policyNonConformance', filters.policyNonConformance === 'true' ? 'true' : 'false');
      if (filters.controlsApplied !== '')
        baseParams.append('controlsApplied', filters.controlsApplied === 'true' ? 'true' : 'false');
      if (filters.riskLevel) baseParams.append('riskLevel', filters.riskLevel);
      if (filters.search) baseParams.append('search', filters.search);
      if (filters.dateAddedFrom) baseParams.append('dateAddedFrom', filters.dateAddedFrom);
      if (filters.dateAddedTo) baseParams.append('dateAddedTo', filters.dateAddedTo);
      if (filters.assetCategoryId) baseParams.append('assetCategoryId', filters.assetCategoryId);

      // Paginate through all risks (backend max limit is 100)
      let allRisks: Risk[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams(baseParams);
        params.append('page', page.toString());
        params.append('limit', '100'); // Backend max limit is 100

        const response = await api.get(`/api/risks?${params.toString()}`);
        const risks = response.data.data || [];
        allRisks = [...allRisks, ...risks];

        // Check if there are more pages
        const totalPages = response.data.pagination?.totalPages || 1;
        hasMore = page < totalPages && risks.length > 0;
        page++;

        // Safety limit to prevent infinite loops
        if (page > 1000) break;
      }

      if (format === 'CSV') {
        const rows = allRisks.map(csvExportConfig.getRowData);
        generateCSV(csvExportConfig.headers, rows, `risks_export_${new Date().toISOString().split('T')[0]}.csv`);
        toast({
          title: 'Export Successful',
          description: `Exported ${allRisks.length} risk(s) to CSV`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else if (format === 'EXCEL') {
        // For Excel, we'll use CSV for now (can be enhanced later with a library like ExcelJS)
        toast({
          title: 'Excel Export',
          description: 'Excel export coming soon. Using CSV format for now.',
          status: 'info',
          duration: 3000,
        });
        const rows = allRisks.map(csvExportConfig.getRowData);
        generateCSV(csvExportConfig.headers, rows, `risks_export_${new Date().toISOString().split('T')[0]}.csv`);
      } else if (format === 'PDF') {
        toast({
          title: 'PDF Export',
          description: 'PDF export coming soon.',
          status: 'info',
          duration: 3000,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.response?.data?.error || 'Failed to export risks',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [filters, risks, csvExportConfig, toast]);

  const renderRow = useCallback((risk: Risk, index: number) => {
    const isAdminOrEditorLocal = user?.role === 'ADMIN' || user?.role === 'EDITOR';
    return (
      <Tr
        key={risk.id}
        id={`risk-${risk.id}`}
        bg={getRowBgColor(risk)}
        _hover={{ bg: getRowBgColor(risk), opacity: 0.9, cursor: 'pointer' }}
        cursor="pointer"
        onClick={() => handleEdit(risk)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEdit(risk);
          } else if (e.key === 'ArrowDown' && index < risks.length - 1) {
            e.preventDefault();
            const nextRow = document.getElementById(`risk-${risks[index + 1].id}`);
            nextRow?.focus();
          } else if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            const prevRow = document.getElementById(`risk-${risks[index - 1].id}`);
            prevRow?.focus();
          }
        }}
      >
        {isAdminOrEditorLocal && (
          <Td
            onClick={(e) => e.stopPropagation()}
            position="sticky"
            left={0}
            zIndex={5}
            bgColor={getRowBgColor(risk)}
            boxShadow="2px 0 4px rgba(0,0,0,0.1)"
            minW="50px"
            w="50px"
          >
            <Checkbox
              isChecked={selectedRiskIds.has(risk.id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectRisk(risk.id, e.target.checked);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.stopPropagation();
                }
              }}
            />
          </Td>
        )}
        {buildColumns.map((column: Column<Risk>, colIndex: number) => {
          let cellContent: React.ReactNode;
          if (column.render) {
            cellContent = column.render(risk);
          } else {
            const value = (risk as any)[column.key];
            cellContent = value === null || value === undefined || value === ''
              ? <Text color="gray.400" fontSize="xs">—</Text>
              : String(value);
          }
          const isSticky = column.sticky && colIndex === 0;
          // Calculate sticky left position: checkbox (50px if admin/editor)
          const stickyLeft = isSticky ? (isAdminOrEditorLocal ? '50px' : '0px') : undefined;
          return (
            <Td
              key={column.key}
              onClick={column.key === 'asset' ? (e) => e.stopPropagation() : undefined}
              position={isSticky ? 'sticky' : 'relative'}
              left={stickyLeft}
              zIndex={isSticky ? 5 : 1}
              bgColor={isSticky ? getRowBgColor(risk) : undefined}
              boxShadow={isSticky ? '2px 0 4px rgba(0,0,0,0.1)' : undefined}
            >
              {cellContent}
            </Td>
          );
        })}
      </Tr>
    );
  }, [user, selectedRiskIds, getRowBgColor, handleEdit, handleSelectRisk, buildColumns, risks]);

  // For Staff, show read-only StaffRiskTable
  if (effectiveRole === 'STAFF') {
    return <StaffRiskTable />;
  }

  // For Contributors, show simplified DepartmentRiskTable
  if (effectiveRole === 'CONTRIBUTOR') {
    return <DepartmentRiskTable />;
  }

  return (
    <>
      <Box
        w="100vw"
        ml="calc(-50vw + 50%)"
        mr="calc(-50vw + 50%)"
        bg="white"
        height="100vh"
        overflow="hidden"
        position="relative"
      >
        <VStack spacing={4} align="stretch" height="100%" px={8} py={6}>
          {/* Header Section - Fixed */}
          <HStack justify="space-between">
            <Heading size="lg">Risks</Heading>
            <HStack spacing={2}>
              {selectedRiskIds.size > 0 && (
                <Box
                  p={3}
                  bg="blue.50"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="blue.200"
                  display="flex"
                  alignItems="center"
                  gap={3}
                >
                  <Text fontSize="sm" fontWeight="medium" color="blue.700">
                    {selectedRiskIds.size} risk{selectedRiskIds.size !== 1 ? 's' : ''} selected
                  </Text>
                  <HStack spacing={2}>
                    {isAdminOrEditor && (
                      <>
                        <Button
                          colorScheme="red"
                          size="sm"
                          onClick={onBulkDeleteOpen}
                        >
                          Delete Selected
                        </Button>
                        <Menu>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<HamburgerIcon />}>
                            More Actions
                          </MenuButton>
                          <MenuList>
                            <MenuItem
                              onClick={async () => {
                                const selectedRisks = risks.filter(r => selectedRiskIds.has(r.id));
                                const archivedRisks = selectedRisks.filter(r => r.archived);
                                const activeRisks = selectedRisks.filter(r => !r.archived);
                                
                                if (archivedRisks.length > 0 && activeRisks.length > 0) {
                                  // Mixed selection - archive active ones, unarchive archived ones
                                  try {
                                    const archivePromises = activeRisks.map(risk =>
                                      api.put(`/api/risks/${risk.id}`, {
                                        archived: true,
                                        archivedDate: new Date().toISOString().split('T')[0],
                                      })
                                    );
                                    const unarchivePromises = archivedRisks.map(risk =>
                                      api.put(`/api/risks/${risk.id}`, {
                                        archived: false,
                                        archivedDate: null,
                                      })
                                    );
                                    await Promise.all([...archivePromises, ...unarchivePromises]);
                                    toast({
                                      title: 'Success',
                                      description: `Archived ${activeRisks.length} risk(s) and unarchived ${archivedRisks.length} risk(s)`,
                                      status: 'success',
                                      duration: 3000,
                                      isClosable: true,
                                    });
                                    fetchRisks();
                                    setSelectedRiskIds(new Set());
                                  } catch (error: any) {
                                    toast({
                                      title: 'Error',
                                      description: error.response?.data?.error || 'Failed to update risks',
                                      status: 'error',
                                      duration: 5000,
                                      isClosable: true,
                                    });
                                  }
                                } else if (activeRisks.length > 0) {
                                  // All active - archive them
                                  try {
                                    await Promise.all(
                                      activeRisks.map(risk =>
                                        api.put(`/api/risks/${risk.id}`, {
                                          archived: true,
                                          archivedDate: new Date().toISOString().split('T')[0],
                                        })
                                      )
                                    );
                                    toast({
                                      title: 'Success',
                                      description: `Archived ${activeRisks.length} risk(s)`,
                                      status: 'success',
                                      duration: 3000,
                                      isClosable: true,
                                    });
                                    fetchRisks();
                                    setSelectedRiskIds(new Set());
                                  } catch (error: any) {
                                    toast({
                                      title: 'Error',
                                      description: error.response?.data?.error || 'Failed to archive risks',
                                      status: 'error',
                                      duration: 5000,
                                      isClosable: true,
                                    });
                                  }
                                } else if (archivedRisks.length > 0) {
                                  // All archived - unarchive them
                                  try {
                                    await Promise.all(
                                      archivedRisks.map(risk =>
                                        api.put(`/api/risks/${risk.id}`, {
                                          archived: false,
                                          archivedDate: null,
                                        })
                                      )
                                    );
                                    toast({
                                      title: 'Success',
                                      description: `Unarchived ${archivedRisks.length} risk(s)`,
                                      status: 'success',
                                      duration: 3000,
                                      isClosable: true,
                                    });
                                    fetchRisks();
                                    setSelectedRiskIds(new Set());
                                  } catch (error: any) {
                                    toast({
                                      title: 'Error',
                                      description: error.response?.data?.error || 'Failed to unarchive risks',
                                      status: 'error',
                                      duration: 5000,
                                      isClosable: true,
                                    });
                                  }
                                }
                              }}
                            >
                              {(() => {
                                const selectedRisks = risks.filter(r => selectedRiskIds.has(r.id));
                                const allArchived = selectedRisks.length > 0 && selectedRisks.every(r => r.archived);
                                const allActive = selectedRisks.length > 0 && selectedRisks.every(r => !r.archived);
                                if (allArchived) return 'Unarchive Selected';
                                if (allActive) return 'Archive Selected';
                                return 'Archive/Unarchive Selected';
                              })()}
                            </MenuItem>
                            <MenuItem
                              onClick={() => {
                                const selectedRisks = risks.filter(r => selectedRiskIds.has(r.id));
                                const rows = selectedRisks.map(csvExportConfig.getRowData);
                                generateCSV(csvExportConfig.headers, rows, `selected_risks_${new Date().toISOString().split('T')[0]}.csv`);
                                toast({
                                  title: 'Export Successful',
                                  description: `Exported ${selectedRisks.length} selected risk(s) to CSV`,
                                  status: 'success',
                                  duration: 3000,
                                  isClosable: true,
                                });
                              }}
                            >
                              Export Selected
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRiskIds(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </HStack>
                </Box>
              )}
              <Popover>
                <PopoverTrigger>
                  <Button size="sm" variant="outline">
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <PopoverBody>
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight="bold" mb={2}>
                        Show/Hide Columns
                      </Text>
                      <Checkbox
                        isChecked={visibleColumns.title}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, title: e.target.checked })
                        }
                      >
                        Title
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.riskCategory}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, riskCategory: e.target.checked })
                        }
                      >
                        Risk Category
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.riskNature}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, riskNature: e.target.checked })
                        }
                      >
                        Risk Nature
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.owner}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, owner: e.target.checked })
                        }
                      >
                        Owner
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.cia}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, cia: e.target.checked })
                        }
                      >
                        C, I, A, L
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.initialScore}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, initialScore: e.target.checked })
                        }
                      >
                        Initial Score
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.treatment}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, treatment: e.target.checked })
                        }
                      >
                        Treatment
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.mitigatedCIA}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, mitigatedCIA: e.target.checked })
                        }
                      >
                        Mitigated C, I, A, L
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.mitigatedScore}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, mitigatedScore: e.target.checked })
                        }
                      >
                        Mitigated Score
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.residualTreatment}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, residualTreatment: e.target.checked })
                        }
                      >
                        Residual Treatment
                      </Checkbox>
                      <Checkbox
                        isChecked={visibleColumns.controls}
                        onChange={(e) =>
                          updateVisibleColumns({ ...visibleColumns, controls: e.target.checked })
                        }
                      >
                        Controls
                      </Checkbox>
                    </VStack>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
              {/* Export Menu */}
              <Menu>
                <MenuButton as={Button} size="sm" variant="outline" leftIcon={<DownloadIcon />}>
                  Export
                </MenuButton>
                <MenuList>
                  <MenuItem onClick={() => handleExport('PDF')}>Export as PDF</MenuItem>
                </MenuList>
              </Menu>
              {/* Saved Views Menu */}
              {savedViews.length > 0 && (
                <Menu>
                  <MenuButton as={Button} size="sm" variant="outline">
                    Saved Views
                  </MenuButton>
                  <MenuList>
                    {savedViews.map((view, index) => (
                      <MenuItem key={index}>
                        <HStack justify="space-between" w="100%">
                          <Text onClick={() => handleLoadView(view)}>{view.name}</Text>
                          <IconButton
                            aria-label="Delete view"
                            icon={<DeleteIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteView(index);
                            }}
                          />
                        </HStack>
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
              )}
              <Button size="sm" variant="outline" onClick={onSaveViewOpen}>
                Save View
              </Button>
              <Button colorScheme="blue" onClick={handleCreate}>
                Create Risk
              </Button>
            </HStack>
          </HStack>

          {/* Scrollable Table Section */}
          <Box flex="1" overflow="hidden" minHeight="0">
            <DataTable
              key={`risks-table-${Object.values(visibleColumns).join('-')}`}
              title=""
              data={risks}
              columns={buildColumns}
              loading={loading}
              emptyMessage={
                getActiveFilterCount() > 0
                  ? 'No risks match your current filters. Try adjusting your filters.'
                  : 'Get started by creating your first risk.'
              }
              filters={filterConfigs}
              filterValues={{
                search: searchInput,
                riskCategory: filters.riskCategory,
                riskNature: filters.riskNature,
                archived: filters.archived || 'false',
                treatmentCategory: filters.treatmentCategory,
                riskLevel: filters.riskLevel,
                mitigationImplemented: filters.mitigationImplemented,
                policyNonConformance: filters.policyNonConformance,
                controlsApplied: filters.controlsApplied,
                status: filters.status,
                department: filters.department,
              }}
              onFilterChange={(key, value) => {
                if (key === 'search') {
                  // Update search input immediately for UI responsiveness
                  setSearchInput(value);
                  // Actual filter update happens via debouncedSearch effect
                } else if (key === 'archived') {
                  // When removing the archived filter (empty string), change to 'all' to show all risks
                  // Otherwise, use the provided value
                  const archivedValue = value === '' ? 'all' : value;
                  setFilters({ ...filters, archived: archivedValue, page: 1 });
                } else {
                  setFilters({ ...filters, [key]: value, page: 1 });
                }
              }}
              onClearFilters={() => {
                setFilters({
                  riskCategory: '',
                  riskNature: '',
                  archived: 'false' as 'false' | 'true' | 'all',
                  ownerId: '',
                  treatmentCategory: '',
                  mitigationImplemented: '',
                  mitigatedScorePresent: '',
                  policyNonConformance: '',
                  controlsApplied: '',
                  reviewStatus: '',
                  acceptedAboveAppetite: '',
                  riskIds: '',
                  riskLevel: '',
                  likelihood: '',
                  impact: '',
                  search: '',
                  dateAddedFrom: '',
                  dateAddedTo: '',
                  assetCategoryId: '',
                  status: '',
                  department: '',
                  sortBy: 'calculatedScore',
                  sortOrder: 'desc',
                  page: 1,
                  limit: 20,
                });
              }}
              showFiltersHeading={true}
              sortConfig={sortConfig}
              enableSelection={isAdminOrEditor}
              selectedIds={selectedRiskIds}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRisk}
              getRowId={(risk) => risk.id}
              pagination={paginationConfig}
              csvExport={csvExportConfig}
              onRowClick={handleEdit}
              renderRow={renderRow}
              totalWithoutFilters={totalRisksCount}
            />
          </Box>
        </VStack>
      </Box>

      <RiskFormModal
        isOpen={isOpen}
        onClose={handleClose}
        risk={selectedRisk}
        isDuplicateMode={isDuplicateMode}
        viewMode={viewMode}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onEdit={() => setViewMode(false)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef as any}
        onClose={onDeleteClose}
        closeOnOverlayClick={false}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Risk
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete "{riskToDelete?.title}"? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isBulkDeleteOpen}
        leastDestructiveRef={cancelRef as any}
        onClose={onBulkDeleteClose}
        closeOnOverlayClick={false}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Selected Risks
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete {selectedRiskIds.size} selected risk(s)? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={onBulkDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmBulkDelete} ml={3}>
                Delete {selectedRiskIds.size} Risk(s)
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Save View Modal */}
      <Modal isOpen={isSaveViewOpen} onClose={onSaveViewClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Save Current View</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>View Name</FormLabel>
              <Input
                placeholder="e.g., High Risks Only"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveView();
                  }
                }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSaveViewClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveView}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
