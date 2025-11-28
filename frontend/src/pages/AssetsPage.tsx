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
  InputGroup,
  InputLeftElement,
  Text,
  IconButton,
  Tooltip,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormErrorMessage,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure as useAlertDisclosure,
  Spinner,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, DownloadIcon, ChevronUpIcon, ChevronDownIcon, InfoIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Asset {
  id: string;
  date: string;
  assetCategoryId: string;
  assetSubCategory: string | null;
  owner: string;
  primaryUser: string | null;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  nameSerialNo: string | null;
  cdeImpacting: boolean;
  classificationId: string;
  purpose: string | null;
  notes: string | null;
  cost: string | null;
  category: {
    id: string;
    name: string;
  };
  classification: {
    id: string;
    name: string;
  };
  _count?: {
    risks: number;
  };
}

interface AssetCategory {
  id: string;
  name: string;
}

interface Classification {
  id: string;
  name: string;
}

export function AssetsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters] = useState({
    categoryId: '',
    classificationId: '',
    owner: '',
    search: '',
    page: 1,
    limit: 20,
    sortBy: 'date',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [owners, setOwners] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const { isOpen: isImportModalOpen, onOpen: onImportModalOpen, onClose: onImportModalClose } = useDisclosure();
  const { isOpen: isUnsavedDialogOpen, onOpen: onUnsavedDialogOpen, onClose: onUnsavedDialogClose } = useAlertDisclosure();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  useEffect(() => {
    fetchAssets();
    fetchCategories();
    fetchClassifications();
  }, [filters]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.classificationId) params.append('classificationId', filters.classificationId);
      if (filters.owner) params.append('owner', filters.owner);
      if (filters.search) params.append('search', filters.search);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/api/assets?${params.toString()}`);
      setAssets(response.data.data);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
      
      // Extract unique owners for dropdown
      const uniqueOwners = Array.from(new Set(response.data.data.map((a: Asset) => a.owner).filter(Boolean)));
      setOwners(uniqueOwners.sort());
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assets',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/asset-categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchClassifications = async () => {
    try {
      const response = await api.get('/api/classifications');
      setClassifications(response.data);
    } catch (error) {
      console.error('Error fetching classifications:', error);
    }
  };

  const handleCreate = () => {
    setSelectedAsset(null);
    const initialData = {
      date: new Date().toISOString().split('T')[0],
      assetCategoryId: '',
      classificationId: '',
      owner: '',
      cdeImpacting: false,
    };
    setFormData(initialData);
    setFormErrors({});
    initialFormDataRef.current = JSON.stringify(initialData);
    setHasUnsavedChanges(false);
    onOpen();
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    const initialData = {
      date: asset.date.split('T')[0],
      assetCategoryId: asset.assetCategoryId,
      assetSubCategory: asset.assetSubCategory || '',
      owner: asset.owner,
      primaryUser: asset.primaryUser || '',
      location: asset.location || '',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      nameSerialNo: asset.nameSerialNo || '',
      cdeImpacting: asset.cdeImpacting,
      classificationId: asset.classificationId,
      purpose: asset.purpose || '',
      notes: asset.notes || '',
      cost: asset.cost || '',
    };
    setFormData(initialData);
    setFormErrors({});
    initialFormDataRef.current = JSON.stringify(initialData);
    setHasUnsavedChanges(false);
    onOpen();
  };

  const handleDelete = (asset: Asset) => {
    setAssetToDelete(asset);
    onDeleteOpen();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.assetCategoryId) errors.assetCategoryId = 'Category is required';
    if (!formData.owner) errors.owner = 'Owner is required';
    if (!formData.classificationId) errors.classificationId = 'Classification is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
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

    try {
      if (selectedAsset) {
        await api.put(`/api/assets/${selectedAsset.id}`, formData);
        toast({
          title: 'Success',
          description: 'Asset updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/assets', formData);
        toast({
          title: 'Success',
          description: 'Asset created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      setHasUnsavedChanges(false);
      onClose();
      // Small delay to show toast before refetching
      setTimeout(() => {
        fetchAssets();
      }, 500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save asset';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      onUnsavedDialogOpen();
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setHasUnsavedChanges(false);
    onUnsavedDialogClose();
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;

    try {
      await api.delete(`/api/assets/${assetToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Asset deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      setAssetToDelete(null);
      fetchAssets();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete asset';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/assets/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${response.data.success} of ${response.data.total} assets`,
        status: response.data.failed > 0 ? 'warning' : 'success',
        duration: 5000,
        isClosable: true,
      });

      if (response.data.errors && response.data.errors.length > 0) {
        console.error('Import errors:', response.data.errors);
        toast({
          title: 'Some imports failed',
          description: `${response.data.failed} assets failed to import. Check console for details.`,
          status: 'warning',
          duration: 7000,
          isClosable: true,
        });
      }

      fetchAssets();
      fetchCategories();
      fetchClassifications();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to import assets';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const exportToCSV = async () => {
    try {
      setExporting(true);
      
      // Fetch all assets for export (not just current page)
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.classificationId) params.append('classificationId', filters.classificationId);
      if (filters.owner) params.append('owner', filters.owner);
      if (filters.search) params.append('search', filters.search);
      params.append('page', '1');
      params.append('limit', '10000'); // Get all matching assets

      const response = await api.get(`/api/assets?${params.toString()}`);
      const allAssets = response.data.data || assets;

      const headers = [
        'Date',
        'Category',
        'Sub-category',
        'Owner',
        'Primary User',
        'Location',
        'Manufacturer',
        'Model',
        'Serial No',
        'CDE Impacting',
        'Classification',
        'Purpose',
        'Notes',
        'Cost',
      ];

      const rows = allAssets.map((asset: Asset) => [
        asset.date.split('T')[0],
        asset.category.name,
        asset.assetSubCategory || '',
        asset.owner,
        asset.primaryUser || '',
        asset.location || '',
        asset.manufacturer || '',
        asset.model || '',
        asset.nameSerialNo || '',
        asset.cdeImpacting ? 'Yes' : 'No',
        asset.classification.name,
        asset.purpose || '',
        asset.notes || '',
        asset.cost || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const filename = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${allAssets.length} asset(s) to ${filename}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export assets to CSV',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (field: string) => {
    const newOrder = filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    setFilters({ ...filters, sortBy: field, sortOrder: newOrder, page: 1 });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.categoryId) count++;
    if (filters.classificationId) count++;
    if (filters.owner) count++;
    if (filters.search) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilters({
      categoryId: '',
      classificationId: '',
      owner: '',
      search: '',
      page: 1,
      limit: 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  const getClassificationColor = (name: string) => {
    const normalized = name.toUpperCase().trim();
    if (normalized.includes('PUBLIC')) return 'gray';
    if (normalized.includes('SENSITIVE')) return 'blue';
    if (normalized.includes('CONFIDENTIAL')) return 'orange';
    if (normalized.includes('PROPRIETARY')) return 'red';
    return 'purple';
  };

  const downloadTemplate = () => {
    const headers = [
      'Date',
      'Asset Category',
      'Asset Sub-category',
      'Owner',
      '[Primary] User',
      'Location',
      'Manufacturer / Supplier',
      'Model / Version',
      'Name / Serial No.',
      'CDE Impacting?',
      'Paythru Classification',
      'Purpose',
      'Notes',
      'Cost',
    ];
    const exampleRow = [
      '01/01/2025',
      'Hardware',
      'Laptop',
      'CISO',
      'John Doe',
      'User Home',
      'Dell',
      'Latitude 5430',
      'ABC123',
      'No',
      'Paythru Confidential',
      'Administrative work',
      '',
      '£1,500.00',
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'assets_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Track form changes
  useEffect(() => {
    if (isOpen && initialFormDataRef.current) {
      const currentData = JSON.stringify(formData);
      const hasChanges = currentData !== initialFormDataRef.current;
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, isOpen]);

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Assets</Heading>
        <HStack spacing={2}>
          {canEdit && (
            <>
              <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreate}>
                Create Asset
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                accept=".csv"
                style={{ display: 'none' }}
              />
              <Button
                leftIcon={<DownloadIcon />}
                variant="outline"
                onClick={onImportModalOpen}
                isLoading={importing}
                loadingText="Importing..."
              >
                Import CSV
              </Button>
            </>
          )}
          <Button 
            leftIcon={<DownloadIcon />} 
            variant="outline" 
            onClick={exportToCSV}
            isLoading={exporting}
            loadingText="Exporting..."
          >
            Export CSV
          </Button>
        </HStack>
      </HStack>

      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <HStack justify="space-between" mb={4}>
          <Heading size="sm">Filters</Heading>
          {getActiveFilterCount() > 0 && (
            <HStack spacing={2}>
              <Badge colorScheme="blue" fontSize="sm">
                {getActiveFilterCount()} active
              </Badge>
              <Button size="xs" variant="ghost" onClick={clearAllFilters}>
                Clear All
              </Button>
            </HStack>
          )}
        </HStack>
        <HStack spacing={4}>
          <InputGroup flex="1">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search assets..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
          </InputGroup>
          <Select
            placeholder="All Categories"
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}
            width="200px"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Select
            placeholder="All Classifications"
            value={filters.classificationId}
            onChange={(e) => setFilters({ ...filters, classificationId: e.target.value, page: 1 })}
            width="200px"
          >
            {classifications.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </HStack>
      </Box>

      {loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="xl" />
        </Box>
      ) : (
        <Box overflowX="auto" position="relative">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th cursor="pointer" onClick={() => handleSort('date')} _hover={{ bg: 'gray.50' }} whiteSpace="nowrap">
                  <HStack spacing={1}>
                    <Text>Date</Text>
                    {filters.sortBy === 'date' && (
                      filters.sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />
                    )}
                  </HStack>
                </Th>
                <Th cursor="pointer" onClick={() => handleSort('category')} _hover={{ bg: 'gray.50' }} whiteSpace="nowrap">
                  <HStack spacing={1}>
                    <Text>Category</Text>
                    {filters.sortBy === 'category' && (
                      filters.sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />
                    )}
                  </HStack>
                </Th>
                <Th whiteSpace="nowrap">Sub-category</Th>
                <Th cursor="pointer" onClick={() => handleSort('owner')} _hover={{ bg: 'gray.50' }} whiteSpace="nowrap">
                  <HStack spacing={1}>
                    <Text>Owner</Text>
                    {filters.sortBy === 'owner' && (
                      filters.sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />
                    )}
                  </HStack>
                </Th>
                <Th whiteSpace="nowrap">Primary User</Th>
                <Th whiteSpace="nowrap">Model</Th>
                <Th whiteSpace="nowrap">Serial No</Th>
                <Th whiteSpace="nowrap">Classification</Th>
                <Th whiteSpace="nowrap">CDE</Th>
                <Th whiteSpace="nowrap">Risks</Th>
                <Th position="sticky" right={0} bg="white" zIndex={10} boxShadow="sm" whiteSpace="nowrap">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {assets.length === 0 ? (
                <Tr>
                  <Td colSpan={11} textAlign="center">
                    <Text color="gray.500">No assets found</Text>
                  </Td>
                </Tr>
              ) : (
                assets.map((asset) => (
                  <Tr key={asset.id}>
                    <Td>{new Date(asset.date).toLocaleDateString()}</Td>
                    <Td>{asset.category.name}</Td>
                    <Td>{asset.assetSubCategory || <Text color="gray.400" fontSize="xs">—</Text>}</Td>
                    <Td>{asset.owner}</Td>
                    <Td>{asset.primaryUser || <Text color="gray.400" fontSize="xs">Not assigned</Text>}</Td>
                    <Td>{asset.model || <Text color="gray.400">—</Text>}</Td>
                    <Td>{asset.nameSerialNo || <Text color="gray.400">—</Text>}</Td>
                    <Td>
                      <Badge colorScheme={getClassificationColor(asset.classification.name)}>
                        {asset.classification.name}
                      </Badge>
                    </Td>
                    <Td>
                      {asset.cdeImpacting ? (
                        <Badge colorScheme="red" display="flex" alignItems="center" justifyContent="center" w="50px">
                          ✓
                        </Badge>
                      ) : (
                        <Badge colorScheme="gray" display="flex" alignItems="center" justifyContent="center" w="50px">
                          ✗
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {(asset._count?.risks || 0) > 0 ? (
                        <Badge colorScheme="purple">{asset._count?.risks || 0}</Badge>
                      ) : (
                        <Text fontSize="xs" color="gray.400">—</Text>
                      )}
                    </Td>
                    <Td position="sticky" right={0} bg="white" zIndex={10} boxShadow="-2px 0 4px rgba(0,0,0,0.1)">
                      <HStack spacing={2}>
                        {canEdit && (
                          <>
                            <Tooltip label="Edit">
                              <IconButton
                                aria-label="Edit asset"
                                icon={<EditIcon />}
                                size="sm"
                                onClick={() => handleEdit(asset)}
                              />
                            </Tooltip>
                            <Tooltip label="Delete">
                              <IconButton
                                aria-label="Delete asset"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="red"
                                onClick={() => handleDelete(asset)}
                              />
                            </Tooltip>
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
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <HStack justify="center" spacing={4}>
          <Text fontSize="sm" color="gray.600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} assets
          </Text>
          <HStack spacing={2}>
            <Button
              isDisabled={pagination.page === 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Previous
            </Button>
            <Text>
              Page {pagination.page} of {pagination.totalPages}
            </Text>
            <Button
              isDisabled={pagination.page === pagination.totalPages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Next
            </Button>
          </HStack>
        </HStack>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleCloseAttempt} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedAsset ? 'Edit Asset' : 'Create Asset'}</ModalHeader>
          <ModalCloseButton onClick={handleCloseAttempt} />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired isInvalid={!!formErrors.date}>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    if (formErrors.date) setFormErrors({ ...formErrors, date: '' });
                  }}
                />
                {formErrors.date && (
                  <Text fontSize="sm" color="red.500" mt={1}>
                    {formErrors.date}
                  </Text>
                )}
              </FormControl>
              <FormControl isRequired isInvalid={!!formErrors.assetCategoryId}>
                <FormLabel>Category</FormLabel>
                <Select
                  value={formData.assetCategoryId || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, assetCategoryId: e.target.value });
                    if (formErrors.assetCategoryId) setFormErrors({ ...formErrors, assetCategoryId: '' });
                  }}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                {formErrors.assetCategoryId && (
                  <Text fontSize="sm" color="red.500" mt={1}>
                    {formErrors.assetCategoryId}
                  </Text>
                )}
              </FormControl>
              <FormControl>
                <FormLabel>Sub-category</FormLabel>
                <Input
                  value={formData.assetSubCategory || ''}
                  onChange={(e) => setFormData({ ...formData, assetSubCategory: e.target.value })}
                />
              </FormControl>
              <FormControl isRequired isInvalid={!!formErrors.owner}>
                <FormLabel>Owner</FormLabel>
                <Select
                  value={formData.owner || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, owner: e.target.value });
                    if (formErrors.owner) setFormErrors({ ...formErrors, owner: '' });
                  }}
                >
                  <option value="">Select owner</option>
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </Select>
                {formErrors.owner && (
                  <Text fontSize="sm" color="red.500" mt={1}>
                    {formErrors.owner}
                  </Text>
                )}
              </FormControl>
              <FormControl>
                <FormLabel>Primary User</FormLabel>
                <Input
                  value={formData.primaryUser || ''}
                  onChange={(e) => setFormData({ ...formData, primaryUser: e.target.value })}
                  placeholder="Not assigned"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Location</FormLabel>
                <Input
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Manufacturer</FormLabel>
                <Input
                  value={formData.manufacturer || ''}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Model</FormLabel>
                <Input
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Serial No</FormLabel>
                <Input
                  value={formData.nameSerialNo || ''}
                  onChange={(e) => setFormData({ ...formData, nameSerialNo: e.target.value })}
                />
              </FormControl>
              <FormControl isRequired isInvalid={!!formErrors.classificationId}>
                <FormLabel>Classification</FormLabel>
                <Select
                  value={formData.classificationId || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, classificationId: e.target.value });
                    if (formErrors.classificationId) setFormErrors({ ...formErrors, classificationId: '' });
                  }}
                >
                  <option value="">Select classification</option>
                  {classifications.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
                {formErrors.classificationId && (
                  <Text fontSize="sm" color="red.500" mt={1}>
                    {formErrors.classificationId}
                  </Text>
                )}
              </FormControl>
              <FormControl>
                <FormLabel>CDE Impacting</FormLabel>
                <Select
                  value={formData.cdeImpacting ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, cdeImpacting: e.target.value === 'true' })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Purpose</FormLabel>
                <Input
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Notes</FormLabel>
                <Input
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Cost</FormLabel>
                <Input
                  value={formData.cost || ''}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseAttempt}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Instructions Modal */}
      <Modal isOpen={isImportModalOpen} onClose={onImportModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import Assets from CSV</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Box p={4} bg="blue.50" borderRadius="md">
                <HStack mb={2}>
                  <InfoIcon color="blue.500" />
                  <Text fontWeight="bold">CSV Format Requirements</Text>
                </HStack>
                <VStack align="stretch" spacing={2} fontSize="sm">
                  <Text>• Date format: DD/MM/YYYY (e.g., 01/01/2025)</Text>
                  <Text>• Asset Category: Must match an existing category</Text>
                  <Text>• Paythru Classification: Must be one of: Public, Paythru Sensitive, Paythru Confidential, Paythru Proprietary</Text>
                  <Text>• CDE Impacting?: Yes or No</Text>
                  <Text>• All other fields are optional</Text>
                </VStack>
              </Box>
              <HStack spacing={2}>
                <Button
                  leftIcon={<DownloadIcon />}
                  variant="outline"
                  onClick={downloadTemplate}
                  flex={1}
                >
                  Download Template
                </Button>
                <Button
                  leftIcon={<DownloadIcon />}
                  colorScheme="blue"
                  onClick={() => {
                    onImportModalClose();
                    setTimeout(() => handleImportClick(), 100);
                  }}
                  flex={1}
                >
                  Choose File
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onImportModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Unsaved Changes Dialog */}
      <AlertDialog isOpen={isUnsavedDialogOpen} onClose={onUnsavedDialogClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Unsaved Changes
            </AlertDialogHeader>
            <AlertDialogBody>
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button onClick={onUnsavedDialogClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleConfirmClose} ml={3}>
                Discard Changes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Asset
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this asset? This action cannot be undone.
              {assetToDelete && (assetToDelete._count?.risks || 0) > 0 && (
                <Text mt={2} color="red.500" fontSize="sm">
                  Warning: This asset is linked to {assetToDelete._count?.risks} risk(s).
                </Text>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}

