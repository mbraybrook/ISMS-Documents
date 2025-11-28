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
import { SearchIcon } from '@chakra-ui/icons';
import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { RiskFormModal } from '../components/RiskFormModal';
import { useAuth } from '../contexts/AuthContext';

interface Risk {
  id: string;
  externalId: string | null;
  title: string;
  description: string | null;
  dateAdded: string;
  riskType: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  ownerUserId: string | null;
  assetCategory: string | null;
  interestedParty: string | null;
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
    riskType: '',
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
    riskType: true,
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
      if (filters.riskType) params.append('riskType', filters.riskType);
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
      interestedParty: risk.interestedParty || '',
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
    if (filters.riskType) count++;
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

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const headers = [
        'Title',
        'Risk Type',
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
      ];

      const rows = risks.map((risk) => {
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
          risk.riskType || '',
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
          risk.mitigationImplemented ? 'Yes' : 'No',
          controls || 'None',
          risk.dateAdded,
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const filename = `risks_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${risks.length} risk(s) to ${filename}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export risks to CSV',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
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
          <Button
            leftIcon={<DownloadIcon />}
            size="sm"
            variant="outline"
            onClick={exportToCSV}
            isDisabled={risks.length === 0 || isExporting}
            isLoading={isExporting}
            loadingText="Exporting..."
          >
            Export CSV
          </Button>
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
                    isChecked={visibleColumns.riskType}
                    onChange={(e) =>
                      setVisibleColumns({ ...visibleColumns, riskType: e.target.checked })
                    }
                  >
                    Risk Type
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

      {/* Filters */}
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <HStack justify="space-between" mb={4}>
          <Heading size="sm">Filters</Heading>
          {getActiveFilterCount() > 0 && (
            <Badge colorScheme="blue" fontSize="sm">
              {getActiveFilterCount()} active
            </Badge>
          )}
        </HStack>
        <HStack spacing={4} flexWrap="wrap" mb={4}>
          <InputGroup maxW="300px">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search by title or description..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </InputGroup>
          <Select
            placeholder="Risk Type"
            value={filters.riskType}
            onChange={(e) => setFilters({ ...filters, riskType: e.target.value })}
            width="200px"
            borderColor={filters.riskType ? 'blue.300' : undefined}
            borderWidth={filters.riskType ? '2px' : '1px'}
          >
            {RISK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>

          <Select
            placeholder="Treatment Category"
            value={filters.treatmentCategory}
            onChange={(e) => setFilters({ ...filters, treatmentCategory: e.target.value })}
            width="200px"
            borderColor={filters.treatmentCategory ? 'blue.300' : undefined}
            borderWidth={filters.treatmentCategory ? '2px' : '1px'}
          >
            {TREATMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>

          <Select
            placeholder="Risk Level"
            value={filters.riskLevel}
            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
            width="150px"
            borderColor={filters.riskLevel ? 'blue.300' : undefined}
            borderWidth={filters.riskLevel ? '2px' : '1px'}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </Select>

          <Select
            placeholder="Mitigation Status"
            value={filters.mitigationImplemented}
            onChange={(e) => setFilters({ ...filters, mitigationImplemented: e.target.value })}
            width="180px"
            borderColor={filters.mitigationImplemented ? 'blue.300' : undefined}
            borderWidth={filters.mitigationImplemented ? '2px' : '1px'}
          >
            <option value="true">Implemented</option>
            <option value="false">Not Implemented</option>
          </Select>

          <Button
            size="sm"
            onClick={() =>
              setFilters({
                riskType: '',
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
              })
            }
            isDisabled={getActiveFilterCount() === 0}
          >
            Clear Filters
          </Button>
        </HStack>
        {getActiveFilterCount() > 0 && (
          <Wrap spacing={2}>
            {filters.riskType && (
              <WrapItem>
                <Badge colorScheme="blue">
                  Risk Type: {filters.riskType.replace(/_/g, ' ')}
                  <Button
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => setFilters({ ...filters, riskType: '', page: 1 })}
                  >
                    ×
                  </Button>
                </Badge>
              </WrapItem>
            )}
            {filters.treatmentCategory && (
              <WrapItem>
                <Badge colorScheme="blue">
                  Treatment: {filters.treatmentCategory}
                  <Button
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => setFilters({ ...filters, treatmentCategory: '', page: 1 })}
                  >
                    ×
                  </Button>
                </Badge>
              </WrapItem>
            )}
            {filters.riskLevel && (
              <WrapItem>
                <Badge colorScheme="blue">
                  Level: {filters.riskLevel}
                  <Button
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => setFilters({ ...filters, riskLevel: '', page: 1 })}
                  >
                    ×
                  </Button>
                </Badge>
              </WrapItem>
            )}
            {filters.mitigationImplemented && (
              <WrapItem>
                <Badge colorScheme="blue">
                  Mitigation: {filters.mitigationImplemented === 'true' ? 'Implemented' : 'Not Implemented'}
                  <Button
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => setFilters({ ...filters, mitigationImplemented: '', page: 1 })}
                  >
                    ×
                  </Button>
                </Badge>
              </WrapItem>
            )}
            {filters.search && (
              <WrapItem>
                <Badge colorScheme="blue">
                  Search: "{filters.search}"
                  <Button
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => setFilters({ ...filters, search: '', page: 1 })}
                  >
                    ×
                  </Button>
                </Badge>
              </WrapItem>
            )}
          </Wrap>
        )}
      </Box>

      <Box p={4} bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        {loading ? (
          <Box p={8} textAlign="center">
            <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.500" />
            <Text mt={4}>Loading risks...</Text>
          </Box>
        ) : risks.length === 0 ? (
          <Box p={8} textAlign="center">
            <Text fontSize="lg" color="gray.500" mb={2}>
              No risks found
            </Text>
            <Text fontSize="sm" color="gray.400">
              {getActiveFilterCount() > 0
                ? 'No risks match your current filters. Try adjusting your filters.'
                : 'Get started by creating your first risk.'}
            </Text>
            {getActiveFilterCount() > 0 && (
              <Button
                mt={4}
                size="sm"
                onClick={() =>
                  setFilters({
                    riskType: '',
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
                  })
                }
              >
                Clear All Filters
              </Button>
            )}
          </Box>
        ) : (
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                {isAdminOrEditor && (
                  <Th width="50px">
                    <Checkbox
                      isChecked={risks.length > 0 && selectedRiskIds.size === risks.length}
                      isIndeterminate={selectedRiskIds.size > 0 && selectedRiskIds.size < risks.length}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectAll(e.target.checked);
                      }}
                    />
                  </Th>
                )}
                {visibleColumns.title && (
                  <Th cursor="pointer" onClick={() => handleSort('title')}>
                    Title
                    {filters.sortBy === 'title' && (filters.sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                )}
                {visibleColumns.riskType && <Th>Risk Type</Th>}
                {visibleColumns.owner && <Th>Owner</Th>}
                {visibleColumns.cia && (
                  <>
                    <Th>
                      <Tooltip label="Confidentiality - Impact on data confidentiality">
                        <Text as="span" cursor="help" borderBottom="1px dotted">
                          C
                        </Text>
                      </Tooltip>
                    </Th>
                    <Th>
                      <Tooltip label="Integrity - Impact on data integrity">
                        <Text as="span" cursor="help" borderBottom="1px dotted">
                          I
                        </Text>
                      </Tooltip>
                    </Th>
                    <Th>
                      <Tooltip label="Availability - Impact on system availability">
                        <Text as="span" cursor="help" borderBottom="1px dotted">
                          A
                        </Text>
                      </Tooltip>
                    </Th>
                    <Th>
                      <Tooltip label="Likelihood - Probability of risk occurring">
                        <Text as="span" cursor="help" borderBottom="1px dotted">
                          L
                        </Text>
                      </Tooltip>
                    </Th>
                  </>
                )}
                {visibleColumns.initialScore && (
                  <Th cursor="pointer" onClick={() => handleSort('calculatedScore')}>
                    Initial Score
                    {filters.sortBy === 'calculatedScore' && (filters.sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                )}
                {visibleColumns.treatment && <Th>Treatment</Th>}
                {visibleColumns.mitigatedCIA && (
                  <>
                    <Th>MC</Th>
                    <Th>MI</Th>
                    <Th>MA</Th>
                    <Th>ML</Th>
                  </>
                )}
                {visibleColumns.mitigatedScore && (
                  <Th cursor="pointer" onClick={() => handleSort('mitigatedScore')}>
                    Mitigated Score
                    {filters.sortBy === 'mitigatedScore' && (filters.sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                )}
                {visibleColumns.residualTreatment && <Th>Residual Treatment</Th>}
                {visibleColumns.controls && <Th>Controls</Th>}
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {risks.map((risk) => (
                <Tr
                  key={risk.id}
                  id={`risk-${risk.id}`}
                  bg={getRowBgColor(risk)}
                  _hover={{ bg: getRowBgColor(risk), opacity: 0.9 }}
                  cursor={selectedRiskIds.has(risk.id) ? 'default' : 'default'}
                >
                  {isAdminOrEditor && (
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        isChecked={selectedRiskIds.has(risk.id)}
                        onChange={(e) => handleSelectRisk(risk.id, e.target.checked)}
                      />
                    </Td>
                  )}
                  {visibleColumns.title && <Td fontWeight="medium">{risk.title}</Td>}
                  {visibleColumns.riskType && (
                    <Td>
                      {risk.riskType ? (
                        <Badge colorScheme="gray">{risk.riskType.replace(/_/g, ' ')}</Badge>
                      ) : (
                        'N/A'
                      )}
                    </Td>
                  )}
                  {visibleColumns.owner && <Td>{risk.owner ? risk.owner.displayName : 'N/A'}</Td>}
                  {visibleColumns.cia && (
                    <>
                      <Td>{risk.confidentialityScore}</Td>
                      <Td>{risk.integrityScore}</Td>
                      <Td>{risk.availabilityScore}</Td>
                      <Td>{risk.likelihood}</Td>
                    </>
                  )}
                  {visibleColumns.initialScore && (
                    <Td bg={`${getRiskLevelColor(risk.riskLevel)}.50`} px={3} py={2}>
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
                    </Td>
                  )}
                  {visibleColumns.treatment && (
                    <Td>
                      {risk.initialRiskTreatmentCategory ? (
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
                      )}
                    </Td>
                  )}
                  {visibleColumns.mitigatedCIA && (
                    <>
                      <Td>
                        {risk.mitigatedConfidentialityScore !== null ? (
                          risk.mitigatedConfidentialityScore
                        ) : (
                          <Text as="span" color="gray.400">—</Text>
                        )}
                      </Td>
                      <Td>
                        {risk.mitigatedIntegrityScore !== null ? (
                          risk.mitigatedIntegrityScore
                        ) : (
                          <Text as="span" color="gray.400">—</Text>
                        )}
                      </Td>
                      <Td>
                        {risk.mitigatedAvailabilityScore !== null ? (
                          risk.mitigatedAvailabilityScore
                        ) : (
                          <Text as="span" color="gray.400">—</Text>
                        )}
                      </Td>
                      <Td>
                        {risk.mitigatedLikelihood !== null ? (
                          risk.mitigatedLikelihood
                        ) : (
                          <Text as="span" color="gray.400">—</Text>
                        )}
                      </Td>
                    </>
                  )}
                  {visibleColumns.mitigatedScore && (
                    <Td>
                      {risk.mitigatedScore !== null ? (
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
                        '-'
                      )}
                    </Td>
                  )}
                  {visibleColumns.residualTreatment && (
                    <Td>
                      {risk.residualRiskTreatmentCategory ? (
                        <Badge colorScheme="green">{risk.residualRiskTreatmentCategory}</Badge>
                      ) : (
                        'N/A'
                      )}
                    </Td>
                  )}
                  {visibleColumns.controls && (
                    <Td>
                      {risk.riskControls.length > 0 ? (
                        <HStack spacing={1} flexWrap="wrap">
                          {risk.riskControls.map((rc) => (
                            <Tooltip key={rc.control.id} label={rc.control.title}>
                              <Text
                                fontSize="xs"
                                as="a"
                                href={`/controls/${rc.control.id}`}
                                color="blue.600"
                                _hover={{ textDecoration: 'underline', color: 'blue.800' }}
                                cursor="pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/controls/${rc.control.id}`;
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
                      )}
                    </Td>
                  )}
                  <Td onClick={(e) => e.stopPropagation()}>
                    <HStack spacing={2}>
                      <Button size="sm" onClick={() => handleEdit(risk)}>
                        Edit
                      </Button>
                      {isAdminOrEditor && (
                        <>
                          <Tooltip label="Duplicate risk">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicate(risk)}
                            >
                              Duplicate
                            </Button>
                          </Tooltip>
                          <Tooltip label="Delete risk">
                            <IconButton
                              aria-label="Delete risk"
                              icon={<DeleteIcon />}
                              size="sm"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleDelete(risk)}
                            />
                          </Tooltip>
                        </>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {!loading && risks.length > 0 && (
          <HStack justify="space-between" mt={4} p={4}>
            <Text fontSize="sm" color="gray.600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} risks
            </Text>
            <HStack spacing={2}>
              <Button
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                isDisabled={pagination.page === 1}
                opacity={pagination.page === 1 ? 0.4 : 1}
                cursor={pagination.page === 1 ? 'not-allowed' : 'pointer'}
              >
                Previous
              </Button>
              <Text fontSize="sm">
                Page {pagination.page} of {pagination.totalPages}
              </Text>
              <Button
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                isDisabled={pagination.page >= pagination.totalPages}
                opacity={pagination.page >= pagination.totalPages ? 0.4 : 1}
                cursor={pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer'}
              >
                Next
              </Button>
            </HStack>
          </HStack>
        )}
      </Box>

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
