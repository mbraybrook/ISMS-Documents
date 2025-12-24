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
  Badge,
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
  Select,
  Input,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Department, getDepartmentDisplayName } from '../types/risk';
import { usePageTitle } from '../hooks/usePageTitle';

type UserRole = 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR';

interface User {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  department: Department | null;
}

export function UsersPage() {
  usePageTitle('Users', true);
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Form state for editing
  const [editRole, setEditRole] = useState<UserRole>('STAFF');
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (roleFilter) {
        params.role = roleFilter;
      }
      const response = await api.get('/api/users', { params });
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [roleFilter, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditDepartment(user.department);
    onOpen();
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    try {
      const updateData: Partial<Pick<User, 'role' | 'department'>> = {};
      if (editRole !== selectedUser.role) {
        updateData.role = editRole;
      }
      if (editDepartment !== selectedUser.department) {
        updateData.department = editDepartment;
      }

      if (Object.keys(updateData).length === 0) {
        onClose();
        return;
      }

      await api.put(`/api/users/${selectedUser.id}`, updateData);

      
      toast({
        title: 'Success',
        description: 'User updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh users list
      await fetchUsers();
      onClose();
      setSelectedUser(null);
    } catch (error: unknown) {
      console.error('Error updating user:', error);
      const errorObj = error as { response?: { data?: { error?: string } } };
      toast({
        title: 'Error',
        description: errorObj.response?.data?.error || 'Failed to update user',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const getRoleColor = (role: UserRole): string => {
    switch (role) {
      case 'ADMIN':
        return 'red';
      case 'EDITOR':
        return 'blue';
      case 'CONTRIBUTOR':
        return 'purple';
      case 'STAFF':
        return 'gray';
      default:
        return 'gray';
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesDepartment = !departmentFilter || user.department === departmentFilter;
    const matchesSearch =
      !searchFilter ||
      user.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      user.email.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesRole && matchesDepartment && matchesSearch;
  });

  const departments: Department[] = ['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING'];
  const roles: UserRole[] = ['ADMIN', 'EDITOR', 'STAFF', 'CONTRIBUTOR'];

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
          <Heading size="lg">User Management</Heading>
        </HStack>

        {/* Filters */}
        <HStack spacing={4} wrap="wrap">
          <FormControl width="200px">
            <FormLabel fontSize="sm">Filter by Role</FormLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              placeholder="All Roles"
              size="sm"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl width="200px">
            <FormLabel fontSize="sm">Filter by Department</FormLabel>
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              placeholder="All Departments"
              size="sm"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {getDepartmentDisplayName(dept)}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl width="300px">
            <FormLabel fontSize="sm">Search</FormLabel>
            <Input
              placeholder="Search by name or email..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              size="sm"
            />
          </FormControl>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRoleFilter('');
              setDepartmentFilter('');
              setSearchFilter('');
            }}
            mt={6}
          >
            Clear Filters
          </Button>
        </HStack>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <Box p={8} textAlign="center" bg="gray.50" borderRadius="md">
            <Text color="gray.600">
              {users.length === 0 ? 'No users found.' : 'No users match your filters.'}
            </Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Display Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Department</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredUsers.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <Text fontWeight="medium">{user.displayName}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">
                        {user.email}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                    </Td>
                    <Td>
                      {user.department ? (
                        <Badge colorScheme="teal">
                          {getDepartmentDisplayName(user.department)}
                        </Badge>
                      ) : (
                        <Text fontSize="sm" color="gray.400">
                          Not assigned
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        <Text fontSize="sm" color="gray.600">
          Showing {filteredUsers.length} of {users.length} users
        </Text>
      </VStack>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="sm" color="gray.600">
                  Display Name
                </Text>
                <Text fontSize="lg" fontWeight="medium">
                  {selectedUser?.displayName}
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.600">
                  Email
                </Text>
                <Text fontSize="lg" fontWeight="medium">
                  {selectedUser?.email}
                </Text>
              </Box>
              <FormControl>
                <FormLabel>Role</FormLabel>
                <Select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Department</FormLabel>
                <Select
                  value={editDepartment || ''}
                  onChange={(e) =>
                    setEditDepartment(
                      e.target.value ? (e.target.value as Department) : null
                    )
                  }
                >
                  <option value="">Not assigned</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {getDepartmentDisplayName(dept)}
                    </option>
                  ))}
                </Select>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {editRole === 'CONTRIBUTOR'
                    ? 'Department is required for Contributors'
                    : 'Department is optional for other roles'}
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

