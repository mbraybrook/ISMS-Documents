import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tooltip,
  useToast,
  Spinner,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link as ChakraLink,
  Divider,
  Button,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  WarningIcon,
  CheckCircleIcon,
  InfoIcon,
  ArrowForwardIcon,
} from '@chakra-ui/icons';
import api from '../services/api';

interface DashboardData {
  documents: {
    overdue: any[];
    upcoming: any[];
    missingReviewDate: any[];
    overdueReviewTasks: any[];
    byStatus: Record<string, number>;
  };
  risks: {
    totalCount: number;
    totalRiskScore: number;
    implementedMitigationRiskScore: number;
    nonImplementedMitigationRiskScore: number;
    riskScoreDelta: number;
    byLevel: { LOW: number; MEDIUM: number; HIGH: number };
    mitigatedByLevel: { LOW: number; MEDIUM: number; HIGH: number };
    withMitigationNotImplemented: Array<{
      id: string;
      title: string;
      calculatedScore: number;
      mitigatedScore: number | null;
    }>;
    byTreatmentCategory: Record<string, number>;
  };
  controls: {
    totalCount: number;
    selectedCount: number;
    excludedCount: number;
    selectedButNotImplementedCount: number;
    selectedButNotImplemented: Array<{
      id: string;
      code: string;
      title: string;
    }>;
    bySelectionReason: {
      riskAssessment: number;
      contractualObligation: number;
      legalRequirement: number;
      businessRequirement: number;
    };
  };
  acknowledgments: {
    pending: any[];
    stats: any;
  };
  lastUpdated: string;
}

