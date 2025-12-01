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
  Badge,
  useDisclosure,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Checkbox,
  Text,
  IconButton,
  Tooltip,
  useToast,
} from '@chakra-ui/react';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, DownloadIcon, EditIcon, ViewIcon, DeleteIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { ControlFormModal } from '../components/ControlFormModal';
import { DataTable, Column, FilterConfig, ActionButton, PaginationConfig, SortConfig, CSVExportConfig } from '../components/DataTable';
import { formatBoolean, generateCSV } from '../utils/tableUtils';

interface Control {
  id: string;
  code: string;
  title: string;
  description: string | null;
  selectedForRiskAssessment: boolean;
  selectedForContractualObligation: boolean;
  selectedForLegalRequirement: boolean;
  selectedForBusinessRequirement: boolean;
  justification: string | null;
  controlText: string | null;
  purpose: string | null;
  guidance: string | null;
  otherInformation: string | null;
  category: string | null;
  isStandardControl: boolean;
  implemented: boolean;
  riskControls: Array<{
    risk: {
      id: string;
      title: string;
    };
  }>;
  documentControls: Array<{
    document: {
      id: string;
      title: string;
      version: string;
    };
  }>;
}

type SortField = 'code' | 'title' | 'category' | 'type' | 'selected';
type SortOrder = 'asc' | 'desc';

// Natural sort for control codes (handles 5.1, 5.2, 5.10 correctly)
const naturalSort = (a: string, b: string): number => {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }
  
  // If numeric parts are equal, fall back to string comparison
  return a.localeCompare(b);
};

// Format category for display
const formatCategory = (category: string | null): string => {
  if (!category) return '';
  const categoryMap: { [key: string]: string } = {
    'ORGANIZATIONAL': 'Organizational',
    'PEOPLE': 'People',
    'PHYSICAL': 'Physical',
    'TECHNOLOGICAL': 'Technological',
  };
  return categoryMap[category] || category;
};

