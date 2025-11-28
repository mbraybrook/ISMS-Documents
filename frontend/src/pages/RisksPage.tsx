import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  HStack,
  VStack,
  Badge,
  useDisclosure,
  Select,
  Input,
  Checkbox,
  Flex,
  Text,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  IconButton,
  Tooltip,
  Wrap,
  WrapItem,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '@chakra-ui/react';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { DeleteIcon, DownloadIcon, EditIcon, CopyIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { RiskFormModal } from '../components/RiskFormModal';
import { useAuth } from '../contexts/AuthContext';
import { DataTable, Column, FilterConfig, ActionButton, PaginationConfig, SortConfig, CSVExportConfig } from '../components/DataTable';
import { formatBoolean } from '../utils/tableUtils';

interface Risk {
  id: string;
  externalId: string | null;
  title: string;
  description: string | null;
  dateAdded: string;
  riskCategory: string | null;
  riskNature: string | null;
  archived: boolean;
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
  assetId: string | null;
  assetCategoryId: string | null;
  asset: {
    id: string;
    nameSerialNo: string | null;
    model: string | null;
    category: {
      id: string;
      name: string;
    };
  } | null;
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
  const toast = useToast();
  const { user } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set());
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useDisclosure();
  const cancelRef = useRef(null);

  // Filters and pagination
  const [filters, setFilters] = useState({
    riskCategory: '',
    riskNature: '',
    archived: false,
    ownerId: '',
    treatmentCategory: '',
    mitigationImplemented: '',
    riskLevel: '',
    search: '',
    dateAddedFrom: '',
    dateAddedTo: '',
    sortBy: 'calculatedScore',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    title: true,
    riskCategory: true,
    riskNature: true,
    archived: true,
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
  });

  useEffect(() => {
    fetchRisks();
    // Clear selections when filters change
    setSelectedRiskIds(new Set());
  }, [filters]);

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

  const fetchRisks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.riskCategory) params.append('riskCategory', filters.riskCategory);
      if (filters.riskNature) params.append('riskNature', filters.riskNature);
      if (filters.archived) params.append('archived', 'true');
      if (filters.ownerId) params.append('ownerId', filters.ownerId);
      if (filters.treatmentCategory) params.append('treatmentCategory', filters.treatmentCategory);
      if (filters.mitigationImplemented)
        params.append('mitigationImplemented', filters.mitigationImplemented);
      if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateAddedFrom) params.append('dateAddedFrom', filters.dateAddedFrom);
      if (filters.dateAddedTo) params.append('dateAddedTo', filters.dateAddedTo);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await api.get(`/api/risks?${params.toString()}`);
      setRisks(response.data.data);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching risks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (risk: Risk) => {
    setSelectedRisk(risk);
    setIsDuplicateMode(false);
    setViewMode(false);
    onOpen();
  };

  const handleView = (risk: Risk) => {
    setSelectedRisk(risk);
    setIsDuplicateMode(false);
    setViewMode(true);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedRisk(null);
    setIsDuplicateMode(false);
    setViewMode(false);
    onOpen();
  };

  const handleDuplicate = (risk: Risk) => {
    // Create a copy of the risk without the id and with "Copy of" prefix
    // Copy ALL fields including text areas and dropdown selections
    const duplicatedRisk = {
      ...risk,
      id: undefined,
      externalId: undefined,
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
  };

  const handleClose = () => {
    onClose();
    setSelectedRisk(null);
    setIsDuplicateMode(false);
    setViewMode(false);
    fetchRisks();
    // Success toast will be shown by RiskFormModal
  };

  const handleDelete = (risk: Risk) => {
    setRiskToDelete(risk);
    onDeleteOpen();
  };

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
    if (filters.archived) count++;
    if (filters.ownerId) count++;
    if (filters.treatmentCategory) count++;
    if (filters.mitigationImplemented) count++;
    if (filters.riskLevel) count++;
    if (filters.search) count++;
    if (filters.dateAddedFrom || filters.dateAddedTo) count++;
    return count;
  };

  const handleSearchChange = (value: string) => {
    setFilters({ ...filters, search: value, page: 1 }); // Reset to page 1 on search
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdminOrEditor = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  const getScoreColor = (score: number): string => {
    if (score >= 36) return 'red';
    if (score >= 15) return 'orange';
    return 'yellow';
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

  const getRowBgColor = (risk: Risk): string => {
    const level = risk.mitigatedScore ? risk.mitigatedRiskLevel : risk.riskLevel;
    if (level === 'HIGH') return 'red.50';
    if (level === 'MEDIUM') return 'orange.50';
    return 'green.50';
  };

  const handleSort = (field: string) => {
    setFilters({
      ...filters,
      sortBy: field,
      sortOrder: filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1, // Reset to first page when sorting
    });
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

  const [isExporting, setIsExporting] = useState(false);

  // Build columns dynamically based on visibleColumns
  const buildColumns = (): Column<Risk>[] => {
    const cols: Column<Risk>[] = [];
    
    if (visibleColumns.title) {
      cols.push({
        key: 'title',
        header: 'Title',
        sortable: true,
        render: (risk) => <Text fontWeight="medium">{risk.title}</Text>,
      });
    }
    
    if (visibleColumns.riskCategory) {
      cols.push({
        key: 'riskCategory',
        header: 'Risk Category',
        render: (risk) =>
          risk.riskCategory ? (
            <Badge colorScheme="gray">{risk.riskCategory.replace(/_/g, ' ')}</Badge>
          ) : (
            <Text color="gray.400">N/A</Text>
          ),
      });
    }
    
    if (visibleColumns.riskNature) {
      cols.push({
        key: 'riskNature',
        header: 'Risk Nature',
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
    
    if (visibleColumns.archived) {
      cols.push({
        key: 'archived',
        header: 'Archived',
        render: (risk) =>
          risk.archived ? (
            <Badge colorScheme="gray">Archived</Badge>
          ) : (
            <Text fontSize="xs" color="gray.400">—</Text>
          ),
      });
    }
    
    if (visibleColumns.owner) {
      cols.push({
        key: 'owner',
        header: 'Owner',
        render: (risk) => <Text>{risk.owner ? risk.owner.displayName : 'N/A'}</Text>,
      });
    }
    
    // Asset/Category is always visible
    cols.push({
      key: 'asset',
      header: 'Asset/Category',
      render: (risk) => (
        risk.asset ? (
          <Badge colorScheme="blue" as="a" href={`/assets/assets`} cursor="pointer">
            {risk.asset.nameSerialNo || risk.asset.model || 'Asset'} ({risk.asset.category.name})
          </Badge>
        ) : risk.linkedAssetCategory ? (
          <Badge colorScheme="purple" as="a" href={`/assets/asset-categories`} cursor="pointer">
            {risk.linkedAssetCategory.name}
          </Badge>
        ) : (
          <Text fontSize="xs" color="gray.400">—</Text>
        )
      ),
    });
    
    // Interested Party is always visible
    cols.push({
      key: 'interestedParty',
      header: 'Interested Party',
      render: (risk) => (
        risk.interestedParty ? (
          <Badge colorScheme="teal" as="a" href={`/risks/interested-parties`} cursor="pointer">
            {risk.interestedParty.name}
            {risk.interestedParty.group && ` (${risk.interestedParty.group})`}
          </Badge>
        ) : (
          <Text fontSize="xs" color="gray.400">—</Text>
        )
      ),
    });
    
    if (visibleColumns.cia) {
      cols.push(
        {
          key: 'confidentialityScore',
          header: 'C',
          render: (risk) => risk.confidentialityScore,
        },
        {
          key: 'integrityScore',
          header: 'I',
          render: (risk) => risk.integrityScore,
        },
        {
          key: 'availabilityScore',
          header: 'A',
          render: (risk) => risk.availabilityScore,
        },
        {
          key: 'likelihood',
          header: 'L',
          render: (risk) => risk.likelihood,
        }
      );
    }
    
    if (visibleColumns.initialScore) {
      cols.push({
        key: 'calculatedScore',
        header: 'Initial Score',
        sortable: true,
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
        render: (risk) =>
          risk.initialRiskTreatmentCategory ? (
            <Badge
              colorScheme={
                risk.initialRiskTreatmentCategory === 'MODIFY' ? 'blue' :
                risk.initialRiskTreatmentCategory === 'RETAIN' ? 'green' :
                risk.initialRiskTreatmentCategory === 'SHARE' ? 'purple' :
                'red'
              }
              fontSize="sm"
              px={3}
              py={1}
              minW="80px"
            >
              {risk.initialRiskTreatmentCategory}
            </Badge>
          ) : (
            <Text fontSize="xs" color="gray.400" fontStyle="italic">N/A</Text>
          ),
      });
    }
    
    if (visibleColumns.mitigatedCIA) {
      cols.push(
        {
          key: 'mitigatedConfidentialityScore',
          header: 'MC',
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
        render: (risk) =>
          risk.mitigatedScore !== null ? (
            <VStack spacing={1} align="start">
              <Badge colorScheme={getScoreColor(risk.mitigatedScore)}>
                {risk.mitigatedScore}
              </Badge>
              {risk.mitigatedRiskLevel && (
                <Badge colorScheme={getRiskLevelColor(risk.mitigatedRiskLevel)} size="sm">
                  {risk.mitigatedRiskLevel}
                </Badge>
              )}
            </VStack>
          ) : (
            <Text color="gray.400">-</Text>
          ),
      });
    }
    
    if (visibleColumns.residualTreatment) {
      cols.push({
        key: 'residualRiskTreatmentCategory',
        header: 'Residual Treatment',
        render: (risk) =>
          risk.residualRiskTreatmentCategory ? (
            <Badge colorScheme="green">{risk.residualRiskTreatmentCategory}</Badge>
          ) : (
            <Text color="gray.400">N/A</Text>
          ),
      });
    }
    
    if (visibleColumns.controls) {
      cols.push({
        key: 'controls',
        header: 'Controls',
        render: (risk) =>
          risk.riskControls.length > 0 ? (
            <HStack spacing={1} flexWrap="wrap">
              {risk.riskControls.map((rc) => (
                <Tooltip key={rc.control.id} label={rc.control.title}>
                  <Text
                    fontSize="xs"
                    as="a"
                    href={`/risks/controls`}
                    color="blue.600"
                    _hover={{ textDecoration: 'underline', color: 'blue.800' }}
                    cursor="pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/risks/controls`;
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
  };

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
      placeholder: 'Show Archived',
      options: [
        { value: 'true', label: 'Show Archived' },
        { value: 'false', label: 'Hide Archived' },
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
  ];

  const actions: ActionButton<Risk>[] = [
    {
      icon: <EditIcon />,
      label: 'Edit',
      onClick: handleEdit,
      colorScheme: 'blue',
    },
    ...(isAdminOrEditor
      ? [
          {
            icon: <CopyIcon />,
            label: 'Duplicate risk',
            onClick: handleDuplicate,
            colorScheme: 'blue',
          } as ActionButton<Risk>,
          {
            icon: <DeleteIcon />,
            label: 'Delete risk',
            onClick: handleDelete,
            colorScheme: 'red',
          } as ActionButton<Risk>,
        ]
      : []),
  ];

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
      'Title',
      'Risk Category',
      'Risk Nature',
      'Archived',
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
      'Date Added',
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
      const controls = risk.riskControls.map((rc) => rc.control.code).join('; ');

      return [
        risk.title,
        risk.riskCategory || '',
        risk.riskNature || '',
        formatBoolean(risk.archived),
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
        risk.dateAdded,
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

  const renderRow = (risk: Risk, index: number) => {
    return (
      <Tr
        key={risk.id}
        id={`risk-${risk.id}`}
        bg={getRowBgColor(risk)}
        _hover={{ bg: getRowBgColor(risk), opacity: 0.9, cursor: 'pointer' }}
        cursor="pointer"
        onClick={() => handleEdit(risk)}
      >
        {isAdminOrEditor && (
          <Td onClick={(e) => e.stopPropagation()}>
            <Checkbox
              isChecked={selectedRiskIds.has(risk.id)}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectRisk(risk.id, e.target.checked);
              }}
            />
          </Td>
        )}
        {buildColumns().map((column) => {
          let cellContent: React.ReactNode;
          if (column.render) {
            cellContent = column.render(risk);
          } else {
            const value = (risk as any)[column.key];
            cellContent = value === null || value === undefined || value === '' 
              ? <Text color="gray.400" fontSize="xs">—</Text>
              : String(value);
          }
          return <Td key={column.key} onClick={column.key === 'asset' ? (e) => e.stopPropagation() : undefined}>{cellContent}</Td>;
        })}
        <Td onClick={(e) => e.stopPropagation()}>
          <HStack spacing={2}>
            {actions.map((action, idx) => (
              <Tooltip key={idx} label={action.label}>
                <IconButton
                  aria-label={action.label}
                  icon={action.icon}
                  size="sm"
                  colorScheme={action.colorScheme || 'blue'}
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(risk);
                  }}
                />
              </Tooltip>
            ))}
          </HStack>
        </Td>
      </Tr>
    );
  };


  return (
    <VStack spacing={6} align="stretch">
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
                <Button
                  colorScheme="red"
                  size="sm"
                  onClick={onBulkDeleteOpen}
                  isDisabled={!isAdminOrEditor}
                >
                  Delete Selected
                </Button>
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
                      setVisibleColumns({ ...visibleColumns, title: e.target.checked })
                    }
                  >
                    Title
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.riskCategory}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, riskCategory: e.target.checked })
                    }
                  >
                    Risk Category
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.riskNature}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, riskNature: e.target.checked })
                    }
                  >
                    Risk Nature
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.archived}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, archived: e.target.checked })
                    }
                  >
                    Archived
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.owner}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, owner: e.target.checked })
                    }
                  >
                    Owner
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.cia}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, cia: e.target.checked })
                    }
                  >
                    C, I, A, L
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.initialScore}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, initialScore: e.target.checked })
                    }
                  >
                    Initial Score
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.treatment}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, treatment: e.target.checked })
                    }
                  >
                    Treatment
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.mitigatedCIA}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, mitigatedCIA: e.target.checked })
                    }
                  >
                    Mitigated C, I, A, L
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.mitigatedScore}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, mitigatedScore: e.target.checked })
                    }
                  >
                    Mitigated Score
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.residualTreatment}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, residualTreatment: e.target.checked })
                    }
                  >
                    Residual Treatment
                  </Checkbox>
                  <Checkbox
                    isChecked={visibleColumns.controls}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, controls: e.target.checked })
                    }
                  >
                    Controls
                  </Checkbox>
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
          <Button colorScheme="blue" onClick={handleCreate}>
            Create Risk
          </Button>
        </HStack>
      </HStack>

      <DataTable
        title=""
        data={risks}
        columns={buildColumns()}
        loading={loading}
        emptyMessage={
          getActiveFilterCount() > 0
            ? 'No risks match your current filters. Try adjusting your filters.'
            : 'Get started by creating your first risk.'
        }
        filters={filterConfigs}
        filterValues={{
          search: filters.search,
          riskCategory: filters.riskCategory,
          riskNature: filters.riskNature,
          archived: filters.archived ? 'true' : '',
          treatmentCategory: filters.treatmentCategory,
          riskLevel: filters.riskLevel,
          mitigationImplemented: filters.mitigationImplemented,
        }}
        onFilterChange={(key, value) => {
          if (key === 'archived') {
            setFilters({ ...filters, archived: value === 'true', page: 1 });
          } else {
            setFilters({ ...filters, [key]: value, page: 1 });
          }
        }}
        onClearFilters={() => {
          setFilters({
            riskCategory: '',
            riskNature: '',
            archived: false,
            ownerId: '',
            treatmentCategory: '',
            mitigationImplemented: '',
            riskLevel: '',
            search: '',
            dateAddedFrom: '',
            dateAddedTo: '',
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
        actions={actions}
        csvExport={csvExportConfig}
        onRowClick={handleEdit}
        renderRow={renderRow}
      />


      <RiskFormModal 
        isOpen={isOpen} 
        onClose={handleClose} 
        risk={selectedRisk} 
        isDuplicateMode={isDuplicateMode}
        viewMode={viewMode}
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
    </VStack>
  );
}
