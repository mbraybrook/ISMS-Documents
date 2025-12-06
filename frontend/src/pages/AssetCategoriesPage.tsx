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
  Link,
  Divider,
  Spinner,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Risk } from '../types/risk';

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    risks: number;
  };
}

export function AssetCategoriesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure();
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<AssetCategory | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [categories, searchQuery]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/asset-categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching asset categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch asset categories',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...categories];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (category) =>
          category.name.toLowerCase().includes(query) ||
          (category.description && category.description.toLowerCase().includes(query))
      );
    }

    setFilteredCategories(filtered);
  };

  const handleCreate = () => {
    setSelectedCategory(null);
    setFormData({ name: '', description: '' });
    setLinkedRisks([]);
    onOpen();
  };

  const handleEdit = async (category: AssetCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setLinkedRisks([]);
    onOpen();
    
    // Fetch linked risks if there are any
    if (category._count?.risks && category._count.risks > 0) {
      setLoadingRisks(true);
      try {
        const response = await api.get(`/api/risks?assetCategoryId=${category.id}&limit=100`);
        setLinkedRisks(response.data.data || []);
      } catch (error) {
        console.error('Error fetching linked risks:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch linked risks',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoadingRisks(false);
      }
    }
  };

  const handleRowClick = (category: AssetCategory, event: React.MouseEvent) => {
    // Don't open edit if clicking on action buttons or links
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    if (canEdit) {
      handleEdit(category);
    }
  };

  const handleDelete = (category: AssetCategory) => {
    setCategoryToDelete(category);
    onDeleteOpen();
  };

  const handleSave = async () => {
    try {
      if (selectedCategory) {
        await api.put(`/api/asset-categories/${selectedCategory.id}`, formData);
        toast({
          title: 'Success',
          description: 'Asset category updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/asset-categories', formData);
        toast({
          title: 'Success',
          description: 'Asset category created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      onClose();
      setLinkedRisks([]);
      fetchCategories();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save asset category';
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
    if (!categoryToDelete) return;

    try {
      await api.delete(`/api/asset-categories/${categoryToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Asset category deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      setCategoryToDelete(null);
      fetchCategories();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete asset category';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Asset Categories</Heading>
        {canEdit && (
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreate}>
            Create Category
          </Button>
        )}
      </HStack>

      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Search categories..."
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
                <Th>Description</Th>
                <Th>Assets</Th>
                <Th>Risks</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredCategories.length === 0 ? (
                <Tr>
                  <Td colSpan={5} textAlign="center">
                    <Text color="gray.500">No asset categories found</Text>
                  </Td>
                </Tr>
              ) : (
                filteredCategories.map((category) => (
                  <Tr 
                    key={category.id}
                    cursor={canEdit ? "pointer" : "default"}
                    _hover={canEdit ? { bg: "gray.50" } : {}}
                    onClick={(e) => handleRowClick(category, e)}
                  >
                    <Td fontWeight="medium">{category.name}</Td>
                    <Td>{category.description || <Text color="gray.400">—</Text>}</Td>
                    <Td>
                      <Badge colorScheme="blue">{category._count?.assets || 0}</Badge>
                    </Td>
                    <Td>
                      {(category._count?.risks || 0) > 0 ? (
                        <Tooltip
                          label={`${category._count?.risks || 0} linked risk${(category._count?.risks || 0) !== 1 ? 's' : ''}. Click to view.`}
                          hasArrow
                        >
                          <Link
                            as={RouterLink}
                            to={`/admin/risks/risks?assetCategoryId=${category.id}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <Badge
                              colorScheme="purple"
                              cursor="pointer"
                              _hover={{ transform: 'scale(1.1)' }}
                              transition="transform 0.2s"
                            >
                              {category._count?.risks || 0}
                            </Badge>
                          </Link>
                        </Tooltip>
                      ) : (
                        <Badge colorScheme="purple">{category._count?.risks || 0}</Badge>
                      )}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        {canEdit && (
                          <>
                            <Tooltip label="Edit">
                              <IconButton
                                aria-label="Edit category"
                                icon={<EditIcon />}
                                size="sm"
                                onClick={() => handleEdit(category)}
                              />
                            </Tooltip>
                            <Tooltip label="Delete">
                              <IconButton
                                aria-label="Delete category"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="red"
                                onClick={() => handleDelete(category)}
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
            {selectedCategory ? 'Edit Asset Category' : 'Create Asset Category'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Hardware, Hosted Infrastructure"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </FormControl>
              
              {selectedCategory && (
                <>
                  <Divider />
                  <Box>
                    <FormLabel mb={2}>Linked Risks ({linkedRisks.length})</FormLabel>
                    {loadingRisks ? (
                      <HStack justify="center" py={4}>
                        <Spinner size="sm" />
                        <Text fontSize="sm" color="gray.500">Loading risks...</Text>
                      </HStack>
                    ) : linkedRisks.length > 0 ? (
                      <VStack align="stretch" spacing={2} maxH="300px" overflowY="auto">
                        {linkedRisks.map((risk) => (
                          <Box
                            key={risk.id}
                            p={2}
                            bg="white"
                            borderRadius="md"
                            border="1px"
                            borderColor="blue.200"
                            _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                          >
                            <Link
                              as={RouterLink}
                              to={`/admin/risks/risks?view=${risk.id}`}
                              style={{ textDecoration: 'none' }}
                            >
                              <HStack spacing={2}>
                                <Badge colorScheme="purple" fontSize="xs">
                                  Risk
                                </Badge>
                                <Text fontSize="sm" fontWeight="medium" color="blue.700" _hover={{ textDecoration: "underline" }}>
                                  {risk.title}
                                </Text>
                              </HStack>
                            </Link>
                          </Box>
                        ))}
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color="gray.500">No linked risks</Text>
                    )}
                  </Box>
                </>
              )}
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
              Delete Asset Category
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete "{categoryToDelete?.name}"? This action cannot be undone.
              {categoryToDelete && (categoryToDelete._count?.assets || 0) > 0 && (
                <Text mt={2} color="red.500" fontSize="sm">
                  Warning: This category is used by {categoryToDelete._count?.assets} asset(s).
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





