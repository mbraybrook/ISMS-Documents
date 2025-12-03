import { useState, useEffect } from 'react';
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
  useDisclosure as useAlertDisclosure,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, ViewIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { supplierApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Supplier } from '../types/supplier';
import {
  getSupplierStatusDisplayName,
  getSupplierTypeDisplayName,
  getCriticalityDisplayName,
  getPciStatusDisplayName,
  getIsoStatusDisplayName,
  getPerformanceRatingDisplayName,
  getLifecycleStateDisplayName,
} from '../types/supplier';
import { SupplierOnboardingWizard } from '../components/SupplierOnboardingWizard';
import { useDisclosure } from '@chakra-ui/react';

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
  const [pciStatusFilter, setPciStatusFilter] = useState<string>('');
  const [iso27001StatusFilter, setIso27001StatusFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [performanceRatingFilter, setPerformanceRatingFilter] = useState<string>('');
  const [lifecycleStateFilter, setLifecycleStateFilter] = useState<string>('');
  const { isOpen: isArchiveOpen, onOpen: onArchiveOpen, onClose: onArchiveClose } = useAlertDisclosure();
  const { isOpen: isWizardOpen, onOpen: onWizardOpen, onClose: onWizardClose } = useDisclosure();
  const [supplierToArchive, setSupplierToArchive] = useState<Supplier | null>(null);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  // Fetch all suppliers once on mount and when filters change (excluding search)
  useEffect(() => {
    fetchSuppliers();
  }, [supplierTypeFilter, criticalityFilter, pciStatusFilter, iso27001StatusFilter, statusFilter, performanceRatingFilter, lifecycleStateFilter]);

  // Apply client-side filtering when search query or suppliers change
  useEffect(() => {
    applyFilters();
  }, [searchQuery, allSuppliers, supplierTypeFilter, criticalityFilter, pciStatusFilter, iso27001StatusFilter, statusFilter, performanceRatingFilter, lifecycleStateFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (supplierTypeFilter) filters.supplierType = supplierTypeFilter;
      if (criticalityFilter) filters.criticality = criticalityFilter;
      if (pciStatusFilter) filters.pciStatus = pciStatusFilter;
      if (iso27001StatusFilter) filters.iso27001Status = iso27001StatusFilter;
      if (statusFilter) filters.status = statusFilter;
      if (performanceRatingFilter) filters.performanceRating = performanceRatingFilter;
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

  const applyFilters = () => {
    let filtered = [...allSuppliers];

    // Apply search filter (client-side)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchLower)
      );
    }

    // Note: Other filters are already applied server-side in fetchSuppliers
    // But we keep them here for consistency and in case we want to switch to full client-side filtering later

    setSuppliers(filtered);
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

  const getPerformanceRatingColor = (rating: string | null) => {
    switch (rating) {
      case 'GOOD':
        return 'green';
      case 'CAUTION':
        return 'orange';
      case 'BAD':
        return 'red';
      default:
        return 'gray';
    }
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

        <HStack spacing={4} wrap="wrap">
          <Select
            placeholder="All Types"
            value={supplierTypeFilter}
            onChange={(e) => setSupplierTypeFilter(e.target.value)}
            width="200px"
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
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>

          <Select
            placeholder="All PCI Status"
            value={pciStatusFilter}
            onChange={(e) => setPciStatusFilter(e.target.value)}
            width="200px"
          >
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="UNKNOWN">Unknown</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </Select>

          <Select
            placeholder="All ISO 27001 Status"
            value={iso27001StatusFilter}
            onChange={(e) => setIso27001StatusFilter(e.target.value)}
            width="200px"
          >
            <option value="CERTIFIED">Certified</option>
            <option value="NOT_CERTIFIED">Not Certified</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="UNKNOWN">Unknown</option>
          </Select>

          <Select
            placeholder="All Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            width="200px"
          >
            <option value="ACTIVE">Active</option>
            <option value="IN_ONBOARDING">In Onboarding</option>
            <option value="IN_EXIT">In Exit</option>
            <option value="INACTIVE">Inactive</option>
          </Select>

          <Select
            placeholder="All Performance"
            value={performanceRatingFilter}
            onChange={(e) => setPerformanceRatingFilter(e.target.value)}
            width="200px"
          >
            <option value="GOOD">Good</option>
            <option value="CAUTION">Caution</option>
            <option value="BAD">Bad</option>
          </Select>

          <Select
            placeholder="All Lifecycle States"
            value={lifecycleStateFilter}
            onChange={(e) => setLifecycleStateFilter(e.target.value)}
            width="200px"
          >
            <option value="DRAFT">Draft</option>
            <option value="IN_ASSESSMENT">In Assessment</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="EXIT_IN_PROGRESS">Exit In Progress</option>
          </Select>

          {(supplierTypeFilter || criticalityFilter || pciStatusFilter || iso27001StatusFilter || statusFilter || performanceRatingFilter || lifecycleStateFilter || searchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSupplierTypeFilter('');
                setCriticalityFilter('');
                setPciStatusFilter('');
                setIso27001StatusFilter('');
                setStatusFilter('');
                setPerformanceRatingFilter('');
                setLifecycleStateFilter('');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </HStack>
      </VStack>

      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Criticality</Th>
              <Th>PCI Status</Th>
              <Th>ISO 27001</Th>
              <Th>Performance</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <Th>Lifecycle</Th>
              <Th>Last Review</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {suppliers.length === 0 ? (
              <Tr>
                <Td colSpan={11} textAlign="center" py={8}>
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
                >
                  <Td fontWeight="medium">{supplier.name}</Td>
                  <Td>{getSupplierTypeDisplayName(supplier.supplierType)}</Td>
                  <Td>
                    {supplier.criticality ? (
                      <Badge colorScheme={getCriticalityColor(supplier.criticality)}>
                        {getCriticalityDisplayName(supplier.criticality)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    {supplier.pciStatus ? (
                      <Badge>{getPciStatusDisplayName(supplier.pciStatus)}</Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    {supplier.iso27001Status ? (
                      <Badge>{getIsoStatusDisplayName(supplier.iso27001Status)}</Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    {supplier.performanceRating ? (
                      <Badge colorScheme={getPerformanceRatingColor(supplier.performanceRating)}>
                        {getPerformanceRatingDisplayName(supplier.performanceRating)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    {supplier.relationshipOwner ? supplier.relationshipOwner.displayName : '-'}
                  </Td>
                  <Td>
                    <Badge colorScheme={getStatusColor(supplier.status)}>
                      {getSupplierStatusDisplayName(supplier.status)}
                    </Badge>
                  </Td>
                  <Td>
                    {supplier.lifecycleState ? (
                      <Badge colorScheme={getLifecycleStateColor(supplier.lifecycleState)}>
                        {getLifecycleStateDisplayName(supplier.lifecycleState)}
                      </Badge>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    {supplier.lastComplianceReviewAt
                      ? new Date(supplier.lastComplianceReviewAt).toLocaleDateString()
                      : '-'}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
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

      <AlertDialog isOpen={isArchiveOpen} onClose={onArchiveClose} leastDestructiveRef={undefined}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Archive Supplier
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to archive "{supplierToArchive?.name}"? This will set the status to Inactive.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button onClick={onArchiveClose}>Cancel</Button>
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

