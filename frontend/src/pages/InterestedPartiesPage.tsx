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
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InterestedParty {
  id: string;
  name: string;
  group: string | null;
  description: string | null;
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
  const [formData, setFormData] = useState({ name: '', group: '', description: '' });

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
          (party.description && party.description.toLowerCase().includes(query))
      );
    }

    setFilteredParties(filtered);
  };

  const handleCreate = () => {
    setSelectedParty(null);
    setFormData({ name: '', group: '', description: '' });
    onOpen();
  };

  const handleEdit = (party: InterestedParty) => {
    setSelectedParty(party);
    setFormData({
      name: party.name,
      group: party.group || '',
      description: party.description || '',
    });
    onOpen();
  };

  const handleDelete = (party: InterestedParty) => {
    setPartyToDelete(party);
    onDeleteOpen();
  };

  const handleSave = async () => {
    try {
      if (selectedParty) {
        await api.put(`/api/interested-parties/${selectedParty.id}`, formData);
        toast({
          title: 'Success',
          description: 'Interested party updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/interested-parties', formData);
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
                  <Td colSpan={5} textAlign="center">
                    <Text color="gray.500">No interested parties found</Text>
                  </Td>
                </Tr>
              ) : (
                filteredParties.map((party) => (
                  <Tr key={party.id}>
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
                ))
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
          <ModalBody>
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

