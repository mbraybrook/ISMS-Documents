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
  Input,
  InputGroup,
  InputLeftElement,
  useToast,
  Badge,
  Spinner,
  Center,
  Select,
  Flex,
  IconButton,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Text,
  Icon,
  useDisclosure as useAlertDisclosure,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, ViewIcon, ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { supplierApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Supplier } from '../types/supplier';
import {
  getSupplierStatusDisplayName,
  getCriticalityDisplayName,
  getCiaImpactDisplayName,
  getRiskRatingDisplayName,
} from '../types/supplier';
import { SupplierOnboardingWizard } from '../components/SupplierOnboardingWizard';
import { useDisclosure } from '@chakra-ui/react';

// Cloud icon SVG path
const CloudIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"
    />
  </Icon>
);

// Credit card icon SVG path
const CreditCardIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"
    />
  </Icon>
);

export function SuppliersPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>('');
  const [criticalityFilter, setCriticalityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [lifecycleStateFilter, setLifecycleStateFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { isOpen: isArchiveOpen, onOpen: onArchiveOpen, onClose: onArchiveClose } = useAlertDisclosure();
  const { isOpen: isWizardOpen, onOpen: onWizardOpen, onClose: onWizardClose } = useDisclosure();
  const [supplierToArchive, setSupplierToArchive] = useState<Supplier | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Fetch all suppliers once on mount and when filters change (excluding search)
  useEffect(() => {
    fetchSuppliers();
  }, [supplierTypeFilter, criticalityFilter, statusFilter, lifecycleStateFilter]);

  // Apply client-side filtering and sorting when search query or suppliers change
  useEffect(() => {
    applyFiltersAndSort();
  }, [searchQuery, allSuppliers, supplierTypeFilter, criticalityFilter, statusFilter, lifecycleStateFilter, sortField, sortDirection]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (supplierTypeFilter) filters.supplierType = supplierTypeFilter;
      if (criticalityFilter) filters.criticality = criticalityFilter;
      if (statusFilter) filters.status = statusFilter;
      if (lifecycleStateFilter) filters.lifecycleState = lifecycleStateFilter;
      // Fetch all suppliers for client-side filtering (use large limit)
      filters.limit = 10000;

      const data = await supplierApi.getSuppliers(filters);
      setAllSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch suppliers',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allSuppliers];

    // Apply search filter (client-side)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'criticality':
          const criticalityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, null: 0 };
          comparison = (criticalityOrder[a.criticality as keyof typeof criticalityOrder] || 0) - 
                      (criticalityOrder[b.criticality as keyof typeof criticalityOrder] || 0);
          break;
        case 'ciaImpact':
          const ciaOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, null: 0 };
          comparison = (ciaOrder[a.ciaImpact as keyof typeof ciaOrder] || 0) - 
                      (ciaOrder[b.ciaImpact as keyof typeof ciaOrder] || 0);
          break;
        case 'riskRating':
          const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, null: 0 };
          comparison = (riskOrder[a.overallRiskRating as keyof typeof riskOrder] || 0) - 
                      (riskOrder[b.overallRiskRating as keyof typeof riskOrder] || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'complianceStatus':
          const complianceOrder = { PASS: 3, IN_PROGRESS: 2, FAIL: 1, UNKNOWN: 0 };
          const aCompliance = getComplianceStatus(a);
          const bCompliance = getComplianceStatus(b);
          comparison = (complianceOrder[aCompliance] || 0) - (complianceOrder[bCompliance] || 0);
          break;
        case 'lastReview':
          const aDate = a.lastComplianceReviewAt ? new Date(a.lastComplianceReviewAt).getTime() : 0;
          const bDate = b.lastComplianceReviewAt ? new Date(b.lastComplianceReviewAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setSuppliers(filtered);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getComplianceStatus = (supplier: Supplier): 'PASS' | 'IN_PROGRESS' | 'FAIL' | 'UNKNOWN' => {
    const statuses: string[] = [];
    
    // PCI Status
    if (supplier.pciStatus) {
      if (supplier.pciStatus === 'PASS' || supplier.pciStatus === 'NOT_APPLICABLE') {
        statuses.push('PASS');
      } else if (supplier.pciStatus === 'FAIL') {
        statuses.push('FAIL');
      } else if (supplier.pciStatus === 'UNKNOWN') {
        statuses.push('UNKNOWN');
      }
    }
    
    // ISO 27001 Status
    if (supplier.iso27001Status) {
      if (supplier.iso27001Status === 'CERTIFIED' || supplier.iso27001Status === 'NOT_APPLICABLE') {
        statuses.push('PASS');
      } else if (supplier.iso27001Status === 'IN_PROGRESS') {
        statuses.push('IN_PROGRESS');
      } else if (supplier.iso27001Status === 'NOT_CERTIFIED') {
        statuses.push('FAIL');
      } else if (supplier.iso27001Status === 'UNKNOWN') {
        statuses.push('UNKNOWN');
      }
    }
    
    // GDPR Status
    if (supplier.gdprStatus) {
      if (supplier.gdprStatus === 'ADEQUATE' || supplier.gdprStatus === 'NOT_APPLICABLE') {
        statuses.push('PASS');
      } else if (supplier.gdprStatus === 'HIGH_RISK') {
        statuses.push('FAIL');
      } else if (supplier.gdprStatus === 'UNKNOWN') {
        statuses.push('UNKNOWN');
      }
    }
    
    // If no statuses at all, return UNKNOWN
    if (statuses.length === 0) {
      return 'UNKNOWN';
    }
    
    // Priority 1: Check for FAIL (any one is Fail/Not Certified/High Risk)
    if (statuses.includes('FAIL')) {
      return 'FAIL';
    }
    
    // Priority 2: Check for IN_PROGRESS (any one is In Progress)
    if (statuses.includes('IN_PROGRESS')) {
      return 'IN_PROGRESS';
    }
    
    // Priority 3: Check if all are PASS (all are Passed/Certified/Not Applicable)
    if (statuses.every(s => s === 'PASS')) {
      return 'PASS';
    }
    
    // If mixed (some PASS, some UNKNOWN), return UNKNOWN
    return 'UNKNOWN';
  };

  const getComplianceStatusColor = (status: 'PASS' | 'IN_PROGRESS' | 'FAIL' | 'UNKNOWN') => {
    switch (status) {
      case 'PASS':
        return 'green';
      case 'IN_PROGRESS':
        return 'yellow';
      case 'FAIL':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getComplianceStatusDisplayName = (status: 'PASS' | 'IN_PROGRESS' | 'FAIL' | 'UNKNOWN') => {
    switch (status) {
      case 'PASS':
        return 'Pass';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'FAIL':
        return 'Fail';
      default:
        return 'Unknown';
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (supplierTypeFilter) count++;
    if (criticalityFilter) count++;
    if (statusFilter) count++;
    if (lifecycleStateFilter) count++;
    return count;
  };

  const handleArchive = async () => {
    if (!supplierToArchive) return;

    try {
      await supplierApi.archiveSupplier(supplierToArchive.id);
      toast({
        title: 'Success',
        description: 'Supplier archived successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onArchiveClose();
      setSupplierToArchive(null);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to archive supplier',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'IN_ONBOARDING':
        return 'blue';
      case 'IN_EXIT':
        return 'orange';
      case 'INACTIVE':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getCriticalityColor = (criticality: string | null) => {
    switch (criticality) {
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

  const getCiaImpactColor = (impact: string | null) => {
    switch (impact) {
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

  const getRiskRatingColor = (rating: string | null) => {
    switch (rating) {
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

  if (loading) {
    return (
      <Center minH="400px">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Suppliers</Heading>
        {canEdit && (
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={onWizardOpen}
          >
            Create Supplier
          </Button>
        )}
      </Flex>

      <VStack spacing={4} align="stretch" mb={6}>
        <HStack spacing={4}>
          <InputGroup flex="1">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search suppliers by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </HStack>

        <VStack spacing={3} align="stretch">
          <HStack spacing={6} wrap="wrap">
            <Select
              placeholder="All Types"
              value={supplierTypeFilter}
              onChange={(e) => setSupplierTypeFilter(e.target.value)}
              width="200px"
              bg={supplierTypeFilter ? 'blue.50' : 'white'}
              borderColor={supplierTypeFilter ? 'blue.300' : 'gray.200'}
            >
              <option value="SERVICE_PROVIDER">Service Provider</option>
              <option value="CONNECTED_ENTITY">Connected Entity</option>
              <option value="PCI_SERVICE_PROVIDER">PCI Service Provider</option>
            </Select>

            <Select
              placeholder="All Criticality"
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              width="200px"
              bg={criticalityFilter ? 'blue.50' : 'white'}
              borderColor={criticalityFilter ? 'blue.300' : 'gray.200'}
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>

            <Select
              placeholder="All Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              width="200px"
              bg={statusFilter ? 'blue.50' : 'white'}
              borderColor={statusFilter ? 'blue.300' : 'gray.200'}
            >
              <option value="ACTIVE">Active</option>
              <option value="IN_ONBOARDING">In Onboarding</option>
              <option value="IN_EXIT">In Exit</option>
              <option value="INACTIVE">Inactive</option>
            </Select>

            <Select
              placeholder="All Lifecycle States"
              value={lifecycleStateFilter}
              onChange={(e) => setLifecycleStateFilter(e.target.value)}
              width="200px"
              bg={lifecycleStateFilter ? 'blue.50' : 'white'}
              borderColor={lifecycleStateFilter ? 'blue.300' : 'gray.200'}
            >
              <option value="DRAFT">Draft</option>
              <option value="IN_ASSESSMENT">In Assessment</option>
              <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="EXIT_IN_PROGRESS">Exit In Progress</option>
            </Select>

            <HStack spacing={2}>
              {getActiveFilterCount() > 0 && (
                <Badge colorScheme="blue" fontSize="sm" px={2} py={1}>
                  {suppliers.length} of {allSuppliers.length} suppliers
                </Badge>
              )}
              {getActiveFilterCount() > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSupplierTypeFilter('');
                    setCriticalityFilter('');
                    setStatusFilter('');
                    setLifecycleStateFilter('');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </HStack>
          </HStack>
        </VStack>
      </VStack>

      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th
                position="sticky"
                left={0}
                zIndex={20}
                bg="white"
                boxShadow="2px 0 4px rgba(0,0,0,0.1)"
                cursor="pointer"
                onClick={() => handleSort('name')}
                _hover={{ bg: 'gray.50' }}
                minW="200px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'name' ? 'semibold' : 'normal'}>Name</Box>
                  {sortField === 'name' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('criticality')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'criticality' ? 'blue.50' : 'transparent'}
                minW="120px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'criticality' ? 'semibold' : 'normal'}>Criticality</Box>
                  {sortField === 'criticality' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('ciaImpact')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'ciaImpact' ? 'blue.50' : 'transparent'}
                minW="110px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'ciaImpact' ? 'semibold' : 'normal'}>CIA Impact</Box>
                  {sortField === 'ciaImpact' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('riskRating')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'riskRating' ? 'blue.50' : 'transparent'}
                minW="110px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'riskRating' ? 'semibold' : 'normal'}>Risk Rating</Box>
                  {sortField === 'riskRating' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('status')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'status' ? 'blue.50' : 'transparent'}
                minW="120px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'status' ? 'semibold' : 'normal'}>Status</Box>
                  {sortField === 'status' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('complianceStatus')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'complianceStatus' ? 'blue.50' : 'transparent'}
                minW="140px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'complianceStatus' ? 'semibold' : 'normal'}>Compliance Status</Box>
                  {sortField === 'complianceStatus' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th
                cursor="pointer"
                onClick={() => handleSort('lastReview')}
                _hover={{ bg: 'gray.50' }}
                bg={sortField === 'lastReview' ? 'blue.50' : 'transparent'}
                minW="120px"
                px={3}
              >
                <HStack spacing={2}>
                  <Box fontWeight={sortField === 'lastReview' ? 'semibold' : 'normal'}>Last Review</Box>
                  {sortField === 'lastReview' ? (
                    sortDirection === 'asc' ? (
                      <ChevronUpIcon boxSize={4} color="blue.500" />
                    ) : (
                      <ChevronDownIcon boxSize={4} color="blue.500" />
                    )
                  ) : (
                    <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
                  )}
                </HStack>
              </Th>
              <Th minW="100px" px={3}>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {suppliers.length === 0 ? (
              <Tr>
                <Td colSpan={8} textAlign="center" py={8}>
                  <Text color="gray.500">No suppliers found</Text>
                </Td>
              </Tr>
            ) : (
              suppliers.map((supplier) => (
                <Tr 
                  key={supplier.id}
                  _hover={{ bg: 'blue.50', cursor: 'pointer' }}
                  transition="background-color 0.2s"
                  onClick={() => navigate(`/admin/suppliers/${supplier.id}?mode=view`)}
                  sx={{
                    '&:hover td:first-of-type': {
                      bg: 'blue.50',
                    },
                  }}
                >
                  <Td
                    fontWeight="medium"
                    position="sticky"
                    left={0}
                    zIndex={10}
                    bg="white"
                    boxShadow="2px 0 4px rgba(0,0,0,0.1)"
                    px={3}
                    transition="background-color 0.2s"
                  >
                    <HStack spacing={2}>
                      <Text>{supplier.name}</Text>
                      {supplier.serviceSubType === 'SAAS' && (
                        <Tooltip label="SaaS">
                          <Box>
                            <CloudIcon boxSize={4} color="blue.500" />
                          </Box>
                        </Tooltip>
                      )}
                      {supplier.supplierType === 'PCI_SERVICE_PROVIDER' && (
                        <Tooltip label="PCI Service Provider">
                          <Box>
                            <CreditCardIcon boxSize={4} color="orange.500" />
                          </Box>
                        </Tooltip>
                      )}
                    </HStack>
                  </Td>
                  <Td px={3}>
                    {supplier.criticality ? (
                      <Badge colorScheme={getCriticalityColor(supplier.criticality)}>
                        {getCriticalityDisplayName(supplier.criticality)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td px={3}>
                    {supplier.ciaImpact ? (
                      <Badge colorScheme={getCiaImpactColor(supplier.ciaImpact)}>
                        {getCiaImpactDisplayName(supplier.ciaImpact)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td px={3}>
                    {supplier.overallRiskRating ? (
                      <Badge colorScheme={getRiskRatingColor(supplier.overallRiskRating)}>
                        {getRiskRatingDisplayName(supplier.overallRiskRating)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td px={3}>
                    <Badge colorScheme={getStatusColor(supplier.status)}>
                      {getSupplierStatusDisplayName(supplier.status)}
                    </Badge>
                  </Td>
                  <Td px={3}>
                    <Badge colorScheme={getComplianceStatusColor(getComplianceStatus(supplier))}>
                      {getComplianceStatusDisplayName(getComplianceStatus(supplier))}
                    </Badge>
                  </Td>
                  <Td px={3} whiteSpace="nowrap" fontSize="sm">
                    {supplier.lastComplianceReviewAt
                      ? new Date(supplier.lastComplianceReviewAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()} px={3}>
                    <HStack spacing={2}>
                      <Tooltip label="View">
                        <IconButton
                          aria-label="View supplier"
                          icon={<ViewIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/suppliers/${supplier.id}?mode=view`);
                          }}
                        />
                      </Tooltip>
                      {canEdit && (
                        <>
                          <Tooltip label="Edit">
                            <IconButton
                              aria-label="Edit supplier"
                              icon={<EditIcon />}
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/suppliers/${supplier.id}?mode=edit`);
                              }}
                            />
                          </Tooltip>
                          {supplier.status !== 'INACTIVE' && (
                            <Tooltip label="Archive">
                              <IconButton
                                aria-label="Archive supplier"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSupplierToArchive(supplier);
                                  onArchiveOpen();
                                }}
                              />
                            </Tooltip>
                          )}
                        </>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      <AlertDialog isOpen={isArchiveOpen} onClose={onArchiveClose} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Archive Supplier
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to archive "{supplierToArchive?.name}"? This will set the status to Inactive.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onArchiveClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleArchive} ml={3}>
                Archive
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <SupplierOnboardingWizard
        isOpen={isWizardOpen}
        onClose={() => {
          onWizardClose();
          fetchSuppliers();
        }}
      />
    </Box>
  );
}

