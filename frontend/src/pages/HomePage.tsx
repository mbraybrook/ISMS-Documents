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
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  WarningIcon,
  CheckCircleIcon,
  InfoIcon,
  ArrowForwardIcon,
} from '@chakra-ui/icons';
import api, { riskDashboardApi } from '../services/api';
import { RiskDashboardSummary } from '../types/riskDashboard';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardData {
  documents: {
    overdue: any[];
    upcoming: any[];
    missingReviewDate: any[];
    overdueReviewTasks: any[];
    upcomingReviewTasks?: any[];
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
    policyNonConformanceCount: number;
    withPolicyNonConformance: Array<{
      id: string;
      title: string;
      initialRiskTreatmentCategory: string | null;
    }>;
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
  suppliers?: {
    missingReviewDate: any[];
    overdue: any[];
    warning: any[];
    missingReviewDateCount: number;
    overdueCount: number;
    warningCount: number;
  };
  lastUpdated: string;
}

export function HomePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [riskDashboardData, setRiskDashboardData] = useState<RiskDashboardSummary | null>(null);
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
      const [dashboardResponse, riskDashboardResponse] = await Promise.all([
        api.get('/api/dashboard'),
        riskDashboardApi.getSummary().catch((error) => {
          console.error('Error fetching risk dashboard:', error);
          console.error('Error details:', error.response?.data || error.message);
          toast({
            title: 'Warning',
            description: 'Risk dashboard data unavailable. Showing basic statistics.',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
          return null; // Don't fail entire dashboard if risk dashboard fails
        }),
      ]);
      setDashboardData(dashboardResponse.data);
      setRiskDashboardData(riskDashboardResponse);
      // Debug log
      if (riskDashboardResponse) {
        console.log('Risk dashboard data loaded:', riskDashboardResponse);
      } else {
        console.log('Risk dashboard data is null');
      }
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

      {/* Risk Statistics Section */}
      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Risk Statistics</Heading>
        <Box>
          <VStack spacing={4} align="stretch">
            {/* KPI Tiles - Use risk dashboard data if available, fallback to dashboard data */}
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              <Stat p={4} bg="blue.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Total Risk Score</StatLabel>
                <StatNumber>
                  {riskDashboardData?.latest_snapshot?.total_risk_score?.toLocaleString() ?? 
                   dashboardData.risks.totalRiskScore.toLocaleString()}
                </StatNumber>
                <StatHelpText>Sum of all risk scores</StatHelpText>
              </Stat>

              <Stat p={4} bg="green.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Implemented Mitigation Score</StatLabel>
                <StatNumber color="green.600">
                  {riskDashboardData?.latest_snapshot?.implemented_mitigation_score?.toLocaleString() ?? 
                   dashboardData.risks.implementedMitigationRiskScore.toLocaleString()}
                </StatNumber>
                <StatHelpText>Risks with implemented mitigations</StatHelpText>
              </Stat>

              <Stat p={4} bg="orange.50" borderRadius="md" boxShadow="sm">
                <StatLabel>Non-Implemented Mitigation Score</StatLabel>
                <StatNumber color="orange.600">
                  {riskDashboardData?.latest_snapshot?.non_implemented_mitigation_score?.toLocaleString() ?? 
                   dashboardData.risks.nonImplementedMitigationRiskScore.toLocaleString()}
                </StatNumber>
                <StatHelpText>Risks with mitigations not implemented</StatHelpText>
              </Stat>

              <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
                <StatLabel>No Mitigation Score</StatLabel>
                <StatNumber color="red.600">
                  {riskDashboardData?.latest_snapshot?.no_mitigation_score?.toLocaleString() ?? 
                   (dashboardData.risks.totalRiskScore - 
                    dashboardData.risks.implementedMitigationRiskScore - 
                    dashboardData.risks.nonImplementedMitigationRiskScore).toLocaleString()}
                </StatNumber>
                <StatHelpText>Risks without mitigations</StatHelpText>
              </Stat>
            </SimpleGrid>

            {/* Charts Section - Side by Side */}
            {(riskDashboardData?.latest_snapshot || (riskDashboardData?.quarterly_series && riskDashboardData.quarterly_series.length > 0)) && (
              <>
                <Divider />
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                  {/* Breakdown Chart */}
                  {riskDashboardData?.latest_snapshot && (
                    <Box>
                      <Heading size="sm" mb={4}>Risk Score Breakdown</Heading>
                      <Box height="250px">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: 'Implemented',
                                  value: riskDashboardData.latest_snapshot.implemented_mitigation_score,
                                  color: '#48BB78',
                                },
                                {
                                  name: 'Non-Implemented',
                                  value: riskDashboardData.latest_snapshot.non_implemented_mitigation_score,
                                  color: '#ED8936',
                                },
                                {
                                  name: 'No Mitigation',
                                  value: riskDashboardData.latest_snapshot.no_mitigation_score,
                                  color: '#F56565',
                                },
                              ].filter((item) => item.value > 0)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(0)}%`
                              }
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {[
                                { name: 'Implemented', value: riskDashboardData.latest_snapshot.implemented_mitigation_score, color: '#48BB78' },
                                { name: 'Non-Implemented', value: riskDashboardData.latest_snapshot.non_implemented_mitigation_score, color: '#ED8936' },
                                { name: 'No Mitigation', value: riskDashboardData.latest_snapshot.no_mitigation_score, color: '#F56565' },
                              ]
                                .filter((item) => item.value > 0)
                                .map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: number) => value.toLocaleString()}
                            />
                            <Legend
                              formatter={(value, entry: any) => (
                                <span style={{ color: entry.color }}>{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  )}

                  {/* Quarterly Trend Chart */}
                  {riskDashboardData?.quarterly_series && riskDashboardData.quarterly_series.length > 0 ? (
                    <Box>
                      <Heading size="sm" mb={4}>Quarterly Trend</Heading>
                      <Box height="250px">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={riskDashboardData.quarterly_series.map((point) => ({
                              quarter: `${point.year} Q${point.quarter}`,
                              year: point.year,
                              quarterNum: point.quarter,
                              total_risk_score: point.total_risk_score,
                              implemented_mitigation_score: point.implemented_mitigation_score,
                              non_implemented_mitigation_score: point.non_implemented_mitigation_score,
                              no_mitigation_score: point.no_mitigation_score,
                            }))}
                            margin={{ top: 10, right: 30, left: 0, bottom: 60 }}
                          >
                            <defs>
                              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3182CE" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3182CE" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorImplemented" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#48BB78" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#48BB78" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorNonImplemented" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ED8936" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#ED8936" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorNoMitigation" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F56565" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#F56565" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="quarter"
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              interval={0}
                            />
                            <YAxis />
                            <RechartsTooltip
                              formatter={(value: number) => value.toLocaleString()}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="total_risk_score"
                              stroke="#3182CE"
                              fillOpacity={1}
                              fill="url(#colorTotal)"
                              name="Total Risk Score"
                            />
                            <Area
                              type="monotone"
                              dataKey="implemented_mitigation_score"
                              stroke="#48BB78"
                              fillOpacity={1}
                              fill="url(#colorImplemented)"
                              name="Implemented Mitigation Score"
                            />
                            <Area
                              type="monotone"
                              dataKey="non_implemented_mitigation_score"
                              stroke="#ED8936"
                              fillOpacity={1}
                              fill="url(#colorNonImplemented)"
                              name="Non-Implemented Mitigation Score"
                            />
                            <Area
                              type="monotone"
                              dataKey="no_mitigation_score"
                              stroke="#F56565"
                              fillOpacity={1}
                              fill="url(#colorNoMitigation)"
                              name="No Mitigation Score"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  ) : (
                    <Box>
                      <Heading size="sm" mb={4}>Quarterly Trend</Heading>
                      <Box p={6} bg="gray.50" borderRadius="md" height="250px" display="flex" alignItems="center" justifyContent="center">
                        <Text color="gray.600" textAlign="center">
                          No quarterly history available. Current snapshot metrics are shown in the breakdown chart.
                        </Text>
                      </Box>
                    </Box>
                  )}
                </SimpleGrid>
              </>
            )}

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box>
                <Heading size="sm" mb={4}>
                  Risk Distribution (Initial)
                </Heading>
                <Box height="200px">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          level: 'LOW',
                          count: dashboardData.risks.byLevel.LOW,
                          color: '#48BB78',
                        },
                        {
                          level: 'MEDIUM',
                          count: dashboardData.risks.byLevel.MEDIUM,
                          color: '#ED8936',
                        },
                        {
                          level: 'HIGH',
                          count: dashboardData.risks.byLevel.HIGH,
                          color: '#F56565',
                        },
                      ]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value: number) => [`${value} risks`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {[
                          { level: 'LOW', count: dashboardData.risks.byLevel.LOW, color: '#48BB78' },
                          { level: 'MEDIUM', count: dashboardData.risks.byLevel.MEDIUM, color: '#ED8936' },
                          { level: 'HIGH', count: dashboardData.risks.byLevel.HIGH, color: '#F56565' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
                <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                  Total: {dashboardData.risks.byLevel.LOW + dashboardData.risks.byLevel.MEDIUM + dashboardData.risks.byLevel.HIGH} risks
                </Text>
              </Box>

              <Box>
                <Heading size="sm" mb={4}>
                  Risk Distribution (Mitigated)
                </Heading>
                <Box height="200px">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          level: 'LOW',
                          count: dashboardData.risks.mitigatedByLevel.LOW,
                          color: '#48BB78',
                        },
                        {
                          level: 'MEDIUM',
                          count: dashboardData.risks.mitigatedByLevel.MEDIUM,
                          color: '#ED8936',
                        },
                        {
                          level: 'HIGH',
                          count: dashboardData.risks.mitigatedByLevel.HIGH,
                          color: '#F56565',
                        },
                      ]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value: number) => [`${value} risks`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {[
                          { level: 'LOW', count: dashboardData.risks.mitigatedByLevel.LOW, color: '#48BB78' },
                          { level: 'MEDIUM', count: dashboardData.risks.mitigatedByLevel.MEDIUM, color: '#ED8936' },
                          { level: 'HIGH', count: dashboardData.risks.mitigatedByLevel.HIGH, color: '#F56565' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
                <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                  Total: {dashboardData.risks.mitigatedByLevel.LOW + dashboardData.risks.mitigatedByLevel.MEDIUM + dashboardData.risks.mitigatedByLevel.HIGH} risks
                </Text>
              </Box>
            </SimpleGrid>

            {dashboardData.risks.withMitigationNotImplemented.length > 0 && (
              <>
                <Divider />
                <Tooltip label="Click to view risks with mitigations not implemented" placement="top">
                  <Stat
                    p={4}
                    bg="orange.50"
                    borderLeft="4px solid"
                    borderColor="orange.500"
                    borderRadius="md"
                    boxShadow="sm"
                    cursor="pointer"
                    _hover={{
                      bg: 'orange.100',
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                    }}
                    transition="all 0.2s"
                    onClick={() => navigate('/admin/risks/risks?mitigationImplemented=false')}
                  >
                    <StatLabel color="orange.700">Risks with Mitigations Identified but Not Implemented</StatLabel>
                    <StatNumber color="orange.600">
                      {dashboardData.risks.withMitigationNotImplemented.length}
                    </StatNumber>
                    <StatHelpText>
                      Click to view all risks with mitigations not implemented
                    </StatHelpText>
                  </Stat>
                </Tooltip>
              </>
            )}

            {dashboardData.risks.policyNonConformanceCount > 0 && (
              <>
                <Divider />
                <Tooltip label="Click to view risks with policy non-conformance" placement="top">
                  <Stat
                    p={4}
                    bg="red.50"
                    borderLeft="4px solid"
                    borderColor="red.500"
                    borderRadius="md"
                    boxShadow="sm"
                    cursor="pointer"
                    _hover={{
                      bg: 'red.100',
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                    }}
                    transition="all 0.2s"
                    onClick={() => navigate('/admin/risks/risks?policyNonConformance=true')}
                  >
                    <StatLabel color="red.700">Risks with Policy Non-Conformance</StatLabel>
                    <StatNumber color="red.600">
                      {dashboardData.risks.policyNonConformanceCount}
                    </StatNumber>
                    <StatHelpText>
                      Risks with MODIFY treatment category missing complete Additional Controls Assessment
                    </StatHelpText>
                  </Stat>
                </Tooltip>
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
                <Tooltip label="Click to view controls selected but not implemented" placement="top">
                  <Stat
                    p={4}
                    bg="orange.50"
                    borderLeft="4px solid"
                    borderColor="orange.500"
                    borderRadius="md"
                    boxShadow="sm"
                    cursor="pointer"
                    _hover={{
                      bg: 'orange.100',
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                    }}
                    transition="all 0.2s"
                    onClick={() => navigate('/admin/risks/controls')}
                  >
                    <StatLabel color="orange.700">Selected Controls Not Implemented</StatLabel>
                    <StatNumber color="orange.600">
                      {dashboardData.controls.selectedButNotImplementedCount}
                    </StatNumber>
                    <StatHelpText>
                      Click to view all controls selected but not implemented
                    </StatHelpText>
                  </Stat>
                </Tooltip>
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
                  {(dashboardData.documents.upcoming.length || 0) + (dashboardData.documents.upcomingReviewTasks?.length || 0)}
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
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin/documents/reviews');
                }}
              >
                View Review Dashboard
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Box>

      {/* Supplier Review Section */}
      {dashboardData.suppliers && (
        <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
          <Heading size="md" mb={4}>Suppliers Needing Review</Heading>
          <Box>
            <VStack spacing={4} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
                  <StatLabel>Missing Review Date</StatLabel>
                  <StatNumber color="red.600">
                    {dashboardData.suppliers.missingReviewDateCount || 0}
                  </StatNumber>
                </Stat>

                <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
                  <StatLabel>Overdue (&gt;12 months)</StatLabel>
                  <StatNumber color="red.600">
                    {dashboardData.suppliers.overdueCount || 0}
                  </StatNumber>
                </Stat>

                <Stat p={4} bg="orange.50" borderRadius="md" boxShadow="sm">
                  <StatLabel>Warning (nearing 12 months)</StatLabel>
                  <StatNumber color="orange.600">
                    {dashboardData.suppliers.warningCount || 0}
                  </StatNumber>
                </Stat>
              </SimpleGrid>

              <HStack>
                <Button
                  colorScheme="blue"
                  variant="outline"
                  rightIcon={<ArrowForwardIcon />}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/admin/suppliers');
                  }}
                >
                  View Suppliers
                </Button>
              </HStack>
            </VStack>
          </Box>
        </Box>
      )}

    </VStack>
  );
}
