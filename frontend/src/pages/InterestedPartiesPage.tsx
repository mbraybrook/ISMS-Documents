import { useState, useEffect, useRef } from 'react';
import React from 'react';
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
  useDisclosure,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  IconButton,
  Tooltip,
  useToast,
  Badge,
  Spinner,
  Center,
  CloseButton,
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
  Textarea,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure as useAlertDisclosure,
  Select,
  Checkbox,
  Link,
  Collapse,
  SimpleGrid,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Flex,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, ChevronDownIcon, ChevronUpIcon, HamburgerIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { generateCSV } from '../utils/tableUtils';

interface InterestedParty {
  id: string;
  name: string;
  group: string | null;
  description: string | null;
  dateAdded: string | null;
  requirements: string | null;
  addressedThroughISMS: boolean | null;
  howAddressedThroughISMS: string | null;
  sourceLink: string | null;
  keyProductsServices: string | null;
  ourObligations: string | null;
  theirObligations: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    risks: number;
  };
}

const INTERESTED_PARTY_GROUPS = [
  'Suppliers',
  'Clients',
  'Internal',
  'Regulatory Body',
];

export function InterestedPartiesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [interestedParties, setInterestedParties] = useState<InterestedParty[]>([]);
  const [filteredParties, setFilteredParties] = useState<InterestedParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useAlertDisclosure();
  const [selectedParty, setSelectedParty] = useState<InterestedParty | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<InterestedParty | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [partyForRiskManagement, setPartyForRiskManagement] = useState<InterestedParty | null>(null);
  const [allRisks, setAllRisks] = useState<any[]>([]);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    description: '',
    dateAdded: '',
    requirements: '',
    addressedThroughISMS: false,
    howAddressedThroughISMS: '',
    sourceLink: '',
    keyProductsServices: '',
    ourObligations: '',
    theirObligations: '',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  useEffect(() => {
    fetchInterestedParties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [interestedParties, searchQuery, sortConfig, selectedGroupFilter]);

  const _expandAllRows = () => {
    setExpandedRows(new Set(filteredParties.map(p => p.id)));
  };

  const _collapseAllRows = () => {
    setExpandedRows(new Set());
  };

  const toggleSelectParty = (partyId: string) => {
    setSelectedParties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partyId)) {
        newSet.delete(partyId);
      } else {
        newSet.add(partyId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    setSelectedParties(new Set(filteredParties.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedParties(new Set());
  };

  const fetchRisksForParty = async (partyId: string) => {
    try {
      // Fetch all risks
      const response = await api.get('/api/risks?limit=1000&page=1&archived=false');
      const allRisksData = response.data.data || response.data.risks || [];
      setAllRisks(allRisksData);

      // Fetch risks currently linked to this party
      const partyRisks = allRisksData.filter((risk: any) => risk.interestedPartyId === partyId);
      setSelectedRiskIds(new Set(partyRisks.map((r: any) => r.id)));
    } catch (error) {
      console.error('Error fetching risks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load risks',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSaveRiskAssociations = async () => {
    if (!partyForRiskManagement) return;

    try {
      // Update each risk's interestedPartyId
      const riskUpdates = Array.from(selectedRiskIds).map(async (riskId) => {
        await api.put(`/api/risks/${riskId}`, {
          interestedPartyId: partyForRiskManagement.id,
        });
      });

      // Remove association from risks that were deselected
      const currentPartyRisks = allRisks.filter((r: any) => r.interestedPartyId === partyForRiskManagement.id);
      const _toRemove = currentPartyRisks.filter((r: any) => !selectedRiskIds.has(r.id));

      // Note: We can't set interestedPartyId to null as it's required
      // Instead, we'd need a default "Unassigned" party or handle this differently
      // For now, we'll just update the selected ones

      await Promise.all(riskUpdates);

      toast({
        title: 'Success',
        description: 'Risk associations updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setIsRiskModalOpen(false);
      setPartyForRiskManagement(null);
      fetchInterestedParties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update risk associations',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const fetchInterestedParties = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/interested-parties');
      setInterestedParties(response.data);
    } catch (error) {
      console.error('Error fetching interested parties:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch interested parties',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...interestedParties];

    // Apply group filter
    if (selectedGroupFilter) {
      filtered = filtered.filter((party) => party.group === selectedGroupFilter);
    }

    if (searchQuery.trim()) {
      // Use word-boundary matching for better search results
      const queryWords = searchQuery.toLowerCase().trim().split(/\s+/);
      filtered = filtered.filter((party) => {
        const searchableText = [
          party.name,
          party.group,
          party.description,
          party.requirements,
          party.howAddressedThroughISMS,
          party.keyProductsServices,
          party.ourObligations,
          party.theirObligations,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        // All query words must appear in the searchable text
        return queryWords.every((word) => {
          // Check for whole word matches or word starts
          const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          return wordRegex.test(searchableText);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortConfig.field) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'group':
            aVal = (a.group || '').toLowerCase();
            bVal = (b.group || '').toLowerCase();
            break;
          case 'risks':
            aVal = a._count?.risks || 0;
            bVal = b._count?.risks || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredParties(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: string) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const toggleRowExpansion = (partyId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(partyId)) {
      newExpanded.delete(partyId);
    } else {
      newExpanded.add(partyId);
    }
    setExpandedRows(newExpanded);
  };

  const handleCreate = () => {
    setSelectedParty(null);
    // Auto-populate dateAdded with today's date
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      name: '',
      group: '',
      description: '',
      dateAdded: today,
      requirements: '',
      addressedThroughISMS: false,
      howAddressedThroughISMS: '',
      sourceLink: '',
      keyProductsServices: '',
      ourObligations: '',
      theirObligations: '',
    });
    setFormErrors({});
    setCheckingDuplicate(false);
    onOpen();
  };

  const handleDuplicate = (party: InterestedParty) => {
    setSelectedParty(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      name: `${party.name} (Copy)`,
      group: party.group || '',
      description: party.description || '',
      dateAdded: today, // Use today's date for duplicate
      requirements: party.requirements || '',
      addressedThroughISMS: party.addressedThroughISMS || false,
      howAddressedThroughISMS: party.howAddressedThroughISMS || '',
      sourceLink: party.sourceLink || '',
      keyProductsServices: party.keyProductsServices || '',
      ourObligations: party.ourObligations || '',
      theirObligations: party.theirObligations || '',
    });
    setFormErrors({});
    setCheckingDuplicate(false);
    onOpen();
  };

  const handleEdit = (party: InterestedParty) => {
    setSelectedParty(party);
    setFormData({
      name: party.name,
      group: party.group || '',
      description: party.description || '',
      dateAdded: party.dateAdded ? new Date(party.dateAdded).toISOString().split('T')[0] : '',
      requirements: party.requirements || '',
      addressedThroughISMS: party.addressedThroughISMS === true, // Explicitly check for true
      howAddressedThroughISMS: party.howAddressedThroughISMS || '',
      sourceLink: party.sourceLink || '',
      keyProductsServices: party.keyProductsServices || '',
      ourObligations: party.ourObligations || '',
      theirObligations: party.theirObligations || '',
    });
    onOpen();
  };

  const handleDelete = (party: InterestedParty) => {
    setPartyToDelete(party);
    onDeleteOpen();
  };

  const confirmBulkDelete = async () => {
    if (selectedParties.size === 0) return;

    try {
      const deletePromises = Array.from(selectedParties).map((partyId) =>
        api.delete(`/api/interested-parties/${partyId}`)
      );
      await Promise.all(deletePromises);

      const deletedCount = selectedParties.size;
      toast({
        title: 'Success',
        description: `${deletedCount} interested part${deletedCount !== 1 ? 'ies' : 'y'} deleted successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onBulkDeleteClose();
      setSelectedParties(new Set());
      fetchInterestedParties();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete interested parties';
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
    const selectedPartiesList = filteredParties.filter(p => selectedParties.has(p.id));

    const headers = [
      'Name',
      'Group',
      'Description',
      'Date Added',
      'Requirements',
      'Addressed Through ISMS',
      'How Addressed Through ISMS',
      'Source Link',
      'Key Products/Services',
      'Our Obligations',
      'Their Obligations',
    ];

    const rows = selectedPartiesList.map((party) => [
      party.name,
      party.group || '',
      party.description || '',
      party.dateAdded ? new Date(party.dateAdded).toISOString().split('T')[0] : '',
      party.requirements || '',
      party.addressedThroughISMS ? 'Yes' : 'No',
      party.howAddressedThroughISMS || '',
      party.sourceLink || '',
      party.keyProductsServices || '',
      party.ourObligations || '',
      party.theirObligations || '',
    ]);

    generateCSV(headers, rows, `selected_interested_parties_${new Date().toISOString().split('T')[0]}.csv`);
    toast({
      title: 'Export Successful',
      description: `Exported ${selectedPartiesList.length} selected interested part${selectedPartiesList.length !== 1 ? 'ies' : 'y'} to CSV`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const validateURL = (url: string): boolean => {
    if (!url.trim() || url.trim().toUpperCase() === 'N/A' || url.trim().toUpperCase() === 'NA') {
      return true; // Allow empty or N/A
    }
    try {
      // Auto-prepend https:// if no protocol
      let urlToValidate = url.trim();
      if (!urlToValidate.match(/^https?:\/\//i)) {
        urlToValidate = `https://${urlToValidate}`;
      }
      new URL(urlToValidate);
      return true;
    } catch {
      return false;
    }
  };

  const formatURL = (url: string): string => {
    if (!url.trim() || url.trim().toUpperCase() === 'N/A' || url.trim().toUpperCase() === 'NA') {
      return '';
    }
    let formatted = url.trim();
    if (!formatted.match(/^https?:\/\//i)) {
      formatted = `https://${formatted}`;
    }
    return formatted;
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Name is required';
    }
    // Check for generic placeholder names
    const genericNames = ['all', 'all stakeholders', 'clients', 'employees', 'board'];
    if (genericNames.includes(name.toLowerCase().trim())) {
      return 'Please use a specific organization or individual name, not a generic category';
    }
    // Encourage full names with acronyms in parentheses
    if (name.length < 3) {
      return 'Name should be at least 3 characters long';
    }
    return null;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const nameError = validateName(formData.name);
    if (nameError) {
      errors.name = nameError;
    }

    if (formData.sourceLink && !validateURL(formData.sourceLink)) {
      errors.sourceLink = 'Please enter a valid URL (e.g., https://example.com) or "N/A"';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkDuplicateName = async (name: string, excludeId?: string): Promise<boolean> => {
    if (!name.trim()) return false;

    try {
      const response = await api.get('/api/interested-parties');
      const parties = response.data;
      return parties.some((party: InterestedParty) =>
        party.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        party.id !== excludeId
      );
    } catch {
      return false;
    }
  };

  const handleNameChange = async (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));

    // Clear previous error
    if (formErrors.name) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      });
    }

    // Check for duplicates (debounced)
    if (value.trim() && (!selectedParty || value.trim().toLowerCase() !== selectedParty.name.toLowerCase())) {
      setCheckingDuplicate(true);
      const isDuplicate = await checkDuplicateName(value, selectedParty?.id);
      setCheckingDuplicate(false);

      if (isDuplicate) {
        setFormErrors(prev => ({
          ...prev,
          name: 'An interested party with this name already exists',
        }));
      }
    }
  };

  const handleSave = async () => {
    // Validate form
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before saving',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const payload: any = {
        name: formData.name.trim(),
      };

      // Only include optional fields if they have values
      if (formData.group && formData.group.trim()) {
        payload.group = formData.group.trim();
      }
      if (formData.description && formData.description.trim()) {
        payload.description = formData.description.trim();
      }
      if (formData.dateAdded) {
        payload.dateAdded = new Date(formData.dateAdded).toISOString();
      }
      if (formData.requirements && formData.requirements.trim()) {
        payload.requirements = formData.requirements.trim();
      }
      // Always include addressedThroughISMS, even if false
      payload.addressedThroughISMS = formData.addressedThroughISMS === true;
      if (formData.howAddressedThroughISMS && formData.howAddressedThroughISMS.trim()) {
        payload.howAddressedThroughISMS = formData.howAddressedThroughISMS.trim();
      }
      if (formData.sourceLink && formData.sourceLink.trim()) {
        // Format URL (prepend https:// if needed, handle N/A)
        const upperSourceLink = formData.sourceLink.trim().toUpperCase();
        if (upperSourceLink === 'N/A' || upperSourceLink === 'NA') {
          payload.sourceLink = null;
        } else {
          payload.sourceLink = formatURL(formData.sourceLink);
        }
      }
      if (formData.keyProductsServices && formData.keyProductsServices.trim()) {
        payload.keyProductsServices = formData.keyProductsServices.trim();
      }
      if (formData.ourObligations && formData.ourObligations.trim()) {
        payload.ourObligations = formData.ourObligations.trim();
      }
      if (formData.theirObligations && formData.theirObligations.trim()) {
        payload.theirObligations = formData.theirObligations.trim();
      }

      if (selectedParty) {
        await api.put(`/api/interested-parties/${selectedParty.id}`, payload);
        toast({
          title: 'Success',
          description: 'Interested party updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/interested-parties', payload);
        toast({
          title: 'Success',
          description: 'Interested party created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      onClose();
      setFormErrors({});
      setCheckingDuplicate(false);
      fetchInterestedParties();
    } catch (error: any) {
      let errorMessage = 'Failed to save interested party';
      const errorData = error.response?.data;

      if (errorData?.errors && Array.isArray(errorData.errors)) {
        // Handle validation errors
        const validationErrors = errorData.errors.map((err: any) => err.msg || err.message).join(', ');
        errorMessage = validationErrors;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
        // Provide more specific messages for common errors
        if (errorMessage.includes('already exists')) {
          errorMessage = 'An interested party with this name already exists. Please choose a different name.';
        } else if (errorMessage.includes('required') || errorMessage.includes('empty')) {
          errorMessage = 'Name is required. Please enter a name for the interested party.';
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!partyToDelete) return;

    try {
      await api.delete(`/api/interested-parties/${partyToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Interested party deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      setPartyToDelete(null);
      fetchInterestedParties();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete interested party';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getGroupColor = (group: string | null): string => {
    if (!group) return 'gray';
    switch (group) {
      case 'Suppliers':
        return 'blue'; // External
      case 'Clients':
        return 'green'; // Revenue
      case 'Internal':
        return 'purple'; // Team
      case 'Regulatory Body':
        return 'red'; // Compliance (changed from orange for better semantic meaning)
      default:
        return 'gray';
    }
  };

  const getRiskBadgeColor = (count: number): string => {
    if (count === 0) return 'green';
    if (count <= 3) return 'yellow';
    return 'red';
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Interested Parties</Heading>
        {canEdit && (
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreate}>
            Create Interested Party
          </Button>
        )}
      </HStack>

      <InputGroup size="md">
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.400" />
        </InputLeftElement>
        <Input
          placeholder="Search interested parties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchQuery('');
            }
          }}
          h="42px"
        />
        {searchQuery && (
          <InputRightElement>
            <CloseButton
              size="sm"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            />
          </InputRightElement>
        )}
      </InputGroup>

      {loading ? (
        <Center py={8}>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <Text color="gray.600">Loading interested parties...</Text>
          </VStack>
        </Center>
      ) : (
        <>
          {selectedParties.size > 0 && (
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
                {selectedParties.size} interested part{selectedParties.size !== 1 ? 'ies' : 'y'} selected
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
                  onClick={() => setSelectedParties(new Set())}
                >
                  Clear Selection
                </Button>
              </HStack>
            </Box>
          )}
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th w="40px">
                    <Checkbox
                      isChecked={selectedParties.size > 0 && selectedParties.size === filteredParties.length}
                      isIndeterminate={selectedParties.size > 0 && selectedParties.size < filteredParties.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllVisible();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </Th>
                  <Th w="40px"></Th>
                  <Th
                    cursor="pointer"
                    userSelect="none"
                    onClick={() => handleSort('name')}
                    _hover={{ bg: 'gray.100' }}
                  >
                    <HStack spacing={1}>
                      <Text>Name</Text>
                      {sortConfig?.field === 'name' && (
                        <Text>{sortConfig.direction === 'asc' ? '▲' : '▼'}</Text>
                      )}
                    </HStack>
                  </Th>
                  <Th
                    cursor="pointer"
                    userSelect="none"
                    onClick={() => handleSort('group')}
                    _hover={{ bg: 'gray.100' }}
                  >
                    <HStack spacing={1}>
                      <Text>Group</Text>
                      {sortConfig?.field === 'group' && (
                        <Text>{sortConfig.direction === 'asc' ? '▲' : '▼'}</Text>
                      )}
                    </HStack>
                  </Th>
                  <Th
                    cursor="pointer"
                    userSelect="none"
                    onClick={() => handleSort('risks')}
                    _hover={{ bg: 'gray.100' }}
                  >
                    <HStack spacing={1}>
                      <Text>Risks</Text>
                      {sortConfig?.field === 'risks' && (
                        <Text>{sortConfig.direction === 'asc' ? '▲' : '▼'}</Text>
                      )}
                    </HStack>
                  </Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedParties = filteredParties.slice(startIndex, endIndex);
                  const totalPages = Math.ceil(filteredParties.length / itemsPerPage);

                  if (filteredParties.length === 0) {
                    return (
                      <Tr>
                        <Td colSpan={6} textAlign="center" py={12}>
                          <VStack spacing={4}>
                            <Text color="gray.500" fontSize="lg" fontWeight="medium">
                              {searchQuery || selectedGroupFilter
                                ? `No interested parties found${searchQuery ? ` matching '${searchQuery}'` : ''}${selectedGroupFilter ? ` in ${selectedGroupFilter}` : ''}`
                                : 'No interested parties yet'}
                            </Text>
                            {(searchQuery || selectedGroupFilter) && (
                              <HStack spacing={2}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setSelectedGroupFilter(null);
                                  }}
                                >
                                  Clear Filters
                                </Button>
                              </HStack>
                            )}
                            {!searchQuery && !selectedGroupFilter && canEdit && (
                              <Button
                                size="sm"
                                colorScheme="blue"
                                leftIcon={<AddIcon />}
                                onClick={handleCreate}
                              >
                                Create Your First Interested Party
                              </Button>
                            )}
                          </VStack>
                        </Td>
                      </Tr>
                    );
                  }

                  return (
                    <>
                      {paginatedParties.map((party) => {
                        const isExpanded = expandedRows.has(party.id);
                        return (
                          <React.Fragment key={party.id}>
                            <Tr
                              transition="background-color 0.2s"
                              borderLeft="3px solid"
                              borderLeftColor="transparent"
                              _hover={{ borderLeftColor: 'blue.500', bg: 'blue.50' }}
                            >
                              <Td>
                                <Checkbox
                                  isChecked={selectedParties.has(party.id)}
                                  onChange={() => toggleSelectParty(party.id)}
                                />
                              </Td>
                              <Td>
                                <IconButton
                                  aria-label={isExpanded ? `Collapse details for ${party.name}` : `Expand details for ${party.name}`}
                                  icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => toggleRowExpansion(party.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      toggleRowExpansion(party.id);
                                    }
                                  }}
                                />
                              </Td>
                              <Td>
                                <Text
                                  fontWeight="medium"
                                  cursor="pointer"
                                  onClick={() => toggleRowExpansion(party.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      toggleRowExpansion(party.id);
                                    }
                                  }}
                                  tabIndex={0}
                                  _hover={{ color: 'blue.600', textDecoration: 'underline' }}
                                >
                                  {party.name}
                                </Text>
                              </Td>
                              <Td>
                                {party.group ? (
                                  <Badge colorScheme={getGroupColor(party.group)}>{party.group}</Badge>
                                ) : (
                                  <Text color="gray.400">—</Text>
                                )}
                              </Td>
                              <Td>
                                <Tooltip
                                  label={`${party._count?.risks || 0} associated risk${(party._count?.risks || 0) !== 1 ? 's' : ''}. Click to view.`}
                                  hasArrow
                                >
                                  <Link
                                    as={RouterLink}
                                    to="/admin/risks/risks"
                                    onClick={() => {
                                      sessionStorage.setItem('filterInterestedPartyId', party.id);
                                    }}
                                  >
                                    <Badge
                                      colorScheme={getRiskBadgeColor(party._count?.risks || 0)}
                                      cursor="pointer"
                                      _hover={{ transform: 'scale(1.1)' }}
                                      transition="transform 0.2s"
                                    >
                                      {party._count?.risks || 0}
                                    </Badge>
                                  </Link>
                                </Tooltip>
                              </Td>
                              <Td>
                                {canEdit && (
                                  <Menu>
                                    <MenuButton
                                      as={IconButton}
                                      icon={<HamburgerIcon />}
                                      variant="ghost"
                                      size="sm"
                                      aria-label={`Actions for ${party.name}`}
                                    />
                                    <MenuList>
                                      <MenuItem
                                        icon={<EditIcon />}
                                        onClick={() => handleEdit(party)}
                                        aria-label={`Edit ${party.name}`}
                                      >
                                        Edit
                                      </MenuItem>
                                      <MenuItem
                                        icon={<AddIcon />}
                                        onClick={() => handleDuplicate(party)}
                                        aria-label={`Duplicate ${party.name}`}
                                      >
                                        Duplicate
                                      </MenuItem>
                                      <MenuItem
                                        icon={<DeleteIcon />}
                                        onClick={() => handleDelete(party)}
                                        aria-label={`Delete ${party.name}`}
                                        color="red.500"
                                      >
                                        Delete
                                      </MenuItem>
                                    </MenuList>
                                  </Menu>
                                )}
                              </Td>
                            </Tr>
                            <Tr>
                              <Td colSpan={6} p={0}>
                                <Collapse in={isExpanded} animateOpacity>
                                  <Box p={4} bg="gray.50" borderTop="1px solid" borderColor="gray.200" borderLeft="3px solid" borderLeftColor="blue.500">
                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                      {party.dateAdded && (
                                        <Box>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            Partnership Start Date
                                          </Text>
                                          <Text fontSize="sm" color="gray.900">
                                            {new Date(party.dateAdded).toLocaleDateString()}
                                          </Text>
                                        </Box>
                                      )}
                                      <Box>
                                        <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                          Created
                                        </Text>
                                        <Text fontSize="sm" color="gray.900">
                                          {new Date(party.createdAt).toLocaleString()}
                                        </Text>
                                      </Box>
                                      <Box>
                                        <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                          Last Modified
                                        </Text>
                                        <Text fontSize="sm" color="gray.900">
                                          {new Date(party.updatedAt).toLocaleString()}
                                        </Text>
                                      </Box>
                                      {party.requirements && (
                                        <Box>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            Requirements
                                          </Text>
                                          <Text fontSize="sm" color="gray.900" whiteSpace="pre-wrap">
                                            {party.requirements}
                                          </Text>
                                        </Box>
                                      )}
                                      {party.addressedThroughISMS !== null && (
                                        <Box>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            Addressed Through ISMS
                                          </Text>
                                          <Text fontSize="sm" color="gray.900">
                                            {party.addressedThroughISMS ? 'Yes' : 'No'}
                                          </Text>
                                        </Box>
                                      )}
                                      {party.howAddressedThroughISMS && (
                                        <Box gridColumn={{ base: 1, md: 'span 2' }}>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            How Addressed Through ISMS
                                          </Text>
                                          <Text fontSize="sm" color="gray.900" whiteSpace="pre-wrap">
                                            {party.howAddressedThroughISMS}
                                          </Text>
                                        </Box>
                                      )}
                                      {party.sourceLink && (
                                        <Box>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            Source/Link
                                          </Text>
                                          <Link href={party.sourceLink} isExternal color="blue.500" fontSize="sm">
                                            {party.sourceLink} <ExternalLinkIcon mx={1} />
                                          </Link>
                                        </Box>
                                      )}
                                      {party.keyProductsServices && (
                                        <Box>
                                          <Text fontWeight="semibold" fontSize="xs" color="gray.600" mb={1} textTransform="uppercase" letterSpacing="wide">
                                            Key Products / Services
                                          </Text>
                                          <Text fontSize="sm" color="gray.900" whiteSpace="pre-wrap">
                                            {party.keyProductsServices}
                                          </Text>
                                        </Box>
                                      )}
                                      {party.ourObligations && (
                                        <Box gridColumn={{ base: 1, md: 'span 2' }}>
                                          <Text fontWeight="bold" fontSize="sm" color="gray.700" mb={2}>
                                            Our Obligations
                                          </Text>
                                          <Text fontSize="sm" color="gray.900" whiteSpace="pre-wrap">
                                            {party.ourObligations}
                                          </Text>
                                        </Box>
                                      )}
                                      {party.theirObligations && (
                                        <Box gridColumn={{ base: 1, md: 'span 2' }}>
                                          <Text fontWeight="bold" fontSize="sm" color="gray.700" mb={2}>
                                            Their Obligations
                                          </Text>
                                          <Text fontSize="sm" color="gray.900" whiteSpace="pre-wrap">
                                            {party.theirObligations}
                                          </Text>
                                        </Box>
                                      )}
                                      {canEdit && (
                                        <Box gridColumn={{ base: 1, md: 'span 2' }} pt={2}>
                                          <Button
                                            size="sm"
                                            colorScheme="blue"
                                            variant="outline"
                                            leftIcon={<ExternalLinkIcon />}
                                            onClick={() => {
                                              setPartyForRiskManagement(party);
                                              setIsRiskModalOpen(true);
                                              fetchRisksForParty(party.id);
                                            }}
                                          >
                                            Manage Associated Risks ({party._count?.risks || 0})
                                          </Button>
                                        </Box>
                                      )}
                                    </SimpleGrid>
                                  </Box>
                                </Collapse>
                              </Td>
                            </Tr>
                          </React.Fragment>
                        );
                      })}
                      {totalPages > 1 && (
                        <Tr>
                          <Td colSpan={7}>
                            <Flex justify="space-between" align="center" p={4}>
                              <HStack spacing={2}>
                                <Text fontSize="sm" color="gray.600">
                                  Showing {startIndex + 1}-{Math.min(endIndex, filteredParties.length)} of {filteredParties.length} entries
                                </Text>
                                <Select
                                  size="sm"
                                  value={itemsPerPage}
                                  onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                  }}
                                  w="100px"
                                >
                                  <option value={10}>10</option>
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </Select>
                                <Text fontSize="sm" color="gray.600">per page</Text>
                              </HStack>
                              <HStack spacing={2}>
                                <Button
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                  isDisabled={currentPage === 1}
                                >
                                  Previous
                                </Button>
                                <Text fontSize="sm" color="gray.600">
                                  Page {currentPage} of {totalPages}
                                </Text>
                                <Button
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  isDisabled={currentPage === totalPages}
                                >
                                  Next
                                </Button>
                              </HStack>
                            </Flex>
                          </Td>
                        </Tr>
                      )}
                    </>
                  );
                })()}
              </Tbody>
            </Table>
          </Box>
        </>
      )}

      {/* Export Button */}
      {filteredParties.length > 0 && (
        <HStack justify="flex-end" mt={4}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Export to CSV
              const headers = ['Name', 'Group', 'Description', 'Date Added', 'Requirements', 'Addressed Through ISMS', 'How Addressed', 'Source Link', 'Key Products/Services', 'Our Obligations', 'Their Obligations', 'Risk Count'];
              const rows = filteredParties.map(party => [
                party.name,
                party.group || '',
                party.description || '',
                party.dateAdded ? new Date(party.dateAdded).toLocaleDateString() : '',
                party.requirements || '',
                party.addressedThroughISMS ? 'Yes' : 'No',
                party.howAddressedThroughISMS || '',
                party.sourceLink || '',
                party.keyProductsServices || '',
                party.ourObligations || '',
                party.theirObligations || '',
                party._count?.risks || 0,
              ]);

              const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', `interested-parties-${new Date().toISOString().split('T')[0]}.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              toast({
                title: 'Export Complete',
                description: `Exported ${filteredParties.length} interested parties to CSV`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
            }}
          >
            Export to CSV
          </Button>
        </HStack>
      )}

      {/* Export Button */}
      <HStack justify="flex-end" mt={4}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Export to CSV
            const headers = ['Name', 'Group', 'Description', 'Date Added', 'Requirements', 'Addressed Through ISMS', 'How Addressed', 'Source Link', 'Key Products/Services', 'Our Obligations', 'Their Obligations', 'Risk Count'];
            const rows = filteredParties.map(party => [
              party.name,
              party.group || '',
              party.description || '',
              party.dateAdded ? new Date(party.dateAdded).toLocaleDateString() : '',
              party.requirements || '',
              party.addressedThroughISMS ? 'Yes' : 'No',
              party.howAddressedThroughISMS || '',
              party.sourceLink || '',
              party.keyProductsServices || '',
              party.ourObligations || '',
              party.theirObligations || '',
              party._count?.risks || 0,
            ]);

            const csvContent = [
              headers.join(','),
              ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `interested-parties-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
              title: 'Export Complete',
              description: `Exported ${filteredParties.length} interested parties to CSV`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          }}
        >
          Export to CSV
        </Button>
      </HStack>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="4xl"
        initialFocusRef={React.useRef<HTMLInputElement>(null)}
        finalFocusRef={React.useRef<HTMLButtonElement>(null)}
        trapFocus={true}
        returnFocusOnClose={true}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedParty ? 'Edit Interested Party' : 'Create Interested Party'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="75vh" overflowY="auto">
            <Tabs>
              <TabList>
                <Tab>Basic Information</Tab>
                <Tab>Requirements</Tab>
                <Tab>Obligations</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired isInvalid={!!formErrors.name} gridColumn={{ base: 1, md: 'span 2' }}>
                      <FormLabel>Name *</FormLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        onBlur={() => {
                          if (!formData.name.trim()) {
                            setFormErrors(prev => ({ ...prev, name: 'Name is required' }));
                          }
                        }}
                        placeholder="e.g., Amazon Web Services"
                        borderColor={formErrors.name ? 'red.500' : undefined}
                      />
                      {checkingDuplicate && (
                        <Text fontSize="xs" color="gray.500" mt={1}>Checking for duplicates...</Text>
                      )}
                      <FormErrorMessage>{formErrors.name}</FormErrorMessage>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Group</FormLabel>
                      <Select
                        value={formData.group}
                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                        placeholder="Select a group (optional)"
                      >
                        {INTERESTED_PARTY_GROUPS.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Date Added</FormLabel>
                      <Input
                        type="date"
                        value={formData.dateAdded}
                        onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
                        w="100%"
                        maxW="300px"
                      />
                    </FormControl>
                    <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                      <FormLabel>Notes</FormLabel>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional notes or additional information about this interested party"
                        rows={3}
                      />
                    </FormControl>
                    <FormControl gridColumn={{ base: 1, md: 'span 2' }} isInvalid={!!formErrors.sourceLink}>
                      <FormLabel>Source/Link to Supporting Information</FormLabel>
                      <Input
                        type="url"
                        value={formData.sourceLink}
                        onChange={(e) => {
                          setFormData({ ...formData, sourceLink: e.target.value });
                          // Clear error when user types
                          if (formErrors.sourceLink) {
                            setFormErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.sourceLink;
                              return newErrors;
                            });
                          }
                        }}
                        onBlur={() => {
                          if (formData.sourceLink && !validateURL(formData.sourceLink)) {
                            setFormErrors(prev => ({
                              ...prev,
                              sourceLink: 'Please enter a valid URL (e.g., https://example.com) or "N/A"',
                            }));
                          }
                        }}
                        placeholder="https://example.com or N/A"
                        w="100%"
                        maxW="600px"
                        borderColor={formErrors.sourceLink ? 'red.500' : undefined}
                      />
                      <FormErrorMessage>{formErrors.sourceLink}</FormErrorMessage>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Enter a valid URL or "N/A" if not applicable. https:// will be added automatically if missing.
                      </Text>
                    </FormControl>
                    <FormControl gridColumn={{ base: 1, md: 'span 2' }}>
                      <FormLabel>Key products / services</FormLabel>
                      <Textarea
                        value={formData.keyProductsServices}
                        onChange={(e) => setFormData({ ...formData, keyProductsServices: e.target.value })}
                        placeholder="Key products or services"
                        rows={2}
                      />
                    </FormControl>
                  </SimpleGrid>
                </TabPanel>
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Requirements</FormLabel>
                      <Textarea
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        placeholder="Requirements from the interested party"
                        rows={4}
                      />
                    </FormControl>
                    <FormControl>
                      <Checkbox
                        isChecked={formData.addressedThroughISMS}
                        onChange={(e) => setFormData({ ...formData, addressedThroughISMS: e.target.checked })}
                      >
                        Will this be addressed through ISMS?
                      </Checkbox>
                    </FormControl>
                    <FormControl>
                      <FormLabel>How the Requirements will be addressed through the ISMS</FormLabel>
                      <Textarea
                        value={formData.howAddressedThroughISMS}
                        onChange={(e) => setFormData({ ...formData, howAddressedThroughISMS: e.target.value })}
                        placeholder="Describe how requirements will be addressed"
                        rows={4}
                      />
                    </FormControl>
                  </VStack>
                </TabPanel>
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>
                        Our Obligations
                        <Tooltip label="What we must provide to this party (e.g., services, information, compliance reports)">
                          <IconButton
                            aria-label="Help"
                            icon={<Text fontSize="xs">?</Text>}
                            size="xs"
                            variant="ghost"
                            ml={1}
                          />
                        </Tooltip>
                      </FormLabel>
                      <Textarea
                        value={formData.ourObligations}
                        onChange={(e) => setFormData({ ...formData, ourObligations: e.target.value })}
                        placeholder="Describe what we must provide to this interested party (e.g., services, information, compliance reports)"
                        rows={5}
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        What we must provide to this party
                      </Text>
                    </FormControl>
                    <FormControl>
                      <FormLabel>
                        Their Obligations
                        <Tooltip label="What this party must provide to us (e.g., payment, data, compliance documentation)">
                          <IconButton
                            aria-label="Help"
                            icon={<Text fontSize="xs">?</Text>}
                            size="xs"
                            variant="ghost"
                            ml={1}
                          />
                        </Tooltip>
                      </FormLabel>
                      <Textarea
                        value={formData.theirObligations}
                        onChange={(e) => setFormData({ ...formData, theirObligations: e.target.value })}
                        placeholder="Describe what this party must provide to us (e.g., payment, data, compliance documentation)"
                        rows={5}
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        What this party must provide to us
                      </Text>
                    </FormControl>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              mr={3}
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSave}
              isDisabled={!formData.name.trim() || !!formErrors.name || checkingDuplicate}
              isLoading={false}
              loadingText="Saving..."
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <AlertDialog isOpen={isDeleteOpen} onClose={onDeleteClose} leastDestructiveRef={useRef<HTMLButtonElement>(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Interested Party
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete "{partyToDelete?.name}"? This action cannot be undone.
              {partyToDelete && (partyToDelete._count?.risks || 0) > 0 && (
                <Text mt={2} color="red.500" fontSize="sm">
                  Warning: This interested party is used by {partyToDelete._count?.risks} risk(s) and cannot be deleted.
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
        leastDestructiveRef={useRef<HTMLButtonElement>(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Selected Interested Parties
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {selectedParties.size} selected interested part{selectedParties.size !== 1 ? 'ies' : 'y'}? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button onClick={onBulkDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmBulkDelete} ml={3}>
                Delete {selectedParties.size} Part{selectedParties.size !== 1 ? 'ies' : 'y'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Risk Management Modal */}
      <Modal isOpen={isRiskModalOpen} onClose={() => setIsRiskModalOpen(false)} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Manage Risks for {partyForRiskManagement?.name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="60vh" overflowY="auto">
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Select the risks associated with this interested party:
              </Text>
              <Box
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                p={4}
                maxH="400px"
                overflowY="auto"
              >
                {allRisks.length === 0 ? (
                  <Text color="gray.500">Loading risks...</Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {allRisks.map((risk: any) => (
                      <Checkbox
                        key={risk.id}
                        isChecked={selectedRiskIds.has(risk.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedRiskIds);
                          if (e.target.checked) {
                            newSet.add(risk.id);
                          } else {
                            newSet.delete(risk.id);
                          }
                          setSelectedRiskIds(newSet);
                        }}
                      >
                        <HStack spacing={2}>
                          <Text fontSize="sm">{risk.title}</Text>
                        </HStack>
                      </Checkbox>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={() => setIsRiskModalOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveRiskAssociations}>
              Save Associations
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

