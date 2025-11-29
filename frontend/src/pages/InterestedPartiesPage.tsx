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
  Select,
  Checkbox,
  Link,
  Collapse,
  Divider,
  SimpleGrid,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
  const [selectedParty, setSelectedParty] = useState<InterestedParty | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<InterestedParty | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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
  }, [interestedParties, searchQuery]);

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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (party) =>
          party.name.toLowerCase().includes(query) ||
          (party.group && party.group.toLowerCase().includes(query)) ||
          (party.description && party.description.toLowerCase().includes(query)) ||
          (party.requirements && party.requirements.toLowerCase().includes(query)) ||
          (party.howAddressedThroughISMS && party.howAddressedThroughISMS.toLowerCase().includes(query)) ||
          (party.keyProductsServices && party.keyProductsServices.toLowerCase().includes(query)) ||
          (party.ourObligations && party.ourObligations.toLowerCase().includes(query)) ||
          (party.theirObligations && party.theirObligations.toLowerCase().includes(query))
      );
    }

    setFilteredParties(filtered);
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
    setFormData({
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
      addressedThroughISMS: party.addressedThroughISMS ?? false,
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

  const handleSave = async () => {
    try {
      const payload: any = {
        name: formData.name,
        group: formData.group || null,
        description: formData.description || null,
        requirements: formData.requirements || null,
        addressedThroughISMS: formData.addressedThroughISMS,
        howAddressedThroughISMS: formData.howAddressedThroughISMS || null,
        sourceLink: formData.sourceLink || null,
        keyProductsServices: formData.keyProductsServices || null,
        ourObligations: formData.ourObligations || null,
        theirObligations: formData.theirObligations || null,
      };
      
      if (formData.dateAdded) {
        payload.dateAdded = new Date(formData.dateAdded).toISOString();
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
      fetchInterestedParties();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save interested party';
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
        return 'blue';
      case 'Clients':
        return 'green';
      case 'Internal':
        return 'purple';
      case 'Regulatory Body':
        return 'orange';
      default:
        return 'gray';
    }
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

      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Search interested parties..."
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
                <Th>Name</Th>
                <Th>Group</Th>
                <Th>Description</Th>
                <Th>Risks</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredParties.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center">
                    <Text color="gray.500">No interested parties found</Text>
                  </Td>
                </Tr>
              ) : (
                filteredParties.map((party) => {
                  const isExpanded = expandedRows.has(party.id);
                  return (
                    <React.Fragment key={party.id}>
                      <Tr>
                        <Td>
                          <IconButton
                            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                            icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={() => toggleRowExpansion(party.id)}
                          />
                        </Td>
                        <Td fontWeight="medium">{party.name}</Td>
                        <Td>
                          {party.group ? (
                            <Badge colorScheme={getGroupColor(party.group)}>{party.group}</Badge>
                          ) : (
                            <Text color="gray.400">—</Text>
                          )}
                        </Td>
                        <Td>{party.description || <Text color="gray.400">—</Text>}</Td>
                        <Td>
                          <Badge colorScheme="purple">{party._count?.risks || 0}</Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            {canEdit && (
                              <>
                                <Tooltip label="Edit">
                                  <IconButton
                                    aria-label="Edit interested party"
                                    icon={<EditIcon />}
                                    size="sm"
                                    onClick={() => handleEdit(party)}
                                  />
                                </Tooltip>
                                <Tooltip label="Delete">
                                  <IconButton
                                    aria-label="Delete interested party"
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    colorScheme="red"
                                    onClick={() => handleDelete(party)}
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
                                {party.dateAdded && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Date Added
                                    </Text>
                                    <Text fontSize="sm">
                                      {new Date(party.dateAdded).toLocaleDateString()}
                                    </Text>
                                  </Box>
                                )}
                                {party.requirements && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Requirements
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {party.requirements}
                                    </Text>
                                  </Box>
                                )}
                                {party.addressedThroughISMS !== null && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Addressed Through ISMS
                                    </Text>
                                    <Text fontSize="sm">
                                      {party.addressedThroughISMS ? 'Yes' : 'No'}
                                    </Text>
                                  </Box>
                                )}
                                {party.howAddressedThroughISMS && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      How Addressed Through ISMS
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {party.howAddressedThroughISMS}
                                    </Text>
                                  </Box>
                                )}
                                {party.sourceLink && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Source/Link
                                    </Text>
                                    <Link href={party.sourceLink} isExternal color="blue.500" fontSize="sm">
                                      {party.sourceLink}
                                    </Link>
                                  </Box>
                                )}
                                {party.keyProductsServices && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Key Products / Services
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {party.keyProductsServices}
                                    </Text>
                                  </Box>
                                )}
                                {party.ourObligations && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Our Obligations
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {party.ourObligations}
                                    </Text>
                                  </Box>
                                )}
                                {party.theirObligations && (
                                  <Box>
                                    <Text fontWeight="semibold" fontSize="sm" color="gray.600" mb={1}>
                                      Their Obligations
                                    </Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                      {party.theirObligations}
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
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedParty ? 'Edit Interested Party' : 'Create Interested Party'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody maxH="70vh" overflowY="auto">
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Amazon Web Services"
                />
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
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
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
                <FormLabel>Requirements</FormLabel>
                <Textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="Requirements from the interested party"
                  rows={3}
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
                  rows={3}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Source/Link to Supporting Information</FormLabel>
                <Input
                  type="url"
                  value={formData.sourceLink}
                  onChange={(e) => setFormData({ ...formData, sourceLink: e.target.value })}
                  placeholder="https://..."
                />
              </FormControl>
              <FormControl>
                <FormLabel>Key products / services</FormLabel>
                <Textarea
                  value={formData.keyProductsServices}
                  onChange={(e) => setFormData({ ...formData, keyProductsServices: e.target.value })}
                  placeholder="Key products or services"
                  rows={2}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Our obligations</FormLabel>
                <Textarea
                  value={formData.ourObligations}
                  onChange={(e) => setFormData({ ...formData, ourObligations: e.target.value })}
                  placeholder="Our obligations to this interested party"
                  rows={3}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Their obligations</FormLabel>
                <Textarea
                  value={formData.theirObligations}
                  onChange={(e) => setFormData({ ...formData, theirObligations: e.target.value })}
                  placeholder="Their obligations to us"
                  rows={3}
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
    </VStack>
  );
}

