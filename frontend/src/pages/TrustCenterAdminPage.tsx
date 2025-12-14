import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  Input,
  Switch,
  Textarea,
  NumberInput,
  NumberInputField,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  useDisclosure,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { trustApi } from '../services/trustApi';
import type { ExternalUser, TrustDocSetting, TrustDocument, UserDetails } from '../types/trust';
import { AxiosError } from 'axios';

export function TrustCenterAdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<ExternalUser[]>([]);
  const [documents, setDocuments] = useState<Array<{ document: TrustDocument; trustSetting: TrustDocSetting | null }>>([]);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<TrustDocSetting>>({});
  const [editingDocument, setEditingDocument] = useState<{ document: TrustDocument; trustSetting: TrustDocSetting | null } | null>(null);
  const [settings, setSettings] = useState<{ watermarkPrefix: string }>({ watermarkPrefix: 'Paythru Confidential' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0); // 0 = Document Management, 1 = Pending Requests, 2 = Settings, 3 = User Management
  const documentListRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  // User Management state
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async (preserveScroll = false) => {
    try {
      setLoading(true);
      const [users, docs, settingsData] = await Promise.all([
        trustApi.getPendingRequests(),
        trustApi.getDocumentSettings(),
        trustApi.getSettings().catch(() => ({ watermarkPrefix: 'Paythru Confidential' })), // Fallback on error
      ]);
      setPendingUsers(users);
      setDocuments(docs);
      setSettings(settingsData);

      // Restore scroll position if requested and we're on the document management tab
      if (preserveScroll && tabIndex === 0 && documentListRef.current) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          if (documentListRef.current) {
            documentListRef.current.scrollTop = savedScrollPosition.current;
          }
        }, 0);
      }
    } catch (error: unknown) {
      console.error('Error loading admin data:', error);
      const errorObj = error as { response?: { status?: number; data?: { error?: string } } };
      // Don't redirect on 401 - let ProtectedRoute handle it
      if (errorObj.response?.status === 401) {
        // Authentication issue - ProtectedRoute will handle redirect
        return;
      }
      toast({
        title: 'Error',
        description: errorObj.response?.data?.error || 'Failed to load admin data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [tabIndex, toast]);

  useEffect(() => {
    // Only load data if user is authenticated and has the right role
    if (user && (user.role === 'ADMIN' || user.role === 'EDITOR')) {
      loadData();
    }
  }, [user, loadData]);

  const handleSaveSettings = async () => {
    try {
      setSettingsLoading(true);
      const updated = await trustApi.updateSettings(settings);
      setSettings(updated);
      toast({
        title: 'Settings updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to update settings',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await trustApi.approveUser(userId);
      toast({
        title: 'User approved',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadData();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to approve user',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDenyUser = async (userId: string, reason?: string) => {
    if (!confirm('Are you sure you want to deny this user?')) {
      return;
    }

    try {
      await trustApi.denyUser(userId, reason);
      toast({
        title: 'User denied',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadData();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to deny user',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const activeFilterValue = activeFilter === 'all' ? undefined : activeFilter === 'active';
      const usersData = await trustApi.getAllUsers({
        status: statusFilter,
        active: activeFilterValue,
        search: searchQuery || undefined,
      });
      setUsers(usersData);
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to load users',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUsersLoading(false);
    }
  }, [statusFilter, activeFilter, searchQuery, toast]);

  useEffect(() => {
    if (tabIndex === 3 && user && (user.role === 'ADMIN' || user.role === 'EDITOR')) {
      loadUsers();
    }
  }, [tabIndex, user, loadUsers]);

  const handleViewDetails = async (userId: string) => {
    try {
      setUserDetailsLoading(true);
      const details = await trustApi.getUserDetails(userId);
      setUserDetails(details);
      onDetailsOpen();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to load user details',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke access for this user?')) {
      return;
    }

    try {
      await trustApi.revokeUserAccess(userId);
      toast({
        title: 'Access revoked',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadUsers();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to revoke access',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleRestoreAccess = async (userId: string) => {
    if (!confirm('Are you sure you want to restore access for this user?')) {
      return;
    }

    try {
      await trustApi.restoreUserAccess(userId);
      toast({
        title: 'Access restored',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadUsers();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to restore access',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleEditDoc = (doc: { document: TrustDocument; trustSetting: TrustDocSetting | null }) => {
    setEditingDocument(doc);
    setEditingDoc(doc.document.id);
    setEditData(doc.trustSetting || {
      visibilityLevel: 'public',
      category: 'policy',
      requiresNda: false,
      publicDescription: '',
      displayOrder: undefined,
      sharePointUrl: doc.document.sharePointItemId ? undefined : '',
    });
    onOpen();
  };

  const handleSaveDoc = async (docId: string) => {
    try {
      // Save current scroll position if on document management tab
      if (tabIndex === 0 && documentListRef.current) {
        savedScrollPosition.current = documentListRef.current.scrollTop;
      }

      // Only include fields that can be updated (exclude id, documentId, createdAt, updatedAt)
      const allowedFields = ['visibilityLevel', 'category', 'sharePointUrl', 'publicDescription', 'displayOrder', 'requiresNda', 'maxFileSizeMB'];
      const normalizedData: Partial<TrustDocSetting> = {};
      
      // Only copy allowed fields
      allowedFields.forEach(field => {
        const value = editData[field as keyof TrustDocSetting];
        if (value !== undefined) {
          // Normalize empty strings to null for string fields
          if (field === 'publicDescription' && value === '') {
            normalizedData.publicDescription = null;
          } else if (field === 'sharePointUrl' && value === '') {
            // Skip empty sharePointUrl - don't send it
          } else if (field === 'displayOrder' && (value === null || value === '')) {
            // Skip null/empty displayOrder
          } else {
            // Safe cast as we know the field exists on TrustDocSetting
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (normalizedData as any)[field] = value;
          }
        }
      });

      
      console.log('Sending document settings update:', { docId, normalizedData });
      await trustApi.updateDocumentSettings(docId, normalizedData);
      toast({
        title: 'Settings updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setEditingDoc(null);
      setEditingDocument(null);
      setEditData({});
      onClose();
      // Preserve tab index and scroll position
      loadData(true);
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; details?: string; errors?: Array<{ param: string; msg: string }> } } };
      const errorMessage = errorObj.response?.data?.error || 
                          errorObj.response?.data?.details ||
                          errorObj.response?.data?.errors?.map((e) => `${e.param}: ${e.msg}`).join(', ') ||
                          'Failed to update settings';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingDoc(null);
    setEditingDocument(null);
    setEditData({});
    onClose();
  };

  const handleToggleTrustCenter = async (doc: { document: TrustDocument; trustSetting: TrustDocSetting | null }, enabled: boolean) => {
    if (enabled) {
      // Create new setting - open edit modal so user can configure
      handleEditDoc(doc);
    } else {
      // Remove setting - delete the TrustDocSetting
      if (!confirm('Are you sure you want to remove this document from the Trust Center?')) {
        // Reset the toggle if user cancels
        loadData();
        return;
      }
      try {
        await trustApi.deleteDocumentSettings(doc.document.id);
        toast({
          title: 'Success',
          description: 'Document removed from Trust Center',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        loadData();
      } catch (error: unknown) {
        console.error('Error disabling trust center:', error);
        const errorObj = error as { response?: { data?: { error?: string } } };
        toast({
          title: 'Error',
          description: errorObj.response?.data?.error || 'Failed to remove document from Trust Center',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        // Reset the toggle on error
        loadData();
      }
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'EDITOR')) {
    return (
      <Box p={8} textAlign="center">
        <Text>Access denied. Admin or Editor role required.</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box p={8}>
      <Heading size="lg" mb={6}>
        Trust Center Administration
      </Heading>

      <Tabs index={tabIndex} onChange={setTabIndex}>
        <TabList>
          <Tab>Document Management</Tab>
          <Tab>Pending Requests</Tab>
          <Tab>Settings</Tab>
          <Tab>User Management</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Heading size="md">Trust Center Document Management</Heading>
              {documents.length === 0 ? (
                <Text color="gray.500">No documents found</Text>
              ) : (
                <Box overflowX="auto" ref={documentListRef} maxH="calc(100vh - 300px)" overflowY="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Document</Th>
                        <Th>Show in Trust Center</Th>
                        <Th>Access Level</Th>
                        <Th>Category</Th>
                        <Th>Public Description</Th>
                        <Th>Display Order</Th>
                        <Th>SharePoint URL</Th>
                        <Th>Requires NDA</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {documents.map((item) => {
                        const isEditing = editingDoc === item.document.id;
                        const hasSetting = !!item.trustSetting;

                        return (
                          <Tr key={item.document.id}>
                            <Td>
                              <Text fontWeight="medium" fontSize="sm">
                                {item.document.title}
                              </Text>
                            </Td>
                            <Td>
                              <Switch
                                isChecked={hasSetting}
                                onChange={(e) => handleToggleTrustCenter(item, e.target.checked)}
                                isDisabled={isEditing}
                              />
                            </Td>
                            <Td>
                              <Badge colorScheme={item.trustSetting?.visibilityLevel === 'private' ? 'purple' : 'green'}>
                                {item.trustSetting?.visibilityLevel || 'N/A'}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge>{item.trustSetting?.category || 'N/A'}</Badge>
                            </Td>
                            <Td>
                              <Text fontSize="xs" noOfLines={2} maxWidth="200px">
                                {item.trustSetting?.publicDescription || '-'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm">
                                {item.trustSetting?.displayOrder ?? '-'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="xs" noOfLines={1} maxWidth="250px" title={item.trustSetting?.sharePointUrl || ''}>
                                {item.trustSetting?.sharePointUrl ? 'Set' : '-'}
                              </Text>
                            </Td>
                            <Td>
                              <Badge colorScheme={item.trustSetting?.requiresNda ? 'orange' : 'gray'}>
                                {item.trustSetting?.requiresNda ? 'Yes' : 'No'}
                              </Badge>
                            </Td>
                            <Td>
                              <Button
                                size="sm"
                                onClick={() => handleEditDoc(item)}
                                colorScheme={hasSetting ? 'blue' : 'green'}
                              >
                                {hasSetting ? 'Edit' : 'Configure'}
                              </Button>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Heading size="md">Pending Access Requests</Heading>
              {pendingUsers.length === 0 ? (
                <Text color="gray.500">No pending requests</Text>
              ) : (
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Email</Th>
                      <Th>Company</Th>
                      <Th>Registered</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {pendingUsers.map((user) => (
                      <Tr key={user.id}>
                        <Td>{user.email}</Td>
                        <Td>{user.companyName}</Td>
                        <Td>{new Date(user.createdAt || '').toLocaleDateString()}</Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="sm"
                              colorScheme="green"
                              onClick={() => handleApproveUser(user.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="red"
                              onClick={() => handleDenyUser(user.id)}
                            >
                              Deny
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack spacing={6} align="stretch" maxW="800px">
              <Heading size="md">Trust Center Settings</Heading>

              
              <FormControl>
                <FormLabel>Watermark Prefix</FormLabel>
                <Input
                  value={settings.watermarkPrefix}
                  onChange={(e) => setSettings({ ...settings, watermarkPrefix: e.target.value })}
                  placeholder="Paythru Confidential"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  This text will appear in watermarks on private documents. Example: "Paythru Confidential - Prepared for user@example.com"
                </Text>
              </FormControl>

              <Button
                colorScheme="blue"
                onClick={handleSaveSettings}
                isLoading={settingsLoading}
                loadingText="Saving..."
              >
                Save Settings
              </Button>
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Heading size="md">User Management</Heading>
              
              {/* Filters */}
              <HStack spacing={4}>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'approved' | 'all')}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Active Status</FormLabel>
                  <Select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'revoked')}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="revoked">Revoked</option>
                  </Select>
                </FormControl>
                
                <FormControl flex={1}>
                  <FormLabel>Search</FormLabel>
                  <Input
                    placeholder="Search by email or company name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </FormControl>
              </HStack>

              {usersLoading ? (
                <Box textAlign="center" py={8}>
                  <Spinner size="xl" />
                </Box>
              ) : users.length === 0 ? (
                <Text color="gray.500">No users found</Text>
              ) : (
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Email</Th>
                        <Th>Company</Th>
                        <Th>Status</Th>
                        <Th>Active</Th>
                        <Th>Registered</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {users.map((userItem) => (
                        <Tr key={userItem.id}>
                          <Td>{userItem.email}</Td>
                          <Td>{userItem.companyName}</Td>
                          <Td>
                            <Badge colorScheme={userItem.isApproved ? 'green' : 'yellow'}>
                              {userItem.isApproved ? 'Approved' : 'Pending'}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={userItem.isActive !== false ? 'green' : 'red'}>
                              {userItem.isActive !== false ? 'Active' : 'Revoked'}
                            </Badge>
                          </Td>
                          <Td>{userItem.createdAt ? new Date(userItem.createdAt).toLocaleDateString() : '-'}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="sm"
                                onClick={() => handleViewDetails(userItem.id)}
                              >
                                View Details
                              </Button>
                              {!userItem.isApproved && (
                                <>
                                  <Button
                                    size="sm"
                                    colorScheme="green"
                                    onClick={() => handleApproveUser(userItem.id)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    colorScheme="red"
                                    onClick={() => handleDenyUser(userItem.id)}
                                  >
                                    Deny
                                  </Button>
                                </>
                              )}
                              {userItem.isApproved && (
                                <>
                                  {userItem.isActive !== false ? (
                                    <Button
                                      size="sm"
                                      colorScheme="orange"
                                      onClick={() => handleRevokeAccess(userItem.id)}
                                    >
                                      Revoke Access
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      colorScheme="green"
                                      onClick={() => handleRestoreAccess(userItem.id)}
                                    >
                                      Restore Access
                                    </Button>
                                  )}
                                </>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleCancelEdit} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Configure Trust Center Settings
            {editingDocument && (
              <Text fontSize="sm" fontWeight="normal" color="gray.500" mt={1}>
                {editingDocument.document.title}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Access Level</FormLabel>
                <Select
                  value={editData.visibilityLevel || 'public'}
                  onChange={(e) =>
                    setEditData({ ...editData, visibilityLevel: e.target.value as 'public' | 'private' })
                  }
                >
                  <option value="public">Public - Visible to anyone</option>
                  <option value="private">Private - Only approved external users</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  value={editData.category || 'policy'}
                  onChange={(e) =>
                    setEditData({ ...editData, category: e.target.value as 'certification' | 'policy' | 'report' })
                  }
                >
                  <option value="certification">Certification</option>
                  <option value="policy">Policy</option>
                  <option value="report">Report</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Public Description</FormLabel>
                <Textarea
                  value={editData.publicDescription || ''}
                  onChange={(e) =>
                    setEditData({ ...editData, publicDescription: e.target.value })
                  }
                  placeholder="Description shown to external users (optional)"
                  rows={3}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  This description will be visible to external users in the Trust Center
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Display Order</FormLabel>
                <NumberInput
                  value={editData.displayOrder || ''}
                  onChange={(_, value) =>
                    setEditData({ ...editData, displayOrder: isNaN(value) ? undefined : value })
                  }
                >
                  <NumberInputField placeholder="Optional" />
                </NumberInput>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Lower numbers appear first. Leave empty for default ordering.
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>SharePoint URL Override</FormLabel>
                <Input
                  value={editData.sharePointUrl || ''}
                  onChange={(e) =>
                    setEditData({ ...editData, sharePointUrl: e.target.value })
                  }
                  placeholder="Override SharePoint URL (optional)"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  If not provided, uses the document's default SharePoint location
                </Text>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Requires NDA / Terms Acceptance</FormLabel>
                <Switch
                  isChecked={editData.requiresNda || false}
                  onChange={(e) => setEditData({ ...editData, requiresNda: e.target.checked })}
                />
              </FormControl>
              <Text fontSize="xs" color="gray.500">
                If enabled, external users must accept terms before downloading this document
              </Text>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => editingDoc && handleSaveDoc(editingDoc)}
            >
              Save Settings
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* User Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>User Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {userDetailsLoading ? (
              <Box textAlign="center" py={8}>
                <Spinner size="xl" />
              </Box>
            ) : userDetails ? (
              <VStack spacing={4} align="stretch">
                <Heading size="sm">Basic Information</Heading>
                <Box>
                  <Text fontWeight="bold">Email:</Text>
                  <Text>{userDetails.email}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Company:</Text>
                  <Text>{userDetails.companyName}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Registration Date:</Text>
                  <Text>{new Date(userDetails.createdAt || '').toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Approval Status:</Text>
                  <Badge colorScheme={userDetails.isApproved ? 'green' : 'yellow'}>
                    {userDetails.isApproved ? 'Approved' : 'Pending'}
                  </Badge>
                </Box>
                <Box>
                  <Text fontWeight="bold">Active Status:</Text>
                  <Badge colorScheme={userDetails.isActive !== false ? 'green' : 'red'}>
                    {userDetails.isActive !== false ? 'Active' : 'Revoked'}
                  </Badge>
                </Box>

                <Heading size="sm" mt={4}>Activity Summary</Heading>
                <Box>
                  <Text fontWeight="bold">Last Login:</Text>
                  <Text>{userDetails.lastLoginDate ? new Date(userDetails.lastLoginDate).toLocaleString() : 'Never'}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Total Downloads:</Text>
                  <Text>{userDetails.totalDownloads}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Approval Date:</Text>
                  <Text>{userDetails.approvalDate ? new Date(userDetails.approvalDate).toLocaleString() : 'Not approved'}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Approved By:</Text>
                  <Text>{userDetails.approvedBy || 'N/A'}</Text>
                </Box>
              </VStack>
            ) : (
              <Text>No user details available</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onDetailsClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

