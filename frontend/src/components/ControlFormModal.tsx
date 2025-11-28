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
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface ControlFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  control: any;
}

export function ControlFormModal({ isOpen, onClose, control }: ControlFormModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    selectedForContractualObligation: false,
    selectedForLegalRequirement: false,
    selectedForBusinessRequirement: false,
    justification: '',
  });
  const [loading, setLoading] = useState(false);
  const isStandardControl = control?.isStandardControl || false;

  useEffect(() => {
    if (control) {
      setFormData({
        code: control.code || '',
        title: control.title || '',
        description: control.description || '',
        selectedForContractualObligation: control.selectedForContractualObligation || false,
        selectedForLegalRequirement: control.selectedForLegalRequirement || false,
        selectedForBusinessRequirement: control.selectedForBusinessRequirement || false,
        justification: control.justification || '',
      });
    } else {
      setFormData({
        code: '',
        title: '',
        description: '',
        selectedForContractualObligation: false,
        selectedForLegalRequirement: false,
        selectedForBusinessRequirement: false,
        justification: '',
      });
    }
  }, [control]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = { ...formData };
      if (payload.description === '') delete payload.description;
      if (payload.justification === '') delete payload.justification;

      if (control) {
        await api.put(`/api/controls/${control.id}`, payload);
      } else {
        await api.post('/api/controls', payload);
      }

      onClose();
    } catch (error) {
      console.error('Error saving control:', error);
      alert('Failed to save control');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            {control ? (isStandardControl ? 'View Standard Control' : 'Edit Control') : 'Create Control'}
            {isStandardControl && (
              <Badge colorScheme="green" ml={2}>ISO 27002 Standard</Badge>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
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
                                to={`/risks`}
                                onClick={() => {
                                  // Store risk ID to highlight it when risks page loads
                                  sessionStorage.setItem('highlightRiskId', riskControl.risk.id);
                                }}
                                style={{ textDecoration: 'none' }}
                              >
                                <HStack spacing={2}>
                                  <Badge colorScheme="blue" fontSize="xs">
                                    {riskControl.risk.externalId || 'Risk'}
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
                  <FormControl isRequired>
                    <FormLabel>Code</FormLabel>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="5.1 or A.8.3"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
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
                                to={`/risks`}
                                onClick={() => {
                                  // Store risk ID to highlight it when risks page loads
                                  sessionStorage.setItem('highlightRiskId', riskControl.risk.id);
                                }}
                                style={{ textDecoration: 'none' }}
                              >
                                <HStack spacing={2}>
                                  <Badge colorScheme="blue" fontSize="xs">
                                    {riskControl.risk.externalId || 'Risk'}
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

              <FormControl>
                <FormLabel>Justification</FormLabel>
                <Textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  placeholder="Reason for applicability or non-applicability"
                  isDisabled={isStandardControl && !control}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
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
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

