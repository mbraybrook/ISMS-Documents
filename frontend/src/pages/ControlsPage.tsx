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
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, DownloadIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { ControlFormModal } from '../components/ControlFormModal';

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
  riskControls: Array<{
    risk: {
      id: string;
      title: string;
      externalId: string | null;
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
  const [filteredControls, setFilteredControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApplicable, setFilterApplicable] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
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
  }, [filterApplicable, filterCategory]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [controls, searchQuery, sortField, sortOrder, page, pageSize]);

  const fetchControls = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: 1,
        limit: 10000, // Get all controls for client-side filtering/sorting
      };
      if (filterApplicable !== '') {
        params.isApplicable = filterApplicable === 'true';
      }
      if (filterCategory !== '') {
        params.category = filterCategory;
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

  const applyFiltersAndSort = () => {
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

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    filtered = filtered.slice(startIndex, endIndex);

    setFilteredControls(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedControlIds(new Set(filteredControls.map((c) => c.id)));
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

  const exportToCSV = () => {
    const allFiltered = controls.filter((control) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          control.code.toLowerCase().includes(query) ||
          control.title.toLowerCase().includes(query)
        );
      }
      return true;
    });

    const headers = [
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
    ];

    const rows = allFiltered.map((control) => {
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
        isSelected ? 'Yes' : 'No',
        control.selectedForRiskAssessment ? 'Yes' : 'No',
        control.selectedForContractualObligation ? 'Yes' : 'No',
        control.selectedForLegalRequirement ? 'Yes' : 'No',
        control.selectedForBusinessRequirement ? 'Yes' : 'No',
        control.justification || '',
        control.riskControls.length,
        control.documentControls.length,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `controls_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export successful',
      description: `Exported ${allFiltered.length} controls to CSV`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const totalFiltered = controls.filter((control) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        control.code.toLowerCase().includes(query) ||
        control.title.toLowerCase().includes(query)
      );
    }
    return true;
  }).length;

  const totalPages = Math.ceil(totalFiltered / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);

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

      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <VStack spacing={4} align="stretch" mb={4}>
          <HStack>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search by code or title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </InputGroup>
            <Select
              placeholder="Filter by Applicability"
              value={filterApplicable}
              onChange={(e) => {
                setFilterApplicable(e.target.value);
                setPage(1);
              }}
              maxW="200px"
            >
              <option value="true">Applicable</option>
              <option value="false">Not Applicable</option>
            </Select>
            <Select
              placeholder="Filter by Category"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              maxW="200px"
            >
              <option value="ORGANIZATIONAL">Organizational</option>
              <option value="PEOPLE">People</option>
              <option value="PHYSICAL">Physical</option>
              <option value="TECHNOLOGICAL">Technological</option>
            </Select>
            <Button
              size="sm"
              onClick={() => {
                setFilterApplicable('');
                setFilterCategory('');
                setSearchQuery('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </HStack>
        </VStack>

        {loading ? (
          <Box p={8} textAlign="center">
            Loading...
          </Box>
        ) : (
          <>
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={
                          filteredControls.length > 0 &&
                          filteredControls.every((c) => selectedControlIds.has(c.id))
                        }
                        isIndeterminate={
                          filteredControls.some((c) => selectedControlIds.has(c.id)) &&
                          !filteredControls.every((c) => selectedControlIds.has(c.id))
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </Th>
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('code')}
                      _hover={{ bg: 'gray.50' }}
                    >
                      <HStack spacing={2}>
                        <Text>Code</Text>
                        <SortIcon field="code" />
                      </HStack>
                    </Th>
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('title')}
                      _hover={{ bg: 'gray.50' }}
                    >
                      <HStack spacing={2}>
                        <Text>Title</Text>
                        <SortIcon field="title" />
                      </HStack>
                    </Th>
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('category')}
                      _hover={{ bg: 'gray.50' }}
                    >
                      <HStack spacing={2}>
                        <Text>Category</Text>
                        <SortIcon field="category" />
                      </HStack>
                    </Th>
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('type')}
                      _hover={{ bg: 'gray.50' }}
                    >
                      <HStack spacing={2}>
                        <Text>Type</Text>
                        <SortIcon field="type" />
                      </HStack>
                    </Th>
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('selected')}
                      _hover={{ bg: 'gray.50' }}
                    >
                      <HStack spacing={2}>
                        <Text>Selected</Text>
                        <SortIcon field="selected" />
                      </HStack>
                    </Th>
                    <Th>Selection Reasons</Th>
                    <Th>Linked Risks</Th>
                    <Th>Linked Documents</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredControls.length === 0 ? (
                    <Tr>
                      <Td colSpan={10} textAlign="center" py={8}>
                        No controls found
                      </Td>
                    </Tr>
                  ) : (
                    filteredControls.map((control) => {
                      const isSelected = 
                        control.selectedForRiskAssessment ||
                        control.selectedForContractualObligation ||
                        control.selectedForLegalRequirement ||
                        control.selectedForBusinessRequirement;
                      
                      const reasons: string[] = [];
                      if (control.selectedForRiskAssessment) reasons.push('Risk Assessment');
                      if (control.selectedForContractualObligation) reasons.push('Contractual');
                      if (control.selectedForLegalRequirement) reasons.push('Legal');
                      if (control.selectedForBusinessRequirement) reasons.push('Business');

                      return (
                        <Tr
                          key={control.id}
                          bg={!control.isStandardControl ? 'blue.50' : undefined}
                          _hover={{ bg: !control.isStandardControl ? 'blue.100' : 'gray.50' }}
                        >
                          <Td>
                            <Checkbox
                              isChecked={selectedControlIds.has(control.id)}
                              onChange={(e) => handleSelectControl(control.id, e.target.checked)}
                            />
                          </Td>
                          <Td fontWeight="medium">{control.code}</Td>
                          <Td>
                            <Tooltip label={control.title} isDisabled={control.title.length < 50}>
                              <Text
                                noOfLines={2}
                                maxW="300px"
                                title={control.title}
                              >
                                {control.title}
                              </Text>
                            </Tooltip>
                          </Td>
                          <Td>
                            {control.category && (
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
                            )}
                          </Td>
                          <Td>
                            {control.isStandardControl ? (
                              <Badge colorScheme="green">Standard</Badge>
                            ) : (
                              <Badge colorScheme="orange">Custom</Badge>
                            )}
                          </Td>
                          <Td>
                            <Badge colorScheme={isSelected ? 'green' : 'gray'}>
                              {isSelected ? 'Yes' : 'No'}
                            </Badge>
                          </Td>
                          <Td>
                            {reasons.length > 0 ? (
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
                              <Badge colorScheme="gray" fontSize="xs">
                                None
                              </Badge>
                            )}
                          </Td>
                          <Td>{control.riskControls.length}</Td>
                          <Td>{control.documentControls.length}</Td>
                          <Td>
                            <Button size="sm" onClick={() => handleEdit(control)}>
                              {control.isStandardControl ? 'View' : 'Edit'}
                            </Button>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </Tbody>
              </Table>
            </Box>

            {totalFiltered > 0 && (
              <HStack justify="space-between" mt={4}>
                <Text fontSize="sm" color="gray.600">
                  Showing {startIndex + 1} to {endIndex} of {totalFiltered} controls
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    isDisabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Text fontSize="sm">
                    Page {page} of {totalPages}
                  </Text>
                  <Button
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    isDisabled={page >= totalPages}
                  >
                    Next
                  </Button>
                  <Select
                    size="sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    maxW="100px"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Select>
                </HStack>
              </HStack>
            )}
          </>
        )}
      </Box>

      <ControlFormModal
        isOpen={isOpen}
        onClose={handleClose}
        control={selectedControl}
      />
    </VStack>
  );
}
