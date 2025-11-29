import { useState, useEffect } from 'react';
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
  Text,
  IconButton,
  Tooltip,
  useToast,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure as useAlertDisclosure,
  Link,
  Collapse,
  SimpleGrid,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, ChevronDownIcon, ChevronUpIcon, DownloadIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Legislation {
  id: string;
  dateAdded: string | null;
  interestedParty: string | null;
  actRegulationRequirement: string;
  description: string | null;
  riskOfNonCompliance: string | null;
  howComplianceAchieved: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    risks: number;
  };
}

export function LegislationPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [legislation, setLegislation] = useState<Legislation[]>([]);
  const [filteredLegislation, setFilteredLegislation] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const [selectedLegislation, setSelectedLegislation] = useState<Legislation | null>(null);
  const [legislationToDelete, setLegislationToDelete] = useState<Legislation | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    dateAdded: '',
    interestedParty: '',
    actRegulationRequirement: '',
    description: '',
    riskOfNonCompliance: '',
    howComplianceAchieved: '',
  });
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { isOpen: isImportModalOpen, onOpen: onImportModalOpen, onClose: onImportModalClose } = useDisclosure();

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  useEffect(() => {
    fetchLegislation();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [legislation, searchQuery]);

  const fetchLegislation = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/legislation');
      setLegislation(response.data);
    } catch (error) {
      console.error('Error fetching legislation:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch legislation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...legislation];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.actRegulationRequirement.toLowerCase().includes(query) ||
          (item.interestedParty && item.interestedParty.toLowerCase().includes(query)) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          (item.riskOfNonCompliance && item.riskOfNonCompliance.toLowerCase().includes(query)) ||
          (item.howComplianceAchieved && item.howComplianceAchieved.toLowerCase().includes(query))
      );
    }

    setFilteredLegislation(filtered);
  };

  const toggleRowExpansion = (legislationId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(legislationId)) {
      newExpanded.delete(legislationId);
    } else {
      newExpanded.add(legislationId);
    }
    setExpandedRows(newExpanded);
  };

  const handleCreate = () => {
    setSelectedLegislation(null);
    setFormData({
      dateAdded: '',
      interestedParty: '',
      actRegulationRequirement: '',
      description: '',
      riskOfNonCompliance: '',
      howComplianceAchieved: '',
    });
    onOpen();
  };

  const handleEdit = (item: Legislation) => {
    setSelectedLegislation(item);
    setFormData({
      dateAdded: item.dateAdded ? new Date(item.dateAdded).toISOString().split('T')[0] : '',
      interestedParty: item.interestedParty || '',
      actRegulationRequirement: item.actRegulationRequirement,
      description: item.description || '',
      riskOfNonCompliance: item.riskOfNonCompliance || '',
      howComplianceAchieved: item.howComplianceAchieved || '',
    });
    onOpen();
  };

  const handleDelete = (item: Legislation) => {
    setLegislationToDelete(item);
    onDeleteOpen();
  };

  const handleSave = async () => {
    try {
      const payload: any = {
        actRegulationRequirement: formData.actRegulationRequirement,
        interestedParty: formData.interestedParty || null,
        description: formData.description || null,
        riskOfNonCompliance: formData.riskOfNonCompliance || null,
        howComplianceAchieved: formData.howComplianceAchieved || null,
      };
      
      if (formData.dateAdded) {
        payload.dateAdded = new Date(formData.dateAdded).toISOString();
      }

      if (selectedLegislation) {
        await api.put(`/api/legislation/${selectedLegislation.id}`, payload);
        toast({
          title: 'Success',
          description: 'Legislation updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/legislation', payload);
        toast({
          title: 'Success',
          description: 'Legislation created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      onClose();
      fetchLegislation();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save legislation';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!legislationToDelete) return;

    try {
      await api.delete(`/api/legislation/${legislationToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Legislation deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      setLegislationToDelete(null);
      fetchLegislation();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete legislation';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Please select a CSV file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setImporting(true);
      const response = await api.post('/api/legislation/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${response.data.success} of ${response.data.total} legislation records`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      if (response.data.errors && response.data.errors.length > 0) {
        console.error('Import errors:', response.data.errors);
        toast({
          title: 'Some imports failed',
          description: `${response.data.failed} records failed to import. Check console for details.`,
          status: 'warning',
          duration: 7000,
          isClosable: true,
        });
      }

      onImportModalClose();
      fetchLegislation();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to import legislation';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Legislation & Regulation Record</Heading>
        <HStack spacing={2}>
          {canEdit && (
            <>
              <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreate}>
                Create Legislation
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
        </HStack>
      </HStack>

      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Search legislation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </InputGroup>

      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th w="40px"></Th>
                <Th>Act / Regulation / Requirement</Th>
                <Th>Interested Party</Th>
                <Th>Description</Th>
                <Th>Risks</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredLegislation.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center">
                    <Text color="gray.500">No legislation found</Text>
                  </Td>
                </Tr>
              ) : (
                filteredLegislation.map((item) => {
                  const isExpanded = expandedRows.has(item.id);
                  return (
                    <React.Fragment key={item.id}>
                      <Tr>
                        <Td>
                          <IconButton
                            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                            icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={() => toggleRowExpansion(item.id)}
                          />
                        </Td>
                        <Td fontWeight="medium">{item.actRegulationRequirement}</Td>
                        <Td>
                          {item.interestedParty ? (
                            <Text>{item.interestedParty}</Text>
                          ) : (
                            <Text color="gray.400">—</Text>
                          )}
                        </Td>
                        <Td>
                          {item.description ? (
                            <Text noOfLines={2}>{item.description}</Text>
                          ) : (
                            <Text color="gray.400">—</Text>
                          )}
                        </Td>
                        <Td>
                          <Badge colorScheme="purple">{item._count?.risks || 0}</Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            {canEdit && (
                              <>
                                <Tooltip label="Edit">
                                  <IconButton
                                    aria-label="Edit legislation"
                                    icon={<EditIcon />}
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                  />
                                </Tooltip>
                                <Tooltip label="Delete">
                                  <IconButton
                                    aria-label="Delete legislation"
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    colorScheme="red"
                                    onClick={() => handleDelete(item)}
                                  />
                                </Tooltip>
                              </>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td colSpan={6} p={0}>
                          <Collapse in={isExpanded} animateOpacity>
                            <Box p={4} bg="gray.50" borderTop="1px solid" borderColor="gray.200">
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                {item.dateAdded && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Date Added
                                    </Text>
                                    <Text fontSize="sm">
                                      {new Date(item.dateAdded).toLocaleDateString()}
                                    </Text>
                                  </Box>
                                )}
                                {item.riskOfNonCompliance && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Risk of Non-Compliance
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {item.riskOfNonCompliance}
                                    </Text>
                                  </Box>
                                )}
                                {item.howComplianceAchieved && (
                                  <Box gridColumn={{ base: 1, md: 'span 2' }}>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      How Compliance is Achieved
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {item.howComplianceAchieved}
                                    </Text>
                                  </Box>
                                )}
                              </SimpleGrid>
                            </Box>
                          </Collapse>
                        </Td>
                      </Tr>
                    </React.Fragment>
                  );
                })
              )}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedLegislation ? 'Edit Legislation' : 'Create Legislation'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="70vh" overflowY="auto">
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Act / Regulation / Requirement</FormLabel>
                <Input
                  value={formData.actRegulationRequirement}
                  onChange={(e) => setFormData({ ...formData, actRegulationRequirement: e.target.value })}
                  placeholder="e.g., PCI DSS"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Interested Party</FormLabel>
                <Input
                  value={formData.interestedParty}
                  onChange={(e) => setFormData({ ...formData, interestedParty: e.target.value })}
                  placeholder="e.g., Shareholders and clients"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Date Added</FormLabel>
                <Input
                  type="date"
                  value={formData.dateAdded}
                  onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of the legislation"
                  rows={3}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Risk of Non-Compliance</FormLabel>
                <Textarea
                  value={formData.riskOfNonCompliance}
                  onChange={(e) => setFormData({ ...formData, riskOfNonCompliance: e.target.value })}
                  placeholder="Describe the risks of non-compliance"
                  rows={4}
                />
              </FormControl>
              <FormControl>
                <FormLabel>How Compliance is Achieved</FormLabel>
                <Textarea
                  value={formData.howComplianceAchieved}
                  onChange={(e) => setFormData({ ...formData, howComplianceAchieved: e.target.value })}
                  placeholder="Describe how compliance is achieved"
                  rows={4}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <AlertDialog isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Legislation
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete "{legislationToDelete?.actRegulationRequirement}"? This action cannot be undone.
              {legislationToDelete && (legislationToDelete._count?.risks || 0) > 0 && (
                <Text mt={2} color="red.500" fontSize="sm">
                  Warning: This legislation is linked to {legislationToDelete._count?.risks} risk(s) and cannot be deleted.
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

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={onImportModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import Legislation from CSV</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Select a CSV file to import legislation records. The CSV should have the following columns:
              </Text>
              <Box bg="gray.50" p={4} borderRadius="md">
                <Text fontSize="sm" fontFamily="mono">
                  Date Added, Interested party, Act / Regulation / Requirement, Description, Risk of non-compliance, How compliance is achieved, Risk Links
                </Text>
              </Box>
              <Text fontSize="sm" color="gray.600">
                Risk Links should contain comma-separated risk IDs or external IDs that match existing risks in the system.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onImportModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                onImportModalClose();
                setTimeout(() => handleImportClick(), 100);
              }}
              isLoading={importing}
              loadingText="Importing..."
            >
              Select File
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

