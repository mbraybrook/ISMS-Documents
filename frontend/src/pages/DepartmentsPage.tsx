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
  useDisclosure,
  HStack,
  VStack,
  Text,
  Spinner,
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
  Input,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import { EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    risks: number;
  };
}

export function DepartmentsPage() {
  usePageTitle('Departments', true);
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/departments');
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch departments',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreate = () => {
    setSelectedDepartment(null);
    setDepartmentName('');
    onOpen();
  };

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department);
    setDepartmentName(department.name);
    onOpen();
  };

  const handleDelete = (department: Department) => {
    setDepartmentToDelete(department);
    onDeleteOpen();
  };

  const handleSave = async () => {
    if (!departmentName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Department name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedDepartment) {
        // Update existing department
        await api.put(`/api/departments/${selectedDepartment.id}`, {
          name: departmentName.trim(),
        });
        toast({
          title: 'Success',
          description: 'Department updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Create new department
        await api.post('/api/departments', {
          name: departmentName.trim(),
        });
        toast({
          title: 'Success',
          description: 'Department created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      await fetchDepartments();
      onClose();
      setSelectedDepartment(null);
      setDepartmentName('');
    } catch (error: unknown) {
      console.error('Error saving department:', error);
      const errorObj = error as { response?: { data?: { error?: string } } };
      toast({
        title: 'Error',
        description: errorObj.response?.data?.error || 'Failed to save department',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!departmentToDelete) return;

    setIsSubmitting(true);
    try {
      await api.delete(`/api/departments/${departmentToDelete.id}`);
      toast({
        title: 'Success',
        description: 'Department deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await fetchDepartments();
      onDeleteClose();
      setDepartmentToDelete(null);
    } catch (error: unknown) {
      console.error('Error deleting department:', error);
      const errorObj = error as { response?: { data?: { error?: string; errors?: Array<{ msg?: string }> } } };
      const message =
        errorObj.response?.data?.error ||
        errorObj.response?.data?.errors?.[0]?.msg ||
        'Failed to delete department';
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box p={8}>
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box p={8}>
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg">Department Management</Heading>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={handleCreate}
          >
            Create Department
          </Button>
        </HStack>

        {/* Departments Table */}
        {departments.length === 0 ? (
          <Box p={8} textAlign="center" bg="gray.50" borderRadius="md">
            <Text color="gray.600">No departments found. Create your first department to get started.</Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Users</Th>
                  <Th>Risks</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {departments.map((department) => (
                  <Tr key={department.id}>
                    <Td>
                      <Text fontWeight="medium">{department.name}</Text>
                    </Td>
                    <Td>
                      <Badge colorScheme="teal">
                        {department._count?.users || 0}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme="purple">
                        {department._count?.risks || 0}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">
                        {new Date(department.createdAt).toLocaleDateString()}
                      </Text>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          aria-label="Edit department"
                          icon={<EditIcon />}
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(department)}
                        />
                        <IconButton
                          aria-label="Delete department"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="outline"
                          colorScheme="red"
                          onClick={() => handleDelete(department)}
                          isDisabled={
                            (department._count?.users || 0) > 0 ||
                            (department._count?.risks || 0) > 0
                          }
                          title={
                            (() => {
                              const userCount = department._count?.users || 0;
                              const riskCount = department._count?.risks || 0;
                              if (userCount > 0 && riskCount > 0) {
                                return `Cannot delete department: it is assigned to ${userCount} user(s) and ${riskCount} risk(s)`;
                              }
                              if (userCount > 0) {
                                return `Cannot delete department: it is assigned to ${userCount} user(s)`;
                              }
                              if (riskCount > 0) {
                                return `Cannot delete department: it is assigned to ${riskCount} risk(s)`;
                              }
                              return 'Delete department';
                            })()
                          }
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        <Text fontSize="sm" color="gray.600">
          Showing {departments.length} department{departments.length !== 1 ? 's' : ''}
        </Text>
      </VStack>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedDepartment ? 'Edit Department' : 'Create Department'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Department Name</FormLabel>
              <Input
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Enter department name"
                autoFocus
              />
            </FormControl>
            {selectedDepartment && (
              <Box mt={4}>
                <Text fontSize="sm" color="gray.600">
                  This department is assigned to {selectedDepartment._count?.users || 0} user(s) and{' '}
                  {selectedDepartment._count?.risks || 0} risk(s).
                </Text>
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSave}
              isLoading={isSubmitting}
            >
              {selectedDepartment ? 'Save Changes' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Department</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to delete the department &quot;{departmentToDelete?.name}&quot;?
            </Text>
            {departmentToDelete && (departmentToDelete._count?.risks || 0) > 0 && (
              <Text mt={2} fontSize="sm" color="orange.600">
                Note: This department is assigned to {departmentToDelete._count?.risks || 0} risk(s).
                The department assignment will be removed from those risks.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteClose} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleConfirmDelete}
              isLoading={isSubmitting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
