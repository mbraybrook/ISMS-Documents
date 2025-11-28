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
  Badge,
  useDisclosure,
  Select,
} from '@chakra-ui/react';
import api from '../services/api';
import { ControlFormModal } from '../components/ControlFormModal';

interface Control {
  id: string;
  code: string;
  title: string;
  description: string | null;
  selectedForRiskAssessment: boolean;
  selectedForContractualObligation: boolean;
  selectedForLegalRequirement: boolean;
  selectedForBusinessRequirement: boolean;
  justification: string | null;
  controlText: string | null;
  purpose: string | null;
  guidance: string | null;
  otherInformation: string | null;
  category: string | null;
  isStandardControl: boolean;
  riskControls: Array<{
    risk: {
      id: string;
      title: string;
      externalId: string | null;
    };
  }>;
  documentControls: Array<{
    document: {
      id: string;
      title: string;
      version: string;
    };
  }>;
}

export function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApplicable, setFilterApplicable] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);

  useEffect(() => {
    fetchControls();
  }, [filterApplicable, filterCategory]);

  const fetchControls = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterApplicable !== '') {
        params.isApplicable = filterApplicable === 'true';
      }
      if (filterCategory !== '') {
        params.category = filterCategory;
      }
      const response = await api.get('/api/controls', { params });
      setControls(response.data.data);
    } catch (error) {
      console.error('Error fetching controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (control: Control) => {
    setSelectedControl(control);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedControl(null);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setSelectedControl(null);
    fetchControls();
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <Heading size="lg">Controls</Heading>
        <Button colorScheme="blue" onClick={handleCreate}>
          Create Control
        </Button>
      </HStack>

      <Box p={4} bg="white" borderRadius="md" boxShadow="sm">
        <HStack mb={4}>
          <Select
            placeholder="Filter by Applicability"
            value={filterApplicable}
            onChange={(e) => setFilterApplicable(e.target.value)}
            maxW="200px"
          >
            <option value="true">Applicable</option>
            <option value="false">Not Applicable</option>
          </Select>
          <Select
            placeholder="Filter by Category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            maxW="200px"
          >
            <option value="ORGANIZATIONAL">Organizational</option>
            <option value="PEOPLE">People</option>
            <option value="PHYSICAL">Physical</option>
            <option value="TECHNOLOGICAL">Technological</option>
          </Select>
          <Button size="sm" onClick={() => { setFilterApplicable(''); setFilterCategory(''); }}>
            Clear Filters
          </Button>
        </HStack>

        {loading ? (
          <Box p={8} textAlign="center">
            Loading...
          </Box>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th>Selected</Th>
                <Th>Selection Reasons</Th>
                <Th>Linked Risks</Th>
                <Th>Linked Documents</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {controls.map((control) => {
                const isSelected = 
                  control.selectedForRiskAssessment ||
                  control.selectedForContractualObligation ||
                  control.selectedForLegalRequirement ||
                  control.selectedForBusinessRequirement;
                
                const reasons: string[] = [];
                if (control.selectedForRiskAssessment) reasons.push('Risk Assessment');
                if (control.selectedForContractualObligation) reasons.push('Contractual');
                if (control.selectedForLegalRequirement) reasons.push('Legal');
                if (control.selectedForBusinessRequirement) reasons.push('Business');

                return (
                  <Tr key={control.id}>
                    <Td fontWeight="medium">{control.code}</Td>
                    <Td>{control.title}</Td>
                    <Td>
                      {control.category && (
                        <Badge colorScheme={
                          control.category === 'ORGANIZATIONAL' ? 'blue' :
                          control.category === 'PEOPLE' ? 'purple' :
                          control.category === 'PHYSICAL' ? 'orange' :
                          'teal'
                        }>
                          {control.category}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {control.isStandardControl && (
                        <Badge colorScheme="green">Standard</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={isSelected ? 'green' : 'gray'}>
                        {isSelected ? 'Yes' : 'No'}
                      </Badge>
                    </Td>
                    <Td>
                      {reasons.length > 0 ? (
                        <VStack align="start" spacing={1}>
                          {reasons.map((reason, idx) => (
                            <Badge key={idx} colorScheme={
                              reason === 'Risk Assessment' ? 'blue' :
                              reason === 'Contractual' ? 'purple' :
                              reason === 'Legal' ? 'red' :
                              'orange'
                            } fontSize="xs">
                              {reason}
                            </Badge>
                          ))}
                        </VStack>
                      ) : (
                        <Badge colorScheme="gray" fontSize="xs">None</Badge>
                      )}
                    </Td>
                    <Td>{control.riskControls.length}</Td>
                    <Td>{control.documentControls.length}</Td>
                    <Td>
                      <Button size="sm" onClick={() => handleEdit(control)}>
                        {control.isStandardControl ? 'View' : 'Edit'}
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Box>

      <ControlFormModal
        isOpen={isOpen}
        onClose={handleClose}
        control={selectedControl}
      />
    </VStack>
  );
}

