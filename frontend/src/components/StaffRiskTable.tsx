/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Heading,
  VStack,
  Badge,
  Text,
  useToast,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';
import api from '../services/api';
import { Risk } from '../types/risk';
import { DataTable, Column, FilterConfig, PaginationConfig, SortConfig } from '../components/DataTable';
import { useDebounce } from '../hooks/useDebounce';
import { getDepartmentDisplayName } from '../types/risk';
import { RiskFormModal } from './RiskFormModal';

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

const DEPARTMENTS = [
  { value: 'BUSINESS_STRATEGY', label: 'Business Strategy' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'HR', label: 'HR' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'MARKETING', label: 'Marketing' },
];

export function StaffRiskTable() {
  const toast = useToast();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    riskCategory: '',
    riskNature: '',
    archived: false,
    treatmentCategory: '',
    mitigationImplemented: '',
    riskLevel: '',
    search: '',
    status: '',
    department: '',
    sortBy: 'calculatedScore',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
    limit: 20,
  });

  // Separate search state for immediate UI updates
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Sync debounced search with filters
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters(prev => ({ ...prev, search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch, filters.search]);

  // Sync search input with filters.search when it changes externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const fetchRisks = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      
      if (filters.riskCategory) params.riskCategory = filters.riskCategory;
      if (filters.riskNature) params.riskNature = filters.riskNature;
      if (filters.archived) params.archived = 'true';
      if (filters.treatmentCategory) params.treatmentCategory = filters.treatmentCategory;
      if (filters.mitigationImplemented !== '') {
        params.mitigationImplemented = filters.mitigationImplemented === 'true' ? 'true' : 'false';
      }
      if (filters.riskLevel) params.riskLevel = filters.riskLevel;
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;

      const response = await api.get('/api/risks', { params });
      setRisks(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
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

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: string) => {
    setFilters({
      ...filters,
      sortBy: field,
      sortOrder: filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    });
  };

  const handleView = useCallback((risk: Risk) => {
    setSelectedRisk(risk);
    onViewOpen();
  }, [onViewOpen]);

  const handleClose = () => {
    onViewClose();
    setSelectedRisk(null);
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'PROPOSED':
        return 'blue';
      case 'DRAFT':
        return 'gray';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 36) return 'red';
    if (score >= 15) return 'orange';
    return 'yellow';
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
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PROPOSED', label: 'Proposed' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    },
    {
      key: 'department',
      type: 'select',
      placeholder: 'Department',
      options: DEPARTMENTS,
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
  ];

  const buildColumns = useMemo((): Column<Risk>[] => {
    return [
      {
        key: 'dateAdded',
        header: 'Date Added',
        sortable: true,
        minW: '130px',
        render: (risk) => (
          <Text fontSize="sm">
            {risk.dateAdded ? new Date(risk.dateAdded).toLocaleDateString() : 'N/A'}
          </Text>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        sortable: true,
        sticky: true,
        width: '300px',
        minW: '300px',
        render: (risk) => (
          <Tooltip label={risk.title} placement="top-start">
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
          </Tooltip>
        ),
      },
      {
        key: 'department',
        header: 'Department',
        minW: '150px',
        render: (risk) => (
          risk.department ? (
            <Badge colorScheme="teal">
              {getDepartmentDisplayName(risk.department as any)}
            </Badge>
          ) : (
            <Text color="gray.400">N/A</Text>
          )
        ),
      },
      {
        key: 'status',
        header: 'Status',
        minW: '100px',
        render: (risk) => (
          <Badge colorScheme={getStatusColor(risk.status)}>
            {risk.status}
          </Badge>
        ),
      },
      {
        key: 'calculatedScore',
        header: 'Score',
        sortable: true,
        minW: '120px',
        render: (risk) => (
          <Box bg={`${getRiskLevelColor(risk.riskLevel)}.50`} px={3} py={2} borderRadius="md">
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
      },
      {
        key: 'riskCategory',
        header: 'Category',
        minW: '150px',
        render: (risk) =>
          risk.riskCategory ? (
            <Badge colorScheme="gray">{risk.riskCategory.replace(/_/g, ' ')}</Badge>
          ) : (
            <Text color="gray.400">N/A</Text>
          ),
      },
      {
        key: 'owner',
        header: 'Owner',
        minW: '150px',
        render: (risk) => <Text>{risk.owner ? risk.owner.displayName : 'N/A'}</Text>,
      },
    ];
  }, []);

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

  return (
    <Box p={8}>
      <VStack spacing={4} align="stretch">
        <Heading size="lg">Risk Register</Heading>

        <DataTable
          title=""
          data={risks}
          columns={buildColumns}
          loading={loading}
          emptyMessage={
            filters.department || filters.search || filters.status
              ? 'No risks match your current filters.'
              : 'No risks found.'
          }
          filters={filterConfigs}
          filterValues={{
            search: searchInput,
            riskCategory: filters.riskCategory,
            riskNature: filters.riskNature,
            status: filters.status,
            department: filters.department,
            riskLevel: filters.riskLevel,
          }}
          onFilterChange={(key, value) => {
            if (key === 'search') {
              setSearchInput(value);
            } else {
              setFilters({ ...filters, [key]: value, page: 1 });
            }
          }}
          onClearFilters={() => {
            setFilters({
              riskCategory: '',
              riskNature: '',
              archived: false,
              treatmentCategory: '',
              mitigationImplemented: '',
              riskLevel: '',
              search: '',
              status: '',
              department: '',
              sortBy: 'calculatedScore',
              sortOrder: 'desc',
              page: 1,
              limit: 20,
            });
            setSearchInput('');
          }}
          showFiltersHeading={true}
          sortConfig={sortConfig}
          getRowId={(risk) => risk.id}
          pagination={paginationConfig}
          onRowClick={handleView}
        />
      </VStack>

      {selectedRisk && (
        <RiskFormModal
          isOpen={isViewOpen}
          onClose={handleClose}
          risk={selectedRisk}
          viewMode={true}
        />
      )}
    </Box>
  );
}