export function HomePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
    // Refresh dashboard when window gains focus
    const handleFocus = () => {
      fetchDashboard();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Spinner size="xl" />
        <Text>Loading dashboard...</Text>
      </VStack>
    );
  }

  if (!dashboardData) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Text>No data available</Text>
      </VStack>
    );
  }

  const getRiskLevelColor = (level: 'LOW' | 'MEDIUM' | 'HIGH'): string => {
    switch (level) {
      case 'HIGH':
        return 'red';
      case 'MEDIUM':
        return 'yellow';
      case 'LOW':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (score >= 36) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" align="center">
        <Box>
          <Heading size="xl" mb={2}>
            ISMS Dashboard
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
          </Text>
        </Box>
        <Button onClick={fetchDashboard} size="sm" variant="outline">
          Refresh
        </Button>
      </HStack>

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <Tooltip label="Click to view overdue documents" placement="top">
          <Stat
            p={4}
            bg={dashboardData.documents.overdue.length > 0 ? 'red.50' : 'white'}
            borderLeft={dashboardData.documents.overdue.length > 0 ? '4px solid' : 'none'}
            borderColor="red.500"
            borderRadius="md"
            boxShadow="sm"
            cursor="pointer"
            _hover={{
              bg: dashboardData.documents.overdue.length > 0 ? 'red.100' : 'gray.50',
              transform: 'translateY(-2px)',
              boxShadow: 'md',
            }}
            transition="all 0.2s"
            onClick={() => navigate('/admin/documents/reviews')}
          >
            <HStack spacing={2} mb={2}>
              <WarningIcon
                color={dashboardData.documents.overdue.length > 0 ? 'red.500' : 'gray.400'}
              />
              <StatLabel
                color={
                  dashboardData.documents.overdue.length > 0 ? 'red.700' : 'gray.600'
                }
              >
                Overdue Documents
              </StatLabel>
            </HStack>
            <StatNumber
              color={dashboardData.documents.overdue.length > 0 ? 'red.600' : 'gray.500'}
            >
              {dashboardData.documents.overdue.length}
            </StatNumber>
          </Stat>
        </Tooltip>

        <Tooltip label="Risks with HIGH severity" placement="top">
          <Stat
            p={4}
            bg={dashboardData.risks.byLevel.HIGH > 0 ? 'red.50' : 'white'}
            borderLeft={dashboardData.risks.byLevel.HIGH > 0 ? '4px solid' : 'none'}
            borderColor="red.500"
            borderRadius="md"
            boxShadow="sm"
            cursor="pointer"
            _hover={{
              bg: dashboardData.risks.byLevel.HIGH > 0 ? 'red.100' : 'gray.50',
              transform: 'translateY(-2px)',
              boxShadow: 'md',
            }}
            transition="all 0.2s"
            onClick={() => navigate('/admin/risks/risks')}
          >
            <HStack spacing={2} mb={2}>
              <WarningIcon
                color={dashboardData.risks.byLevel.HIGH > 0 ? 'red.500' : 'gray.400'}
              />
              <StatLabel
                color={dashboardData.risks.byLevel.HIGH > 0 ? 'red.700' : 'gray.600'}
              >
                High Risks
              </StatLabel>
            </HStack>
            <StatNumber
              color={dashboardData.risks.byLevel.HIGH > 0 ? 'red.600' : 'gray.500'}
            >
              {dashboardData.risks.byLevel.HIGH}
            </StatNumber>
          </Stat>
        </Tooltip>

        <Tooltip label="Pending document acknowledgments" placement="top">
          <Stat
            p={4}
            bg={dashboardData.acknowledgments.pending.length > 0 ? 'yellow.50' : 'white'}
            borderLeft={
              dashboardData.acknowledgments.pending.length > 0 ? '4px solid' : 'none'
            }
            borderColor="yellow.500"
            borderRadius="md"
            boxShadow="sm"
            cursor="pointer"
            _hover={{
              bg:
                dashboardData.acknowledgments.pending.length > 0
                  ? 'yellow.100'
                  : 'gray.50',
              transform: 'translateY(-2px)',
              boxShadow: 'md',
            }}
            transition="all 0.2s"
            onClick={() => navigate('/admin/documents/acknowledgments')}
          >
            <HStack spacing={2} mb={2}>
              <InfoIcon
                color={
                  dashboardData.acknowledgments.pending.length > 0
                    ? 'yellow.600'
                    : 'gray.400'
                }
              />
              <StatLabel
                color={
                  dashboardData.acknowledgments.pending.length > 0
                    ? 'yellow.700'
                    : 'gray.600'
                }
              >
                Pending Acknowledgments
              </StatLabel>
            </HStack>
            <StatNumber
              color={
                dashboardData.acknowledgments.pending.length > 0
                  ? 'yellow.600'
                  : 'gray.500'
              }
            >
              {dashboardData.acknowledgments.pending.length}
            </StatNumber>
          </Stat>
        </Tooltip>

        <Tooltip label="Controls selected but not implemented" placement="top">
          <Stat
            p={4}
            bg={
              dashboardData.controls.selectedButNotImplementedCount > 0
                ? 'orange.50'
                : 'white'
            }
            borderLeft={
              dashboardData.controls.selectedButNotImplementedCount > 0
                ? '4px solid'
                : 'none'
            }
            borderColor="orange.500"
            borderRadius="md"
            boxShadow="sm"
            cursor="pointer"
            _hover={{
              bg:
                dashboardData.controls.selectedButNotImplementedCount > 0
                  ? 'orange.100'
                  : 'gray.50',
              transform: 'translateY(-2px)',
              boxShadow: 'md',
            }}
            transition="all 0.2s"
            onClick={() => navigate('/admin/risks/controls')}
          >
            <HStack spacing={2} mb={2}>
              <InfoIcon
                color={
                  dashboardData.controls.selectedButNotImplementedCount > 0
                    ? 'orange.500'
                    : 'gray.400'
                }
              />
              <StatLabel
                color={
                  dashboardData.controls.selectedButNotImplementedCount > 0
                    ? 'orange.700'
                    : 'gray.600'
                }
              >
                Controls Not Implemented
              </StatLabel>
            </HStack>
            <StatNumber
              color={
                dashboardData.controls.selectedButNotImplementedCount > 0
                  ? 'orange.600'
                  : 'gray.500'
              }
            >
              {dashboardData.controls.selectedButNotImplementedCount}
            </StatNumber>
          </Stat>
        </Tooltip>
      </SimpleGrid>

      {/* Risk Statistics Section */}
      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Risk Statistics</Heading>
        <Box>
          <VStack spacing={4} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              <Stat p={4} bg="blue.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Total Risk Score</StatLabel>
                <StatNumber>{dashboardData.risks.totalRiskScore}</StatNumber>
                <StatHelpText>Sum of all risk scores</StatHelpText>
              </Stat>

              <Stat p={4} bg="green.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Implemented Mitigation Score</StatLabel>
                <StatNumber color="green.600">
                  {dashboardData.risks.implementedMitigationRiskScore}
                </StatNumber>
                <StatHelpText>Risks with implemented mitigations</StatHelpText>
              </Stat>

              <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Non-Implemented Mitigation Score</StatLabel>
                <StatNumber color="red.600">
                  {dashboardData.risks.nonImplementedMitigationRiskScore}
                </StatNumber>
                <StatHelpText>Risks with mitigations not implemented</StatHelpText>
              </Stat>

              <Stat
                p={4}
                bg={
                  dashboardData.risks.riskScoreDelta > 0 ? 'yellow.50' : 'green.50'
                }
                borderRadius="md"
                boxShadow="sm"
              >
                <StatLabel>Risk Score Delta</StatLabel>
                <StatNumber
                  color={
                    dashboardData.risks.riskScoreDelta > 0 ? 'yellow.600' : 'green.600'
                  }
                >
                  {dashboardData.risks.riskScoreDelta}
                </StatNumber>
                <StatHelpText>
                  Risks without mitigations defined
                </StatHelpText>
              </Stat>
            </SimpleGrid>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box>
                <Heading size="sm" mb={3}>
                  Risk Distribution (Total)
                </Heading>
                <SimpleGrid columns={3} spacing={2}>
                  <Stat p={3} bg="green.50" borderRadius="md">
                    <StatLabel fontSize="xs">LOW</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.byLevel.LOW}
                    </StatNumber>
                  </Stat>
                  <Stat p={3} bg="yellow.50" borderRadius="md">
                    <StatLabel fontSize="xs">MEDIUM</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.byLevel.MEDIUM}
                    </StatNumber>
                  </Stat>
                  <Stat p={3} bg="red.50" borderRadius="md">
                    <StatLabel fontSize="xs">HIGH</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.byLevel.HIGH}
                    </StatNumber>
                  </Stat>
                </SimpleGrid>
              </Box>

              <Box>
                <Heading size="sm" mb={3}>
                  Risk Distribution (Mitigated)
                </Heading>
                <SimpleGrid columns={3} spacing={2}>
                  <Stat p={3} bg="green.50" borderRadius="md">
                    <StatLabel fontSize="xs">LOW</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.mitigatedByLevel.LOW}
                    </StatNumber>
                  </Stat>
                  <Stat p={3} bg="yellow.50" borderRadius="md">
                    <StatLabel fontSize="xs">MEDIUM</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.mitigatedByLevel.MEDIUM}
                    </StatNumber>
                  </Stat>
                  <Stat p={3} bg="red.50" borderRadius="md">
                    <StatLabel fontSize="xs">HIGH</StatLabel>
                    <StatNumber fontSize="lg">
                      {dashboardData.risks.mitigatedByLevel.HIGH}
                    </StatNumber>
                  </Stat>
                </SimpleGrid>
              </Box>
            </SimpleGrid>

            {dashboardData.risks.withMitigationNotImplemented.length > 0 && (
              <>
                <Divider />
                <Box>
                  <HStack justify="space-between" mb={3}>
                    <Heading size="sm">
                      Risks with Mitigations Identified but Not Implemented
                    </Heading>
                    <Button
                      size="sm"
                      variant="outline"
                      rightIcon={<ArrowForwardIcon />}
                      onClick={() => navigate('/admin/risks/risks')}
                    >
                      View All Risks
                    </Button>
                  </HStack>
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Title</Th>
                          <Th>Total Score</Th>
                          <Th>Mitigated Score</Th>
                          <Th>Level</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboardData.risks.withMitigationNotImplemented.map(
                          (risk) => {
                            const level = getRiskLevel(risk.calculatedScore);
                            return (
                              <Tr
                                key={risk.id}
                                _hover={{ bg: 'gray.50' }}
                                cursor="pointer"
                                onClick={() => navigate('/admin/risks/risks')}
                              >
                                <Td>{risk.title}</Td>
                                <Td>{risk.calculatedScore}</Td>
                                <Td>
                                  {risk.mitigatedScore !== null
                                    ? risk.mitigatedScore
                                    : '—'}
                                </Td>
                                <Td>
                                  <Badge colorScheme={getRiskLevelColor(level)}>
                                    {level}
                                  </Badge>
                                </Td>
                              </Tr>
                            );
                          }
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              </>
            )}
          </VStack>
        </Box>
      </Box>

      {/* Control Statistics Section */}
      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Control Statistics</Heading>
        <Box>
          <VStack spacing={4} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              <Stat p={4} bg="blue.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Total Controls</StatLabel>
                <StatNumber>{dashboardData.controls.totalCount}</StatNumber>
              </Stat>

              <Stat p={4} bg="green.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Selected Controls</StatLabel>
                <StatNumber color="green.600">
                  {dashboardData.controls.selectedCount}
                </StatNumber>
              </Stat>

              <Stat p={4} bg="gray.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Excluded Controls</StatLabel>
                <StatNumber>{dashboardData.controls.excludedCount}</StatNumber>
              </Stat>

              <Stat
                p={4}
                bg={
                  dashboardData.controls.selectedButNotImplementedCount > 0
                    ? 'orange.50'
                    : 'green.50'
                }
                borderRadius="md"
                boxShadow="sm"
              >
                <StatLabel>Selected but Not Implemented</StatLabel>
                <StatNumber
                  color={
                    dashboardData.controls.selectedButNotImplementedCount > 0
                      ? 'orange.600'
                      : 'green.600'
                  }
                >
                  {dashboardData.controls.selectedButNotImplementedCount}
                </StatNumber>
              </Stat>
            </SimpleGrid>

            <Divider />

            <Box>
              <Heading size="sm" mb={3}>
                Controls by Selection Reason
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
                <Stat p={3} bg="blue.50" borderRadius="md">
                  <StatLabel fontSize="xs">Risk Assessment</StatLabel>
                  <StatNumber fontSize="lg">
                    {dashboardData.controls.bySelectionReason.riskAssessment}
                  </StatNumber>
                </Stat>
                <Stat p={3} bg="purple.50" borderRadius="md">
                  <StatLabel fontSize="xs">Contractual Obligation</StatLabel>
                  <StatNumber fontSize="lg">
                    {dashboardData.controls.bySelectionReason.contractualObligation}
                  </StatNumber>
                </Stat>
                <Stat p={3} bg="orange.50" borderRadius="md">
                  <StatLabel fontSize="xs">Legal Requirement</StatLabel>
                  <StatNumber fontSize="lg">
                    {dashboardData.controls.bySelectionReason.legalRequirement}
                  </StatNumber>
                </Stat>
                <Stat p={3} bg="teal.50" borderRadius="md">
                  <StatLabel fontSize="xs">Business Requirement</StatLabel>
                  <StatNumber fontSize="lg">
                    {dashboardData.controls.bySelectionReason.businessRequirement}
                  </StatNumber>
                </Stat>
              </SimpleGrid>
            </Box>

            {dashboardData.controls.selectedButNotImplemented.length > 0 && (
              <>
                <Divider />
                <Box>
                  <HStack justify="space-between" mb={3}>
                    <Heading size="sm">
                      Selected Controls Not Implemented
                    </Heading>
                    <Button
                      size="sm"
                      variant="outline"
                      rightIcon={<ArrowForwardIcon />}
                      onClick={() => navigate('/admin/risks/controls')}
                    >
                      View All Controls
                    </Button>
                  </HStack>
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Code</Th>
                          <Th>Title</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboardData.controls.selectedButNotImplemented.map(
                          (control) => (
                            <Tr
                              key={control.id}
                              _hover={{ bg: 'gray.50' }}
                              cursor="pointer"
                              onClick={() => navigate('/admin/risks/controls')}
                            >
                              <Td>
                                <Badge colorScheme="blue">{control.code}</Badge>
                              </Td>
                              <Td>{control.title}</Td>
                            </Tr>
                          )
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              </>
            )}
          </VStack>
        </Box>
      </Box>

      {/* Document Review Section */}
      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Document Reviews</Heading>
        <Box>
          <VStack spacing={4} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Overdue Documents</StatLabel>
                <StatNumber color="red.600">
                  {dashboardData.documents.overdue.length}
                </StatNumber>
              </Stat>

              <Stat p={4} bg="yellow.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Upcoming Reviews</StatLabel>
                <StatNumber color="yellow.600">
                  {dashboardData.documents.upcoming.length}
                </StatNumber>
              </Stat>

              <Stat p={4} bg="orange.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Missing Review Dates</StatLabel>
                <StatNumber color="orange.600">
                  {dashboardData.documents.missingReviewDate.length}
                </StatNumber>
              </Stat>
            </SimpleGrid>

            <HStack>
              <Button
                colorScheme="blue"
                variant="outline"
                rightIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/admin/documents/reviews')}
              >
                View Review Dashboard
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Box>

      {/* Acknowledgment Section */}
      {dashboardData.acknowledgments.pending.length > 0 && (
        <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
          <Heading size="md" mb={4}>Pending Acknowledgments</Heading>
          <Box>
            <VStack spacing={4} align="stretch">
              <Text>
                You have {dashboardData.acknowledgments.pending.length} document(s)
                requiring acknowledgment.
              </Text>
              <Button
                colorScheme="blue"
                variant="outline"
                rightIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/admin/documents/acknowledgments')}
              >
                View Pending Acknowledgments
              </Button>
            </VStack>
          </Box>
        </Box>
      )}
    </VStack>
  );
}
