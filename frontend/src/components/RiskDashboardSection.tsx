import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { AxiosError } from 'axios';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  VStack,
  Text,
  Spinner,
  useToast,
  HStack,
  Select,
  Button,
  Divider,
  Grid,
  GridItem,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
} from '@chakra-ui/react';
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import api, { riskDashboardApi } from '../services/api';
import { RiskDashboardFilters, RiskDashboardSummary } from '../types/riskDashboard';
import { Department, getDepartmentDisplayName } from '../types/risk';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = {
  total: '#3182CE',
  implemented: '#48BB78',
  nonImplemented: '#ED8936',
  noMitigation: '#F56565',
};

const RISK_CATEGORIES = [
  'INFORMATION_SECURITY',
  'OPERATIONAL',
  'FINANCIAL',
  'COMPLIANCE',
  'REPUTATIONAL',
  'STRATEGIC',
  'OTHER',
];

const RISK_STATUSES = ['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'ARCHIVED'];

const DEPARTMENTS: Department[] = [
  'BUSINESS_STRATEGY',
  'FINANCE',
  'HR',
  'OPERATIONS',
  'PRODUCT',
  'MARKETING',
];

const isDepartment = (value: string | null | undefined): value is Department =>
  Boolean(value) && DEPARTMENTS.includes(value as Department);

export function RiskDashboardSection() {
  const [data, setData] = useState<RiskDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RiskDashboardFilters>({});
  const [owners, setOwners] = useState<Array<{ id: string; displayName: string }>>([]);
  const toast = useToast();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      ) as RiskDashboardFilters;
      const summary = await riskDashboardApi.getSummary(activeFilters);
      setData(summary);
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ error?: string }>;
      console.error('Error fetching risk dashboard data:', axiosError);
      toast({
        title: 'Error',
        description: axiosError.response?.data?.error || 'Failed to load risk dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      // Don't set data to null - keep previous data if available, or show empty state
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const fetchOwners = useCallback(async () => {
    try {
      const response = await api.get('/api/users');
      const users = response.data?.data || [];
      setOwners(users.map((user: { id: string; displayName: string }) => ({
        id: user.id,
        displayName: user.displayName,
      })));
    } catch (error) {
      console.error('Error fetching users for risk dashboard filters:', error);
    }
  }, []);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const heatmapStats = useMemo(() => {
    if (!data) {
      return { map: new Map<string, number>(), maxCount: 1 };
    }
    const map = new Map<string, number>();
    data.heatmap.forEach((cell) => {
      map.set(`${cell.likelihood}-${cell.impact}`, cell.count);
    });
    const maxCount = Math.max(1, ...data.heatmap.map((cell) => cell.count));
    return { map, maxCount };
  }, [data]);

  const summarizeLevels = (levels: { LOW: number; MEDIUM: number; HIGH: number }) =>
    levels.LOW + levels.MEDIUM + levels.HIGH;

  const departmentSummary = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_department).map(([department, levels]) => ({
      department,
      inherentTotal: summarizeLevels(levels.inherent),
      residualTotal: summarizeLevels(levels.residual),
      inherentHigh: levels.inherent.HIGH,
      residualHigh: levels.residual.HIGH,
    })).sort((a, b) => b.inherentHigh - a.inherentHigh).slice(0, 5);
  }, [data]);

  const categorySummary = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_category).map(([category, levels]) => ({
      category,
      inherentTotal: summarizeLevels(levels.inherent),
      residualTotal: summarizeLevels(levels.residual),
      inherentHigh: levels.inherent.HIGH,
      residualHigh: levels.residual.HIGH,
    })).sort((a, b) => b.inherentHigh - a.inherentHigh).slice(0, 5);
  }, [data]);

  if (loading) {
    return (
      <VStack spacing={4} align="center" py={10}>
        <Spinner size="xl" />
        <Text>Loading risk dashboard...</Text>
      </VStack>
    );
  }

  if (!data) {
    return (
      <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Risk Dashboard</Heading>
        <Text color="gray.500">Unable to load risk dashboard data. Please try refreshing the page.</Text>
      </Box>
    );
  }

  const { latest_snapshot, quarterly_series } = data;

  const impactLevels = [5, 4, 3, 2, 1];
  const likelihoodLevels = [1, 2, 3, 4, 5];

  // Impact and Likelihood labels for better clarity
  // Impact is mapped from sum (C+I+A, range 3-15) to display scale (1-5)
  const impactLabels: Record<number, { short: string; description: string }> = {
    5: { short: 'Critical', description: 'C+I+A = 15 (all scores = 5). Business closure / Loss of license' },
    4: { short: 'High', description: 'C+I+A = 12-14. Service outage / Regulatory breach / >£10k cost' },
    3: { short: 'Medium', description: 'C+I+A = 9-11. Single customer complaint / <£1k cost' },
    2: { short: 'Low', description: 'C+I+A = 6-8. Internal confusion, minor rework' },
    1: { short: 'Minor', description: 'C+I+A = 3-5. Minor glitch, no customer impact' },
  };

  const likelihoodLabels: Record<number, { short: string; description: string }> = {
    1: { short: 'Rare', description: 'Almost impossible / Theoretical only' },
    2: { short: 'Unlikely', description: 'Once in 5-10 years' },
    3: { short: 'Possible', description: 'Once a year' },
    4: { short: 'Likely', description: 'Once a month' },
    5: { short: 'Almost Certain', description: 'Daily / Happening now' },
  };


  // Get color based on risk score (green -> yellow -> red gradient)
  const getRiskColor = (likelihood: number, impact: number, count: number): string => {
    if (count === 0) return 'gray.50';
    
    // Calculate risk score: Likelihood × Impact (1-5 scale)
    const riskScore = likelihood * impact;
    const maxScore = 25; // 5 * 5
    
    // Normalize score to 0-1
    const normalizedScore = riskScore / maxScore;
    
    // Color gradient: green (low) -> yellow (medium) -> red (high)
    if (normalizedScore <= 0.33) {
      // Green to yellow (low to medium risk)
      const intensity = normalizedScore / 0.33;
      return `rgba(72, 187, 120, ${0.3 + intensity * 0.5})`; // Green
    } else if (normalizedScore <= 0.66) {
      // Yellow to orange (medium risk)
      const intensity = (normalizedScore - 0.33) / 0.33;
      return `rgba(237, 137, 54, ${0.4 + intensity * 0.5})`; // Orange
    } else {
      // Orange to red (high risk)
      const intensity = (normalizedScore - 0.66) / 0.34;
      return `rgba(245, 101, 101, ${0.5 + intensity * 0.5})`; // Red
    }
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const navigateToRisks = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    navigate(`/admin/risks/risks?${searchParams.toString()}`);
  };

  const openRisk = (riskId: string) => {
    navigate(`/admin/risks/risks?view=${riskId}`);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  // Prepare data for quarterly trend chart
  const trendData = quarterly_series.map((point) => ({
    quarter: `${point.year} Q${point.quarter}`,
    year: point.year,
    quarterNum: point.quarter,
    total_risk_score: point.total_risk_score,
    implemented_mitigation_score: point.implemented_mitigation_score,
    non_implemented_mitigation_score: point.non_implemented_mitigation_score,
    no_mitigation_score: point.no_mitigation_score,
  }));

  // Custom tooltip for line chart
  const CustomLineTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <Box
          bg="white"
          p={3}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="md"
        >
          <Text fontWeight="bold" mb={2}>{label}</Text>
          {payload.map((entry, index) => (
            <Text key={index} color={entry.color ?? 'gray.600'} fontSize="sm">
              {entry.name}: {formatNumber(Number(entry.value))}
            </Text>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box p={6} bg="white" borderRadius="md" boxShadow="sm">
      <Heading size="md" mb={6}>Risk Dashboard</Heading>

      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="sm" mb={4}>Filters</Heading>
          <HStack spacing={4} flexWrap="wrap">
            <Select
              placeholder="All departments"
              value={filters.department || ''}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                department: event.target.value || undefined,
              }))}
              maxW="220px"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{getDepartmentDisplayName(dept)}</option>
              ))}
            </Select>
            <Select
              placeholder="All categories"
              value={filters.riskCategory || ''}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                riskCategory: event.target.value || undefined,
              }))}
              maxW="240px"
            >
              {RISK_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.replace('_', ' ')}</option>
              ))}
            </Select>
            <Select
              placeholder="All statuses"
              value={filters.status || ''}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                status: event.target.value || undefined,
              }))}
              maxW="200px"
            >
              {RISK_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
            <Select
              placeholder="All owners"
              value={filters.ownerUserId || ''}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                ownerUserId: event.target.value || undefined,
              }))}
              maxW="220px"
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.displayName}</option>
              ))}
            </Select>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </HStack>
        </Box>

        {/* KPI Tiles Section */}
        <Box>
          <Heading size="sm" mb={4}>Latest Snapshot</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <Stat
              as="button"
              type="button"
              p={4}
              bg="blue.50"
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigate('/admin/risks/risks')}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Total Risks</StatLabel>
              <StatNumber>{formatNumber(data.risk_count)}</StatNumber>
              <StatHelpText>Total Risk Score: {formatNumber(latest_snapshot.total_risk_score)}</StatHelpText>
            </Stat>
            <Stat
              as="button"
              type="button"
              p={4}
              bg="green.50"
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ mitigationImplemented: 'true', mitigatedScorePresent: 'true' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Implemented Mitigation Score</StatLabel>
              <StatNumber color="green.600">
                {formatNumber(latest_snapshot.implemented_mitigation_score)}
              </StatNumber>
              <StatHelpText>Click to view mitigated risks with implemented controls</StatHelpText>
            </Stat>
            <Stat
              as="button"
              type="button"
              p={4}
              bg="orange.50"
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ mitigationImplemented: 'false', mitigatedScorePresent: 'true' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Non-Implemented Mitigation Score</StatLabel>
              <StatNumber color="orange.600">
                {formatNumber(latest_snapshot.non_implemented_mitigation_score)}
              </StatNumber>
              <StatHelpText>Click to view identified mitigations not implemented</StatHelpText>
            </Stat>
            <Stat
              as="button"
              type="button"
              p={4}
              bg="red.50"
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ mitigatedScorePresent: 'false', mitigationImplemented: 'false' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>No Mitigation Score</StatLabel>
              <StatNumber color="red.600">
                {formatNumber(latest_snapshot.no_mitigation_score)}
              </StatNumber>
              <StatHelpText>Click to view risks with no mitigation data</StatHelpText>
            </Stat>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} mt={4}>
            <Stat
              as="button"
              type="button"
              p={4}
              bg={data.reviews.overdue_count > 0 ? 'red.50' : 'yellow.50'}
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ reviewStatus: 'overdue' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Overdue Reviews</StatLabel>
              <StatNumber color={data.reviews.overdue_count > 0 ? 'red.600' : 'yellow.700'}>
                {formatNumber(data.reviews.overdue_count)}
              </StatNumber>
              <StatHelpText>Click to view risks past next review date</StatHelpText>
            </Stat>
            <Stat
              as="button"
              type="button"
              p={4}
              bg={data.nonconformance.policy_nonconformance_count > 0 ? 'red.50' : 'gray.50'}
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ policyNonConformance: 'true' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Policy Non-Conformance</StatLabel>
              <StatNumber color={data.nonconformance.policy_nonconformance_count > 0 ? 'red.600' : 'gray.700'}>
                {formatNumber(data.nonconformance.policy_nonconformance_count)}
              </StatNumber>
              <StatHelpText>Click to view policy non-conformances</StatHelpText>
            </Stat>
            <Stat
              as="button"
              type="button"
              p={4}
              bg={data.nonconformance.missing_mitigation_count > 0 ? 'red.50' : 'orange.50'}
              borderRadius="md"
              boxShadow="sm"
              textAlign="left"
              onClick={() => navigateToRisks({ mitigatedScorePresent: 'false', mitigationImplemented: 'false' })}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
              _focusVisible={{ boxShadow: 'outline' }}
              transition="all 0.2s"
            >
              <StatLabel>Missing Mitigation</StatLabel>
              <StatNumber color={data.nonconformance.missing_mitigation_count > 0 ? 'red.600' : 'orange.600'}>
                {formatNumber(data.nonconformance.missing_mitigation_count)}
              </StatNumber>
              <StatHelpText>Risks with no mitigation data</StatHelpText>
            </Stat>
          </SimpleGrid>
        </Box>


        {/* Risk Heatmap */}
        <Box>
          <Heading size="sm" mb={2}>Risk Heatmap (Likelihood vs Impact)</Heading>
          <Text fontSize="xs" color="gray.600" mb={4}>
            Shows distribution of risks by likelihood and impact. Click a cell to view filtered risks.
          </Text>
          
          {/* Legend */}
          <HStack spacing={4} mb={4} fontSize="xs">
            <HStack spacing={2}>
              <Box w={4} h={4} bg="green.400" borderRadius="sm" />
              <Text color="gray.600">Low Risk (Score 1-8)</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w={4} h={4} bg="orange.400" borderRadius="sm" />
              <Text color="gray.600">Medium Risk (Score 9-16)</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w={4} h={4} bg="red.400" borderRadius="sm" />
              <Text color="gray.600">High Risk (Score 17-25)</Text>
            </HStack>
          </HStack>

          <Grid templateColumns={`auto repeat(${likelihoodLevels.length}, minmax(0, 1fr))`} gap={3}>
            {/* Top-left corner */}
            <GridItem minW="100px" />
            
            {/* Likelihood header row */}
            {likelihoodLevels.map((level) => (
              <GridItem key={`likelihood-${level}`} minW="80px">
                <VStack spacing={1}>
                  <Text fontSize="xs" fontWeight="bold" textAlign="center" color="gray.700">
                    {likelihoodLabels[level].short}
                  </Text>
                  <Text fontSize="2xs" textAlign="center" color="gray.500">
                    L{level}
                  </Text>
                  <Tooltip label={likelihoodLabels[level].description} placement="top">
                    <Text fontSize="2xs" textAlign="center" color="gray.400" cursor="help">
                      ℹ️
                    </Text>
                  </Tooltip>
                </VStack>
              </GridItem>
            ))}
            
            {/* Impact rows */}
            {impactLevels.map((impact) => (
              <Fragment key={`impact-${impact}`}>
                {/* Impact label column */}
                <GridItem key={`impact-label-${impact}`} minW="100px">
                  <VStack spacing={1} align="flex-end">
                    <Text fontSize="xs" fontWeight="bold" color="gray.700">
                      {impactLabels[impact].short}
                    </Text>
                    <Text fontSize="2xs" color="gray.500">
                      I{impact}
                    </Text>
                    <Tooltip label={impactLabels[impact].description} placement="left">
                      <Text fontSize="2xs" color="gray.400" cursor="help">
                        ℹ️
                      </Text>
                    </Tooltip>
                  </VStack>
                </GridItem>
                
                {/* Heatmap cells */}
                {likelihoodLevels.map((likelihood) => {
                  const count = heatmapStats.map.get(`${likelihood}-${impact}`) || 0;
                  const bgColor = getRiskColor(likelihood, impact, count);
                  
                  return (
                    <GridItem key={`heat-${likelihood}-${impact}`}>
                      <Tooltip
                        label={
                          count > 0
                            ? `${count} risk${count !== 1 ? 's' : ''} with Likelihood ${likelihood} (${likelihoodLabels[likelihood].short}) and Impact ${impact} (${impactLabels[impact].short}). Click to view.`
                            : `No risks with Likelihood ${likelihood} and Impact ${impact}`
                        }
                        placement="top"
                      >
                        <Box
                          as="button"
                          type="button"
                          width="100%"
                          minH="60px"
                          borderRadius="md"
                          bg={count > 0 ? bgColor : 'gray.50'}
                          border="1px solid"
                          borderColor={count > 0 ? 'gray.300' : 'gray.200'}
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          justifyContent="center"
                          cursor={count > 0 ? 'pointer' : 'default'}
                          _hover={count > 0 ? { transform: 'scale(1.05)', borderColor: 'gray.400', boxShadow: 'md' } : {}}
                          transition="all 0.2s"
                          onClick={() => {
                            if (count > 0) {
                              // Navigate to risks page - filtering by specific likelihood/impact
                              // would require backend API support
                              navigate('/admin/risks/risks');
                            }
                          }}
                        >
                          {count > 0 ? (
                            <Text fontSize="lg" fontWeight="bold" color="white">
                              {count}
                            </Text>
                          ) : (
                            <Text fontSize="sm" color="gray.400">
                              —
                            </Text>
                          )}
                        </Box>
                      </Tooltip>
                    </GridItem>
                  );
                })}
              </Fragment>
            ))}
          </Grid>
          
          <HStack spacing={4} mt={4} fontSize="xs" color="gray.600" flexWrap="wrap">
            <Text>
              <strong>Impact</strong> = Sum of Confidentiality, Integrity, and Availability scores (C+I+A, range: 3-15)
            </Text>
            <Text>•</Text>
            <Text>
              <strong>Risk Score</strong> = Likelihood × Impact (range: 3-75)
            </Text>
          </HStack>
        </Box>

        {/* Risk Distribution */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          <Box>
            <Heading size="sm" mb={4}>Top Departments by High Risk</Heading>
            {departmentSummary.length > 0 ? (
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Department</Th>
                    <Th isNumeric>High (Inherent)</Th>
                    <Th isNumeric>High (Residual)</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {departmentSummary.map((item) => (
                    <Tr key={item.department}>
                      <Td>
                        {isDepartment(item.department)
                          ? getDepartmentDisplayName(item.department)
                          : item.department}
                      </Td>
                      <Td isNumeric>{item.inherentHigh}</Td>
                      <Td isNumeric>{item.residualHigh}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Text color="gray.500" fontSize="sm">No department distribution available.</Text>
            )}
          </Box>
          <Box>
            <Heading size="sm" mb={4}>Top Categories by High Risk</Heading>
            {categorySummary.length > 0 ? (
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Category</Th>
                    <Th isNumeric>High (Inherent)</Th>
                    <Th isNumeric>High (Residual)</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {categorySummary.map((item) => (
                    <Tr key={item.category}>
                      <Td>{item.category.replace('_', ' ')}</Td>
                      <Td isNumeric>{item.inherentHigh}</Td>
                      <Td isNumeric>{item.residualHigh}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Text color="gray.500" fontSize="sm">No category distribution available.</Text>
            )}
          </Box>
        </SimpleGrid>

        {/* Quarterly Trend Chart Section */}
        <Box>
          <Heading size="sm" mb={4}>Quarterly Trend</Heading>
          {trendData.length > 0 ? (
            <Box height="400px">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.total} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS.total} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorImplemented" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.implemented} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS.implemented} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNonImplemented" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.nonImplemented} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS.nonImplemented} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNoMitigation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.noMitigation} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS.noMitigation} stopOpacity={0} />
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
                  <RechartsTooltip content={<CustomLineTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total_risk_score"
                    stroke={CHART_COLORS.total}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    name="Total Risk Score"
                  />
                  <Area
                    type="monotone"
                    dataKey="implemented_mitigation_score"
                    stroke={CHART_COLORS.implemented}
                    fillOpacity={1}
                    fill="url(#colorImplemented)"
                    name="Implemented Mitigation Score"
                  />
                  <Area
                    type="monotone"
                    dataKey="non_implemented_mitigation_score"
                    stroke={CHART_COLORS.nonImplemented}
                    fillOpacity={1}
                    fill="url(#colorNonImplemented)"
                    name="Non-Implemented Mitigation Score"
                  />
                  <Area
                    type="monotone"
                    dataKey="no_mitigation_score"
                    stroke={CHART_COLORS.noMitigation}
                    fillOpacity={1}
                    fill="url(#colorNoMitigation)"
                    name="No Mitigation Score"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Box p={6} bg="gray.50" borderRadius="md">
              <Text color="gray.600" textAlign="center">
                No quarterly history available. Current snapshot metrics are shown above.
              </Text>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Mitigation Gaps */}
        <Box>
          <Heading size="sm" mb={4}>Mitigation Gaps</Heading>
          <HStack spacing={4} mb={4} flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigateToRisks({ mitigatedScorePresent: 'false' })}
            >
              View risks with no mitigation data
            </Button>
          </HStack>
          {data.nonconformance.missing_mitigation.length > 0 ? (
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Risk</Th>
                  <Th>Score</Th>
                  <Th>Open</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.nonconformance.missing_mitigation.map((risk) => (
                  <Tr key={risk.id}>
                    <Td>{risk.title}</Td>
                    <Td>{risk.calculatedScore}</Td>
                    <Td>
                      <Button size="xs" variant="link" onClick={() => openRisk(risk.id)}>
                        View risk
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Text color="gray.500" fontSize="sm">No mitigation gaps detected.</Text>
          )}
        </Box>
      </VStack>
    </Box>
  );
}

