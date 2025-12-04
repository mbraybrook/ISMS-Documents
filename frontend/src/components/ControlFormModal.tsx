import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Textarea,
  Checkbox,
  Select,
  Box,
  Divider,
  Badge,
  FormErrorMessage,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Text,
} from '@chakra-ui/react';
import { useRef } from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { supplierApi } from '../services/api';
import { DeleteIcon, AddIcon } from '@chakra-ui/icons';

interface ControlFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  control: any;
}

export function ControlFormModal({ isOpen, onClose, control }: ControlFormModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isSupplierModalOpen, onOpen: onSupplierModalOpen, onClose: onSupplierModalClose } = useDisclosure();
  const cancelRef = useRef(null);
  const [linkedSuppliers, setLinkedSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [linkingSupplier, setLinkingSupplier] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    category: '',
    isStandardControl: false,
    selectedForContractualObligation: false,
    selectedForLegalRequirement: false,
    selectedForBusinessRequirement: false,
    justification: '',
    implemented: false,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const isStandardControl = control?.isStandardControl || false;

  useEffect(() => {
    if (control) {
      setFormData({
        code: control.code || '',
        title: control.title || '',
        description: control.description || '',
        category: control.category || '',
        isStandardControl: control.isStandardControl || false,
        selectedForContractualObligation: control.selectedForContractualObligation || false,
        selectedForLegalRequirement: control.selectedForLegalRequirement || false,
        selectedForBusinessRequirement: control.selectedForBusinessRequirement || false,
        justification: control.justification || '',
        implemented: control.implemented || false,
      });
      fetchLinkedSuppliers();
    } else {
      setFormData({
        code: '',
        title: '',
        description: '',
        category: '',
        isStandardControl: false,
        selectedForContractualObligation: false,
        selectedForLegalRequirement: false,
        selectedForBusinessRequirement: false,
        justification: '',
        implemented: false,
      });
      setLinkedSuppliers([]);
    }
    setErrors({});
  }, [control]);

  const fetchLinkedSuppliers = async () => {
    if (!control?.id) return;
    try {
      setLoadingSuppliers(true);
      const suppliers = await api.get(`/api/controls/${control.id}/suppliers`);
      setLinkedSuppliers(suppliers.data);
    } catch (error: any) {
      console.error('Error fetching linked suppliers:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const searchSuppliers = async () => {
    if (!supplierSearchTerm.trim()) {
      setAvailableSuppliers([]);
      return;
    }

    try {
      setSearchingSuppliers(true);
      const response = await supplierApi.getSuppliers({ search: supplierSearchTerm });
      // Filter out suppliers already linked
      const linkedSupplierIds = new Set(linkedSuppliers.map((s) => s.id));
      setAvailableSuppliers(response.filter((s: any) => !linkedSupplierIds.has(s.id)));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search suppliers',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingSuppliers(false);
    }
  };

  const handleLinkSupplier = async (supplierId: string) => {
    if (!control?.id) return;
    try {
      setLinkingSupplier(true);
      await api.post(`/api/controls/${control.id}/suppliers`, { supplierId });
      toast({
        title: 'Success',
        description: 'Supplier linked successfully',
        status: 'success',
        duration: 3000,
      });
      onSupplierModalClose();
      setSupplierSearchTerm('');
      setAvailableSuppliers([]);
      fetchLinkedSuppliers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link supplier',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingSupplier(false);
    }
  };

  const handleUnlinkSupplier = async (supplierId: string) => {
    if (!control?.id) return;
    try {
      await api.delete(`/api/suppliers/${supplierId}/controls/${control.id}`);
      toast({
        title: 'Success',
        description: 'Supplier unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchLinkedSuppliers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to unlink supplier',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!isStandardControl) {
      if (!formData.code.trim()) {
        newErrors.code = 'Code is required';
      }
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      }
      if (!control && !formData.category) {
        newErrors.category = 'Category is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let payload: any;
      
      if (isStandardControl && control) {
        // For standard controls, only send allowed fields
        payload = {
          selectedForContractualObligation: formData.selectedForContractualObligation,
          selectedForLegalRequirement: formData.selectedForLegalRequirement,
          selectedForBusinessRequirement: formData.selectedForBusinessRequirement,
          justification: formData.justification || null,
          implemented: formData.implemented,
        };
      } else {
        // For custom controls, send all fields
        payload = { ...formData };
        if (payload.description === '') delete payload.description;
        if (payload.justification === '') delete payload.justification;
        if (!payload.category) delete payload.category;
      }

      if (control) {
        await api.put(`/api/controls/${control.id}`, payload);
        toast({
          title: 'Control updated',
          description: isStandardControl 
            ? 'Control applicability updated successfully'
            : 'Control updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await api.post('/api/controls', payload);
        toast({
          title: 'Control created',
          description: 'Control created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving control:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to save control';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!control || isStandardControl) return;

    setDeleting(true);
    try {
      await api.delete(`/api/controls/${control.id}`);
      toast({
        title: 'Control deleted',
        description: 'Control deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onDeleteClose();
      onClose();
    } catch (error: any) {
      console.error('Error deleting control:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete control',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh" display="flex" flexDirection="column" overflow="hidden">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <ModalHeader flexShrink={0}>
            {control ? (isStandardControl ? 'View Standard Control' : 'Edit Control') : 'Create Control'}
            {isStandardControl && (
              <Badge colorScheme="green" ml={2}>ISO 27002 Standard</Badge>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" flex="1" pb={6} minH={0}>
            <VStack spacing={4} align="stretch">
              {isStandardControl && control && (
                <>
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <FormLabel fontWeight="bold">Control Code</FormLabel>
                        <Box>{control.code}</Box>
                      </Box>
                      <Box>
                        <FormLabel fontWeight="bold">Title</FormLabel>
                        <Box>{control.title}</Box>
                      </Box>
                      {control.category && (
                        <Box>
                          <FormLabel fontWeight="bold">Category</FormLabel>
                          <Badge colorScheme={
                            control.category === 'ORGANIZATIONAL' ? 'blue' :
                            control.category === 'PEOPLE' ? 'purple' :
                            control.category === 'PHYSICAL' ? 'orange' :
                            'teal'
                          }>
                            {control.category}
                          </Badge>
                        </Box>
                      )}
                    </VStack>
                  </Box>

                  {control.controlText && (
                    <Box>
                      <FormLabel fontWeight="bold">Control</FormLabel>
                      <Box p={3} bg="white" border="1px" borderColor="gray.200" borderRadius="md" whiteSpace="pre-wrap">
                        {control.controlText}
                      </Box>
                    </Box>
                  )}

                  {control.purpose && (
                    <Box>
                      <FormLabel fontWeight="bold">Purpose</FormLabel>
                      <Box p={3} bg="white" border="1px" borderColor="gray.200" borderRadius="md" whiteSpace="pre-wrap">
                        {control.purpose}
                      </Box>
                    </Box>
                  )}

                  {control.guidance && (
                    <Box>
                      <FormLabel fontWeight="bold">Guidance</FormLabel>
                      <Box p={3} bg="white" border="1px" borderColor="gray.200" borderRadius="md" whiteSpace="pre-wrap" maxH="300px" overflowY="auto">
                        {control.guidance}
                      </Box>
                    </Box>
                  )}

                  {control.otherInformation && (
                    <Box>
                      <FormLabel fontWeight="bold">Other Information</FormLabel>
                      <Box p={3} bg="white" border="1px" borderColor="gray.200" borderRadius="md" whiteSpace="pre-wrap">
                        {control.otherInformation}
                      </Box>
                    </Box>
                  )}

                  <Divider />
                  <Box>
                    <FormLabel fontWeight="bold" color="blue.600">Selection Reasons for Statement of Applicability</FormLabel>
                  </Box>

                  <Box p={3} bg="blue.50" border="1px" borderColor="blue.200" borderRadius="md">
                    <FormControl>
                      <Checkbox
                        isChecked={control.selectedForRiskAssessment || false}
                        isDisabled={true}
                      >
                        Risk Assessment
                      </Checkbox>
                      <Box fontSize="sm" color="gray.600" mt={1} ml={6}>
                        Automatically set when control is linked to identified risks
                      </Box>
                    </FormControl>
                    
                    {control.riskControls && control.riskControls.length > 0 && (
                      <Box mt={4} pt={3} borderTop="1px" borderColor="blue.300">
                        <FormLabel fontWeight="semibold" fontSize="sm" mb={2}>
                          Linked Risks ({control.riskControls.length}):
                        </FormLabel>
                        <VStack align="stretch" spacing={2}>
                          {control.riskControls.map((riskControl) => (
                            <Box
                              key={riskControl.risk.id}
                              p={2}
                              bg="white"
                              borderRadius="md"
                              border="1px"
                              borderColor="blue.200"
                              _hover={{ bg: "blue.100", borderColor: "blue.400" }}
                            >
                              <Link
                                to={`/risks/risks`}
                                onClick={() => {
                                  // Store risk ID to highlight it when risks page loads
                                  sessionStorage.setItem('highlightRiskId', riskControl.risk.id);
                                }}
                                style={{ textDecoration: 'none' }}
                              >
                                <HStack spacing={2}>
                                  <Badge colorScheme="blue" fontSize="xs">
                                    Risk
                                  </Badge>
                                  <Box fontWeight="medium" color="blue.700" _hover={{ textDecoration: "underline" }}>
                                    {riskControl.risk.title}
                                  </Box>
                                </HStack>
                              </Link>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </>
              )}

              {!isStandardControl && (
                <>
                  <FormControl isRequired isInvalid={!!errors.code}>
                    <FormLabel>Code</FormLabel>
                    <Input
                      value={formData.code}
                      onChange={(e) => {
                        setFormData({ ...formData, code: e.target.value });
                        if (errors.code) setErrors({ ...errors, code: '' });
                      }}
                      placeholder="5.1 or A.8.3"
                    />
                    {errors.code && <FormErrorMessage>{errors.code}</FormErrorMessage>}
                  </FormControl>

                  <FormControl isRequired isInvalid={!!errors.title}>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        if (errors.title) setErrors({ ...errors, title: '' });
                      }}
                    />
                    {errors.title && <FormErrorMessage>{errors.title}</FormErrorMessage>}
                  </FormControl>

                  <FormControl isRequired={!control} isInvalid={!!errors.category}>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({ ...formData, category: e.target.value });
                        if (errors.category) setErrors({ ...errors, category: '' });
                      }}
                      placeholder="Select category"
                    >
                      <option value="ORGANIZATIONAL">Organizational</option>
                      <option value="PEOPLE">People</option>
                      <option value="PHYSICAL">Physical</option>
                      <option value="TECHNOLOGICAL">Technological</option>
                    </Select>
                    {errors.category && <FormErrorMessage>{errors.category}</FormErrorMessage>}
                  </FormControl>

                  <FormControl>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={formData.isStandardControl ? 'Standard' : 'Custom'}
                      isDisabled
                    >
                      <option value="Custom">Custom</option>
                      <option value="Standard">Standard</option>
                    </Select>
                    <Box fontSize="sm" color="gray.600" mt={1}>
                      Custom controls are user-created
                    </Box>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </FormControl>

                  <Divider />
                  <Box>
                    <FormLabel fontWeight="bold" color="blue.600">Selection Reasons for Statement of Applicability</FormLabel>
                  </Box>

                  <Box p={3} bg="blue.50" border="1px" borderColor="blue.200" borderRadius="md">
                    <FormControl>
                      <Checkbox
                        isChecked={control?.selectedForRiskAssessment || false}
                        isDisabled={true}
                      >
                        Risk Assessment
                      </Checkbox>
                      <Box fontSize="sm" color="gray.600" mt={1} ml={6}>
                        Automatically set when control is linked to identified risks
                      </Box>
                    </FormControl>
                    
                    {control?.riskControls && control.riskControls.length > 0 && (
                      <Box mt={4} pt={3} borderTop="1px" borderColor="blue.300">
                        <FormLabel fontWeight="semibold" fontSize="sm" mb={2}>
                          Linked Risks ({control.riskControls.length}):
                        </FormLabel>
                        <VStack align="stretch" spacing={2}>
                          {control.riskControls.map((riskControl) => (
                            <Box
                              key={riskControl.risk.id}
                              p={2}
                              bg="white"
                              borderRadius="md"
                              border="1px"
                              borderColor="blue.200"
                              _hover={{ bg: "blue.100", borderColor: "blue.400" }}
                            >
                              <Link
                                to={`/risks/risks`}
                                onClick={() => {
                                  // Store risk ID to highlight it when risks page loads
                                  sessionStorage.setItem('highlightRiskId', riskControl.risk.id);
                                }}
                                style={{ textDecoration: 'none' }}
                              >
                                <HStack spacing={2}>
                                  <Badge colorScheme="blue" fontSize="xs">
                                    Risk
                                  </Badge>
                                  <Box fontWeight="medium" color="blue.700" _hover={{ textDecoration: "underline" }}>
                                    {riskControl.risk.title}
                                  </Box>
                                </HStack>
                              </Link>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </>
              )}

              <FormControl>
                <Checkbox
                  isChecked={formData.selectedForContractualObligation}
                  onChange={(e) =>
                    setFormData({ ...formData, selectedForContractualObligation: e.target.checked })
                  }
                  isDisabled={isStandardControl && !control}
                >
                  Contractual Obligation
                </Checkbox>
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={formData.selectedForLegalRequirement}
                  onChange={(e) =>
                    setFormData({ ...formData, selectedForLegalRequirement: e.target.checked })
                  }
                  isDisabled={isStandardControl && !control}
                >
                  Legal Requirement
                </Checkbox>
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={formData.selectedForBusinessRequirement}
                  onChange={(e) =>
                    setFormData({ ...formData, selectedForBusinessRequirement: e.target.checked })
                  }
                  isDisabled={isStandardControl && !control}
                >
                  Business Requirement/Best Practice
                </Checkbox>
              </FormControl>

              <Divider />

              <FormControl>
                <Checkbox
                  isChecked={formData.implemented}
                  onChange={(e) =>
                    setFormData({ ...formData, implemented: e.target.checked })
                  }
                >
                  Implemented
                </Checkbox>
                <Box fontSize="sm" color="gray.600" mt={1} ml={6}>
                  Mark this control as implemented
                </Box>
              </FormControl>

              <FormControl>
                <FormLabel>Justification</FormLabel>
                <Textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  placeholder="Reason for applicability or non-applicability"
                  isDisabled={isStandardControl && !control}
                />
              </FormControl>

              {control && (
                <>
                  <Divider />
                  <Box>
                    <HStack justify="space-between" mb={2}>
                      <FormLabel fontWeight="bold" color="blue.600">
                        Linked Suppliers ({linkedSuppliers.length})
                      </FormLabel>
                      <Button
                        leftIcon={<AddIcon />}
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        onClick={onSupplierModalOpen}
                      >
                        Link Supplier
                      </Button>
                    </HStack>
                    {loadingSuppliers ? (
                      <Text color="gray.500">Loading suppliers...</Text>
                    ) : linkedSuppliers.length === 0 ? (
                      <Text color="gray.500" fontStyle="italic">
                        No suppliers linked to this control
                      </Text>
                    ) : (
                      <VStack align="stretch" spacing={2}>
                        {linkedSuppliers.map((supplier) => (
                          <Box
                            key={supplier.id}
                            p={2}
                            bg="white"
                            borderRadius="md"
                            border="1px"
                            borderColor="blue.200"
                            _hover={{ bg: "blue.100", borderColor: "blue.400" }}
                          >
                            <HStack justify="space-between">
                              <Link
                                to={`/admin/suppliers/${supplier.id}`}
                                style={{ textDecoration: 'none', flex: 1 }}
                              >
                                <HStack spacing={2}>
                                  <Badge colorScheme="purple" fontSize="xs">
                                    Supplier
                                  </Badge>
                                  <Box fontWeight="medium" color="blue.700" _hover={{ textDecoration: "underline" }}>
                                    {supplier.name}
                                  </Box>
                                </HStack>
                              </Link>
                              <IconButton
                                aria-label="Unlink supplier"
                                icon={<DeleteIcon />}
                                size="xs"
                                colorScheme="red"
                                variant="ghost"
                                onClick={() => handleUnlinkSupplier(supplier.id)}
                              />
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    )}
                  </Box>
                </>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter flexShrink={0}>
            <HStack spacing={3}>
              {!isStandardControl && control && (
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={onDeleteOpen}
                  mr="auto"
                >
                  Delete
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                {isStandardControl ? 'Close' : 'Cancel'}
              </Button>
              {!isStandardControl && (
                <Button colorScheme="blue" type="submit" isLoading={loading}>
                  {control ? 'Update' : 'Create'}
                </Button>
              )}
              {isStandardControl && control && (
                <Button colorScheme="blue" type="submit" isLoading={loading}>
                  Update Applicability
                </Button>
              )}
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Control
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete control "{control?.code}: {control?.title}"? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3} isLoading={deleting}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Link Supplier Modal */}
      <Modal isOpen={isSupplierModalOpen} onClose={onSupplierModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Link Supplier to Control</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Input
                placeholder="Search suppliers by name..."
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchSuppliers();
                  }
                }}
              />
              <Button onClick={searchSuppliers} isLoading={searchingSuppliers} size="sm">
                Search
              </Button>

              {availableSuppliers.length > 0 && (
                <Box maxH="400px" overflowY="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Type</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {availableSuppliers.map((supplier) => (
                        <Tr key={supplier.id}>
                          <Td>{supplier.name}</Td>
                          <Td>{supplier.supplierType?.replace(/_/g, ' ')}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              onClick={() => handleLinkSupplier(supplier.id)}
                              isLoading={linkingSupplier}
                            >
                              Link
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}

              {supplierSearchTerm && availableSuppliers.length === 0 && !searchingSuppliers && (
                <Text color="gray.500" fontStyle="italic">
                  No suppliers found
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSupplierModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Modal>
  );
}

