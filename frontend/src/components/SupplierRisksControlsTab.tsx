import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useToast,
  Alert,
  AlertIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Input,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Tooltip,
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { supplierApi } from '../services/api';
import api from '../services/api';

interface Risk {
  id: string;
  title: string;
  calculatedScore: number;
  status: string;
  riskCategory: string | null;
  similarityScore?: number;
  matchedFields?: string[];
}

interface Control {
  id: string;
  code: string;
  title: string;
  implemented: boolean;
  category: string | null;
}

interface SupplierRisksControlsTabProps {
  supplierId: string;
  canEdit: boolean;
  criticality: string | null;
}

export function SupplierRisksControlsTab({
  supplierId,
  canEdit,
  criticality,
}: SupplierRisksControlsTabProps) {
  const toast = useToast();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingRisk, setLinkingRisk] = useState(false);
  const [linkingControl, setLinkingControl] = useState(false);
  const [aiSuggestedRisks, setAiSuggestedRisks] = useState<Risk[]>([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState<string | null>(null);
  
  const {
    isOpen: isRiskModalOpen,
    onOpen: onRiskModalOpen,
    onClose: onRiskModalClose,
  } = useDisclosure();
  const {
    isOpen: isControlModalOpen,
    onOpen: onControlModalOpen,
    onClose: onControlModalClose,
  } = useDisclosure();

  const [riskSearchTerm, setRiskSearchTerm] = useState('');
  const [controlSearchTerm, setControlSearchTerm] = useState('');
  const [availableRisks, setAvailableRisks] = useState<Risk[]>([]);
  const [availableControls, setAvailableControls] = useState<Control[]>([]);
  const [searchingRisks, setSearchingRisks] = useState(false);
  const [searchingControls, setSearchingControls] = useState(false);

  useEffect(() => {
    fetchRisksAndControls();
  }, [supplierId]);

  const fetchRisksAndControls = async () => {
    try {
      setLoading(true);
      const [risksData, controlsData] = await Promise.all([
        supplierApi.getSupplierRisks(supplierId),
        supplierApi.getSupplierControls(supplierId),
      ]);
      setRisks(risksData);
      setControls(controlsData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load risks and controls',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const searchRisks = async () => {
    if (!riskSearchTerm.trim()) {
      setAvailableRisks([]);
      return;
    }

    try {
      setSearchingRisks(true);
      const response = await api.get('/api/risks', {
        params: {
          search: riskSearchTerm,
          limit: 20,
          status: 'ACTIVE',
        },
      });
      // Filter out risks already linked
      const linkedRiskIds = new Set(risks.map((r) => r.id));
      setAvailableRisks(
        response.data.data.filter((r: Risk) => !linkedRiskIds.has(r.id))
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search risks',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingRisks(false);
    }
  };

  const searchControls = async () => {
    if (!controlSearchTerm.trim()) {
      setAvailableControls([]);
      return;
    }

    try {
      setSearchingControls(true);
      const response = await api.get('/api/controls', {
        params: {
          limit: 20,
        },
      });
      // Filter out controls already linked
      const linkedControlIds = new Set(controls.map((c) => c.id));
      setAvailableControls(
        response.data.data.filter((c: Control) => !linkedControlIds.has(c.id))
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to search controls',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSearchingControls(false);
    }
  };

  const handleLinkRisk = async (riskId: string) => {
    try {
      setLinkingRisk(true);
      await supplierApi.linkSupplierRisk(supplierId, riskId);
      toast({
        title: 'Success',
        description: 'Risk linked successfully',
        status: 'success',
        duration: 3000,
      });
      // Refresh risks and controls, and remove linked risk from AI suggestions
      await fetchRisksAndControls();
      setAiSuggestedRisks(aiSuggestedRisks.filter((r) => r.id !== riskId));
      setRiskSearchTerm('');
      setAvailableRisks([]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link risk',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingRisk(false);
    }
  };

  const handleUnlinkRisk = async (riskId: string) => {
    try {
      await supplierApi.unlinkSupplierRisk(supplierId, riskId);
      toast({
        title: 'Success',
        description: 'Risk unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchRisksAndControls();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to unlink risk',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchAiSuggestions = async () => {
    try {
      setLoadingAiSuggestions(true);
      setAiSuggestionsError(null);
      const response = await supplierApi.suggestRisksForSupplier(supplierId);
      
      // Filter out already-linked risks
      const linkedRiskIds = new Set(risks.map((r) => r.id));
      const filteredSuggestions = response.suggestions
        .filter((suggestion: any) => !linkedRiskIds.has(suggestion.risk.id))
        .map((suggestion: any) => ({
          ...suggestion.risk,
          similarityScore: suggestion.similarityScore,
          matchedFields: suggestion.matchedFields,
        }));
      
      setAiSuggestedRisks(filteredSuggestions);
    } catch (error: any) {
      console.error('Error fetching AI suggestions:', error);
      setAiSuggestionsError(error.response?.data?.error || 'Failed to fetch AI suggestions');
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch AI suggestions',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const handleLinkControl = async (controlId: string) => {
    try {
      setLinkingControl(true);
      await supplierApi.linkSupplierControl(supplierId, controlId);
      toast({
        title: 'Success',
        description: 'Control linked successfully',
        status: 'success',
        duration: 3000,
      });
      onControlModalClose();
      setControlSearchTerm('');
      setAvailableControls([]);
      fetchRisksAndControls();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link control',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLinkingControl(false);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    try {
      await supplierApi.unlinkSupplierControl(supplierId, controlId);
      toast({
        title: 'Success',
        description: 'Control unlinked successfully',
        status: 'success',
        duration: 3000,
      });
      fetchRisksAndControls();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to unlink control',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getRiskLevel = (score: number): string => {
    if (score >= 15) return 'HIGH';
    if (score >= 8) return 'MEDIUM';
    return 'LOW';
  };

  const getRiskLevelColor = (score: number): string => {
    const level = getRiskLevel(score);
    if (level === 'HIGH') return 'red';
    if (level === 'MEDIUM') return 'orange';
    return 'green';
  };

  if (loading) {
    return (
      <Center py={8}>
        <Spinner size="xl" />
      </Center>
    );
  }

  const showWarning = criticality === 'HIGH' && (risks.length === 0 || controls.length === 0);

  return (
    <VStack spacing={6} align="stretch">
      {showWarning && (
        <Alert status="warning">
          <AlertIcon />
          High criticality suppliers should have linked risks and controls for proper risk management.
        </Alert>
      )}

      {/* Linked Risks Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Linked Risks</Heading>
          {canEdit && (
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              size="sm"
              onClick={onRiskModalOpen}
            >
              Link Risk
            </Button>
          )}
        </HStack>

        {risks.length === 0 ? (
          <Text color="gray.500" fontStyle="italic">
            No risks linked to this supplier
          </Text>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Title</Th>
                <Th>Risk Score</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                {canEdit && <Th>Actions</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {risks.map((risk) => (
                <Tr key={risk.id}>
                  <Td>{risk.id.substring(0, 8)}...</Td>
                  <Td>{risk.title}</Td>
                  <Td>
                    <Badge colorScheme={getRiskLevelColor(risk.calculatedScore)}>
                      {risk.calculatedScore} ({getRiskLevel(risk.calculatedScore)})
                    </Badge>
                  </Td>
                  <Td>{risk.status}</Td>
                  <Td>{risk.riskCategory || 'N/A'}</Td>
                  {canEdit && (
                    <Td>
                      <IconButton
                        aria-label="Unlink risk"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleUnlinkRisk(risk.id)}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Linked Controls</Heading>
          {canEdit && (
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              size="sm"
              onClick={onControlModalOpen}
            >
              Link Control
            </Button>
          )}
        </HStack>

        {controls.length === 0 ? (
          <Text color="gray.500" fontStyle="italic">
            No controls linked to this supplier
          </Text>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Implemented</Th>
                <Th>Category</Th>
                {canEdit && <Th>Actions</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {controls.map((control) => (
                <Tr key={control.id}>
                  <Td>{control.code}</Td>
                  <Td>{control.title}</Td>
                  <Td>
                    <Badge colorScheme={control.implemented ? 'green' : 'red'}>
                      {control.implemented ? 'Yes' : 'No'}
                    </Badge>
                  </Td>
                  <Td>{control.category || 'N/A'}</Td>
                  {canEdit && (
                    <Td>
                      <IconButton
                        aria-label="Unlink control"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleUnlinkControl(control.id)}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Link Risk Modal */}
      <Modal isOpen={isRiskModalOpen} onClose={onRiskModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Link Risk to Supplier</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs>
              <TabList>
                <Tab>AI Suggestions</Tab>
                <Tab>Search</Tab>
              </TabList>
              <TabPanels>
                {/* AI Suggestions Tab */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Alert status="info">
                      <AlertIcon />
                      <Box>
                        <Text fontSize="sm">
                          AI suggestions use semantic similarity to find relevant risks based on your supplier's service description, risk rationale, and criticality rationale.
                        </Text>
                      </Box>
                    </Alert>
                    <Button
                      onClick={fetchAiSuggestions}
                      isLoading={loadingAiSuggestions}
                      colorScheme="blue"
                      leftIcon={<AddIcon />}
                    >
                      Find Relevant Risks
                    </Button>

                    {aiSuggestionsError && (
                      <Alert status="error">
                        <AlertIcon />
                        {aiSuggestionsError}
                      </Alert>
                    )}

                    {loadingAiSuggestions && (
                      <Center py={8}>
                        <Spinner size="lg" />
                      </Center>
                    )}

                    {!loadingAiSuggestions && aiSuggestedRisks.length > 0 && (
                      <Box maxH="400px" overflowY="auto">
                        <Table variant="simple" size="sm">
                          <Thead>
                            <Tr>
                              <Th>Title</Th>
                              <Th>Similarity</Th>
                              <Th>Matched Fields</Th>
                              <Th>Score</Th>
                              <Th>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {aiSuggestedRisks.map((risk) => (
                              <Tr key={risk.id}>
                                <Td>{risk.title}</Td>
                                <Td>
                                  <Badge
                                    colorScheme={
                                      risk.similarityScore && risk.similarityScore >= 80
                                        ? 'green'
                                        : risk.similarityScore && risk.similarityScore >= 60
                                        ? 'orange'
                                        : 'gray'
                                    }
                                  >
                                    {risk.similarityScore}%
                                  </Badge>
                                </Td>
                                <Td>
                                  {risk.matchedFields && risk.matchedFields.length > 0 ? (
                                    <Text fontSize="xs" color="gray.600">
                                      {risk.matchedFields.join(', ')}
                                    </Text>
                                  ) : (
                                    <Text fontSize="xs" color="gray.400">
                                      Semantic match
                                    </Text>
                                  )}
                                </Td>
                                <Td>
                                  <Badge colorScheme={getRiskLevelColor(risk.calculatedScore)}>
                                    {risk.calculatedScore}
                                  </Badge>
                                </Td>
                                <Td>
                                  <Button
                                    size="xs"
                                    colorScheme="blue"
                                    onClick={() => handleLinkRisk(risk.id)}
                                    isLoading={linkingRisk}
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

                    {!loadingAiSuggestions && aiSuggestedRisks.length === 0 && !aiSuggestionsError && (
                      <Box textAlign="center" py={8} color="gray.500">
                        <Text>Click "Find Relevant Risks" to get AI-powered suggestions</Text>
                      </Box>
                    )}
                  </VStack>
                </TabPanel>

                {/* Search Tab */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Input
                      placeholder="Search risks by title..."
                      value={riskSearchTerm}
                      onChange={(e) => setRiskSearchTerm(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          searchRisks();
                        }
                      }}
                    />
                    <Button onClick={searchRisks} isLoading={searchingRisks} size="sm">
                      Search
                    </Button>

                    {availableRisks.length > 0 && (
                      <Box maxH="400px" overflowY="auto">
                        <Table variant="simple" size="sm">
                          <Thead>
                            <Tr>
                              <Th>Title</Th>
                              <Th>Score</Th>
                              <Th>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {availableRisks.map((risk) => (
                              <Tr key={risk.id}>
                                <Td>{risk.title}</Td>
                                <Td>
                                  <Badge colorScheme={getRiskLevelColor(risk.calculatedScore)}>
                                    {risk.calculatedScore}
                                  </Badge>
                                </Td>
                                <Td>
                                  <Button
                                    size="xs"
                                    colorScheme="blue"
                                    onClick={() => handleLinkRisk(risk.id)}
                                    isLoading={linkingRisk}
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
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onRiskModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Link Control Modal */}
      <Modal isOpen={isControlModalOpen} onClose={onControlModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Link Control to Supplier</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Input
                placeholder="Search controls by code or title..."
                value={controlSearchTerm}
                onChange={(e) => setControlSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchControls();
                  }
                }}
              />
              <Button onClick={searchControls} isLoading={searchingControls} size="sm">
                Search
              </Button>

              {availableControls.length > 0 && (
                <Box maxH="400px" overflowY="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Code</Th>
                        <Th>Title</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {availableControls.map((control) => (
                        <Tr key={control.id}>
                          <Td>{control.code}</Td>
                          <Td>{control.title}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              onClick={() => handleLinkControl(control.id)}
                              isLoading={linkingControl}
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

              {controlSearchTerm && availableControls.length === 0 && !searchingControls && (
                <Text color="gray.500" fontStyle="italic">
                  No controls found
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onControlModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

