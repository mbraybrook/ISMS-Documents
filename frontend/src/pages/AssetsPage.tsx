import { useState, useEffect, useRef } from 'react';
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
  Text,
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
  Checkbox,
  Input,
  Select,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, DownloadIcon, ChevronUpIcon, ChevronDownIcon, InfoIcon, HamburgerIcon } from '@chakra-ui/icons';
import { Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DataTable, Column, FilterConfig, ActionButton, PaginationConfig, SortConfig, CSVExportConfig } from '../components/DataTable';
import { formatBoolean, generateCSV } from '../utils/tableUtils';

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
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useAlertDisclosure();
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

  const confirmBulkDelete = async () => {
    if (selectedAssets.size === 0) return;

    try {
      const deletePromises = Array.from(selectedAssets).map((assetId) =>
        api.delete(`/api/assets/${assetId}`)
      );
      await Promise.all(deletePromises);
      
      const deletedCount = selectedAssets.size;
      toast({
        title: 'Success',
        description: `${deletedCount} asset${deletedCount !== 1 ? 's' : ''} deleted successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onBulkDeleteClose();
      setSelectedAssets(new Set());
      fetchAssets();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete assets';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleBulkExport = () => {
    const selectedAssetsList = assets.filter(a => selectedAssets.has(a.id));
    
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

    const rows = selectedAssetsList.map((asset) => [
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

    generateCSV(headers, rows, `selected_assets_${new Date().toISOString().split('T')[0]}.csv`);
    toast({
      title: 'Export Successful',
      description: `Exported ${selectedAssetsList.length} selected asset${selectedAssetsList.length !== 1 ? 's' : ''} to CSV`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    } else {
      setSelectedAssets(new Set());
    }
  };

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    const newSelected = new Set(selectedAssets);
    if (checked) {
      newSelected.add(assetId);
    } else {
      newSelected.delete(assetId);
    }
    setSelectedAssets(newSelected);
  };

  // DataTable configuration
  const columns: Column<Asset>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (asset) => new Date(asset.date).toLocaleDateString(),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (asset) => asset.category.name,
    },
    {
      key: 'assetSubCategory',
      header: 'Sub-category',
      render: (asset) => asset.assetSubCategory || <Text color="gray.400" fontSize="xs">—</Text>,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      render: (asset) => asset.owner,
    },
    {
      key: 'primaryUser',
      header: 'Primary User',
      render: (asset) => asset.primaryUser || <Text color="gray.400" fontSize="xs">Not assigned</Text>,
    },
    {
      key: 'model',
      header: 'Model',
      render: (asset) => asset.model || <Text color="gray.400">—</Text>,
    },
    {
      key: 'nameSerialNo',
      header: 'Serial No',
      render: (asset) => asset.nameSerialNo || <Text color="gray.400">—</Text>,
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (asset) => (
        <Badge colorScheme={getClassificationColor(asset.classification.name)}>
          {asset.classification.name}
        </Badge>
      ),
    },
    {
      key: 'cdeImpacting',
      header: 'CDE',
      render: (asset) =>
        asset.cdeImpacting ? (
          <Badge colorScheme="red" display="flex" alignItems="center" justifyContent="center" w="50px">
            ✓
          </Badge>
        ) : (
          <Badge colorScheme="gray" display="flex" alignItems="center" justifyContent="center" w="50px">
            ✗
          </Badge>
        ),
    },
    {
      key: 'risks',
      header: 'Risks',
      render: (asset) =>
        (asset._count?.risks || 0) > 0 ? (
          <Badge colorScheme="purple">{asset._count?.risks || 0}</Badge>
        ) : (
          <Text fontSize="xs" color="gray.400">—</Text>
        ),
    },
  ];

  const filterConfigs: FilterConfig[] = [
    {
      key: 'search',
      type: 'search',
      placeholder: 'Search assets...',
    },
    {
      key: 'categoryId',
      type: 'select',
      placeholder: 'All Categories',
      options: categories.map((cat) => ({ value: cat.id, label: cat.name })),
    },
    {
      key: 'classificationId',
      type: 'select',
      placeholder: 'All Classifications',
      options: classifications.map((cls) => ({ value: cls.id, label: cls.name })),
    },
  ];

  const actions: ActionButton<Asset>[] = canEdit
    ? [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: handleEdit,
          colorScheme: 'blue',
        },
        {
          icon: <DeleteIcon />,
          label: 'Delete',
          onClick: handleDelete,
          colorScheme: 'red',
        },
      ]
    : [];

  const paginationConfig: PaginationConfig = {
    mode: 'server',
    page: filters.page,
    pageSize: filters.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    onPageChange: (page) => setFilters({ ...filters, page }),
    onPageSizeChange: (newSize) => setFilters({ ...filters, limit: newSize, page: 1 }),
  };

  const sortConfig: SortConfig = {
    field: filters.sortBy,
    direction: filters.sortOrder,
    onSort: handleSort,
  };

  // CSV export is handled separately since we need to fetch all data for server-side pagination
  const csvExportConfig: CSVExportConfig = {
    enabled: false, // Disabled - using separate export button
    filename: '',
    headers: [],
    getRowData: () => [],
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

      {selectedAssets.size > 0 && (
        <Box
          p={3}
          bg="blue.50"
          borderRadius="md"
          borderWidth="1px"
          borderColor="blue.200"
          display="flex"
          alignItems="center"
          gap={3}
          mb={4}
        >
          <Text fontSize="sm" fontWeight="medium" color="blue.700">
            {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''} selected
          </Text>
          <HStack spacing={2}>
            {canEdit && (
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
                    <MenuItem onClick={handleBulkExport}>
                      Export Selected
                    </MenuItem>
                  </MenuList>
                </Menu>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedAssets(new Set())}
            >
              Clear Selection
            </Button>
          </HStack>
        </Box>
      )}

      <DataTable
        title=""
        data={assets}
        columns={columns}
        loading={loading}
        emptyMessage="No assets found"
        filters={filterConfigs}
        filterValues={{
          search: filters.search,
          categoryId: filters.categoryId,
          classificationId: filters.classificationId,
        }}
        onFilterChange={(key, value) => {
          setFilters({ ...filters, [key]: value, page: 1 });
        }}
        onClearFilters={clearAllFilters}
        showFiltersHeading={true}
        sortConfig={sortConfig}
        enableSelection={canEdit}
        selectedIds={selectedAssets}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectAsset}
        getRowId={(asset) => asset.id}
        pagination={paginationConfig}
        actions={actions}
        csvExport={csvExportConfig}
        onRowClick={canEdit ? handleEdit : undefined}
      />

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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isBulkDeleteOpen}
        onClose={onBulkDeleteClose}
        closeOnOverlayClick={false}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Selected Assets
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {selectedAssets.size} selected asset{selectedAssets.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button onClick={onBulkDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmBulkDelete} ml={3}>
                Delete {selectedAssets.size} Asset{selectedAssets.size !== 1 ? 's' : ''}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}