export function ControlsPage() {
  const toast = useToast();
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApplicable, setFilterApplicable] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterImplemented, setFilterImplemented] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);

  useEffect(() => {
    fetchControls();
  }, [filterApplicable, filterCategory, filterImplemented]);

  const fetchControls = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: 1,
        limit: 1000, // Maximum allowed by backend for client-side filtering/sorting
      };
      if (filterApplicable !== '') {
        params.isApplicable = filterApplicable === 'true';
      }
      if (filterCategory !== '') {
        params.category = filterCategory;
      }
      if (filterImplemented !== '') {
        params.implemented = filterImplemented === 'true';
      }
      const response = await api.get('/api/controls', { params });
      setControls(response.data.data);
    } catch (error) {
      console.error('Error fetching controls:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch controls',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndSortedControls = () => {
    let filtered = [...controls];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (control) =>
          control.code.toLowerCase().includes(query) ||
          control.title.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'code':
          comparison = naturalSort(a.code, b.code);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          const aCat = formatCategory(a.category);
          const bCat = formatCategory(b.category);
          comparison = aCat.localeCompare(bCat);
          break;
        case 'type':
          comparison = Number(a.isStandardControl) - Number(b.isStandardControl);
          break;
        case 'selected':
          const aSelected = 
            a.selectedForRiskAssessment ||
            a.selectedForContractualObligation ||
            a.selectedForLegalRequirement ||
            a.selectedForBusinessRequirement;
          const bSelected = 
            b.selectedForRiskAssessment ||
            b.selectedForContractualObligation ||
            b.selectedForLegalRequirement ||
            b.selectedForBusinessRequirement;
          comparison = Number(aSelected) - Number(bSelected);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const handleSort = (field: string) => {
    const sortFieldTyped = field as SortField;
    if (sortField === sortFieldTyped) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(sortFieldTyped);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filtered = getFilteredAndSortedControls();
      setSelectedControlIds(new Set(filtered.map((c) => c.id)));
    } else {
      setSelectedControlIds(new Set());
    }
  };

  const handleSelectControl = (controlId: string, checked: boolean) => {
    const newSelected = new Set(selectedControlIds);
    if (checked) {
      newSelected.add(controlId);
    } else {
      newSelected.delete(controlId);
    }
    setSelectedControlIds(newSelected);
  };

  const handleEdit = (control: Control) => {
    setSelectedControl(control);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedControl(null);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setSelectedControl(null);
    fetchControls();
    setSelectedControlIds(new Set());
  };

  const handleDelete = async (control: Control) => {
    if (control.isStandardControl) {
      toast({
        title: 'Error',
        description: 'Cannot delete standard controls',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete control "${control.code} - ${control.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/controls/${control.id}`);
      toast({
        title: 'Success',
        description: 'Control deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchControls();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete control',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // DataTable configuration
  const columns: Column<Control>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (control) => <Text fontWeight="medium">{control.code}</Text>,
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (control) => (
        <Tooltip label={control.title} isDisabled={control.title.length < 50}>
          <Text noOfLines={2} maxW="300px" title={control.title}>
            {control.title}
          </Text>
        </Tooltip>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (control) =>
        control.category ? (
          <Badge
            colorScheme={
              control.category === 'ORGANIZATIONAL' ? 'blue' :
              control.category === 'PEOPLE' ? 'purple' :
              control.category === 'PHYSICAL' ? 'orange' :
              'teal'
            }
          >
            {formatCategory(control.category)}
          </Badge>
        ) : (
          <Text color="gray.400" fontSize="xs">—</Text>
        ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (control) =>
        control.isStandardControl ? (
          <Badge colorScheme="green">Standard</Badge>
        ) : (
          <Badge colorScheme="orange">Custom</Badge>
        ),
    },
    {
      key: 'selected',
      header: 'Selected',
      sortable: true,
      render: (control) => {
        const isSelected =
          control.selectedForRiskAssessment ||
          control.selectedForContractualObligation ||
          control.selectedForLegalRequirement ||
          control.selectedForBusinessRequirement;
        return (
          <Badge colorScheme={isSelected ? 'green' : 'gray'}>
            {isSelected ? 'Yes' : 'No'}
          </Badge>
        );
      },
    },
    {
      key: 'selectionReasons',
      header: 'Selection Reasons',
      render: (control) => {
        const reasons: string[] = [];
        if (control.selectedForRiskAssessment) reasons.push('Risk Assessment');
        if (control.selectedForContractualObligation) reasons.push('Contractual');
        if (control.selectedForLegalRequirement) reasons.push('Legal');
        if (control.selectedForBusinessRequirement) reasons.push('Business');
        
        return reasons.length > 0 ? (
          <VStack align="start" spacing={1}>
            {reasons.map((reason, idx) => (
              <Badge
                key={idx}
                colorScheme={
                  reason === 'Risk Assessment' ? 'blue' :
                  reason === 'Contractual' ? 'purple' :
                  reason === 'Legal' ? 'red' :
                  'orange'
                }
                fontSize="xs"
              >
                {reason}
              </Badge>
            ))}
          </VStack>
        ) : (
          <Badge colorScheme="gray" fontSize="xs">None</Badge>
        );
      },
    },
    {
      key: 'linkedRisks',
      header: 'Linked Risks',
      render: (control) => control.riskControls.length,
    },
    {
      key: 'linkedDocuments',
      header: 'Linked Documents',
      render: (control) => control.documentControls.length,
    },
  ];

  const filterConfigs: FilterConfig[] = [
    {
      key: 'search',
      type: 'search',
      placeholder: 'Search by code or title...',
    },
    {
      key: 'applicable',
      type: 'select',
      placeholder: 'Filter by Applicability',
      options: [
        { value: 'true', label: 'Applicable' },
        { value: 'false', label: 'Not Applicable' },
      ],
    },
    {
      key: 'category',
      type: 'select',
      placeholder: 'Filter by Category',
      options: [
        { value: 'ORGANIZATIONAL', label: 'Organizational' },
        { value: 'PEOPLE', label: 'People' },
        { value: 'PHYSICAL', label: 'Physical' },
        { value: 'TECHNOLOGICAL', label: 'Technological' },
      ],
    },
    {
      key: 'implemented',
      type: 'select',
      placeholder: 'Filter by Implemented',
      options: [
        { value: 'true', label: 'Implemented' },
        { value: 'false', label: 'Not Implemented' },
      ],
    },
  ];

  const actions: ActionButton<Control>[] = [
    {
      icon: <ViewIcon />,
      label: 'View',
      onClick: handleEdit,
      colorScheme: 'blue',
      isVisible: (control) => control.isStandardControl,
    },
    {
      icon: <EditIcon />,
      label: 'Edit',
      onClick: handleEdit,
      colorScheme: 'blue',
      isVisible: (control) => !control.isStandardControl,
    },
    {
      icon: <DeleteIcon />,
      label: 'Delete',
      onClick: handleDelete,
      colorScheme: 'red',
      isVisible: (control) => !control.isStandardControl,
    },
  ];

  const paginationConfig: PaginationConfig = {
    mode: 'client',
    page: page,
    pageSize: pageSize,
    onPageChange: setPage,
    onPageSizeChange: (newSize) => {
      setPageSize(newSize);
      setPage(1);
    },
  };

  const sortConfig: SortConfig = {
    field: sortField,
    direction: sortOrder,
    onSort: handleSort,
  };

  const csvExportConfig: CSVExportConfig = {
    enabled: true,
    filename: `controls_export_${new Date().toISOString().split('T')[0]}.csv`,
    headers: [
      'Code',
      'Title',
      'Category',
      'Type',
      'Selected',
      'Risk Assessment',
      'Contractual Obligation',
      'Legal Requirement',
      'Business Requirement',
      'Justification',
      'Linked Risks',
      'Linked Documents',
    ],
    getRowData: (control) => {
      const isSelected =
        control.selectedForRiskAssessment ||
        control.selectedForContractualObligation ||
        control.selectedForLegalRequirement ||
        control.selectedForBusinessRequirement;
      return [
        control.code,
        control.title,
        formatCategory(control.category),
        control.isStandardControl ? 'Standard' : 'Custom',
        formatBoolean(isSelected),
        formatBoolean(control.selectedForRiskAssessment),
        formatBoolean(control.selectedForContractualObligation),
        formatBoolean(control.selectedForLegalRequirement),
        formatBoolean(control.selectedForBusinessRequirement),
        control.justification || '',
        control.riskControls.length,
        control.documentControls.length,
      ];
    },
    onExport: () => {
      const filtered = getFilteredAndSortedControls();
      toast({
        title: 'Export successful',
        description: `Exported ${filtered.length} controls to CSV`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
  };

  const exportToCSV = () => {
    if (!csvExportConfig) return;
    
    const filtered = getFilteredAndSortedControls();
    const rows = filtered.map(csvExportConfig.getRowData);
    generateCSV(csvExportConfig.headers, rows, csvExportConfig.filename);
    
    if (csvExportConfig.onExport) {
      csvExportConfig.onExport();
    }
  };

  const filteredData = getFilteredAndSortedControls();

  const renderRow = (control: Control, index: number) => {
    return (
      <Tr
        key={control.id}
        bg={!control.isStandardControl ? 'blue.50' : undefined}
        _hover={{ bg: !control.isStandardControl ? 'blue.100' : 'gray.50', opacity: 0.9, cursor: 'pointer' }}
        cursor="pointer"
        onClick={() => handleEdit(control)}
      >
        <Td onClick={(e) => e.stopPropagation()}>
          <Checkbox
            isChecked={selectedControlIds.has(control.id)}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectControl(control.id, e.target.checked);
            }}
          />
        </Td>
        {columns.map((column) => {
          let cellContent: React.ReactNode;
          if (column.render) {
            cellContent = column.render(control);
          } else {
            const value = (control as any)[column.key];
            cellContent = value === null || value === undefined || value === '' 
              ? <Text color="gray.400" fontSize="xs">—</Text>
              : String(value);
          }
          return <Td key={column.key}>{cellContent}</Td>;
        })}
        <Td onClick={(e) => e.stopPropagation()}>
          <HStack spacing={2}>
            {actions.map((action, idx) => {
              if (action.isVisible && !action.isVisible(control)) return null;
              return (
                <Tooltip key={idx} label={action.label}>
                  <IconButton
                    aria-label={action.label}
                    icon={action.icon}
                    size="sm"
                    colorScheme={action.colorScheme || 'blue'}
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(control);
                    }}
                  />
                </Tooltip>
              );
            })}
          </HStack>
        </Td>
      </Tr>
    );
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Controls</Heading>
        <HStack>
          <Button
            leftIcon={<DownloadIcon />}
            colorScheme="blue"
            variant="outline"
            onClick={exportToCSV}
          >
            Export CSV
          </Button>
          <Button colorScheme="blue" onClick={handleCreate}>
            Create Control
          </Button>
        </HStack>
      </HStack>

      <DataTable
        title=""
        data={filteredData}
        columns={columns}
        loading={loading}
        emptyMessage="No controls found"
        filters={filterConfigs}
        filterValues={{
          search: searchQuery,
          applicable: filterApplicable,
          category: filterCategory,
          implemented: filterImplemented,
        }}
        onFilterChange={(key, value) => {
          if (key === 'search') {
            setSearchQuery(value);
          } else if (key === 'applicable') {
            setFilterApplicable(value);
          } else if (key === 'category') {
            setFilterCategory(value);
          } else if (key === 'implemented') {
            setFilterImplemented(value);
          }
          setPage(1);
        }}
        onClearFilters={() => {
          setFilterApplicable('');
          setFilterCategory('');
          setFilterImplemented('');
          setSearchQuery('');
          setPage(1);
        }}
        showFiltersHeading={true}
        sortConfig={sortConfig}
        enableSelection={true}
        selectedIds={selectedControlIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectControl}
        getRowId={(control) => control.id}
        pagination={paginationConfig}
        actions={actions}
        csvExport={csvExportConfig}
        onRowClick={handleEdit}
        renderRow={renderRow}
      />

      <ControlFormModal
        isOpen={isOpen}
        onClose={handleClose}
        control={selectedControl}
      />
    </VStack>
  );
}
