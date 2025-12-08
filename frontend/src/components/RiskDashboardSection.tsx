import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  VStack,
  HStack,
  Text,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { riskDashboardApi } from '../services/api';
import { RiskDashboardSummary } from '../types/riskDashboard';

// Color scheme matching the plan
const COLORS = {
  implemented: '#48BB78', // Green
  nonImplemented: '#ED8936', // Amber
  noMitigation: '#F56565', // Red
};

const CHART_COLORS = {
  total: '#3182CE',
  implemented: '#48BB78',
  nonImplemented: '#ED8936',
  noMitigation: '#F56565',
};

export function RiskDashboardSection() {
  const [data, setData] = useState<RiskDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const summary = await riskDashboardApi.getSummary();
      setData(summary);
    } catch (error: any) {
      console.error('Error fetching risk dashboard data:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load risk dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      // Don't set data to null - keep previous data if available, or show empty state
    } finally {
      setLoading(false);
    }
  };

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

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  // Prepare data for breakdown chart (donut chart)
  const breakdownData = [
    {
      name: 'Implemented',
      value: latest_snapshot.implemented_mitigation_score,
      color: COLORS.implemented,
    },
    {
      name: 'Non-Implemented',
      value: latest_snapshot.non_implemented_mitigation_score,
      color: COLORS.nonImplemented,
    },
    {
      name: 'No Mitigation',
      value: latest_snapshot.no_mitigation_score,
      color: COLORS.noMitigation,
    },
  ].filter((item) => item.value > 0); // Only show segments with values

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

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
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
          <Text fontWeight="bold">{payload[0].name}</Text>
          <Text color={payload[0].payload.color}>
            {formatNumber(payload[0].value)}
          </Text>
        </Box>
      );
    }
    return null;
  };

  // Custom tooltip for line chart
  const CustomLineTooltip = ({ active, payload, label }: any) => {
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
          {payload.map((entry: any, index: number) => (
            <Text key={index} color={entry.color} fontSize="sm">
              {entry.name}: {formatNumber(entry.value)}
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
        {/* KPI Tiles Section */}
        <Box>
          <Heading size="sm" mb={4}>Latest Snapshot</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <Stat p={4} bg="blue.50" borderRadius="md" boxShadow="sm">
              <StatLabel>Total Risk Score</StatLabel>
              <StatNumber>{formatNumber(latest_snapshot.total_risk_score)}</StatNumber>
              <StatHelpText>Sum of all risk scores</StatHelpText>
            </Stat>

            <Stat p={4} bg="green.50" borderRadius="md" boxShadow="sm">
              <StatLabel>Implemented Mitigation Score</StatLabel>
              <StatNumber color="green.600">
                {formatNumber(latest_snapshot.implemented_mitigation_score)}
              </StatNumber>
              <StatHelpText>Risks with implemented mitigations</StatHelpText>
            </Stat>

            <Stat p={4} bg="orange.50" borderRadius="md" boxShadow="sm">
              <StatLabel>Non-Implemented Mitigation Score</StatLabel>
              <StatNumber color="orange.600">
                {formatNumber(latest_snapshot.non_implemented_mitigation_score)}
              </StatNumber>
              <StatHelpText>Risks with mitigations not implemented</StatHelpText>
            </Stat>

            <Stat p={4} bg="red.50" borderRadius="md" boxShadow="sm">
              <StatLabel>No Mitigation Score</StatLabel>
              <StatNumber color="red.600">
                {formatNumber(latest_snapshot.no_mitigation_score)}
              </StatNumber>
              <StatHelpText>Risks without mitigations</StatHelpText>
            </Stat>
          </SimpleGrid>
        </Box>

        {/* Breakdown Chart Section */}
        <Box>
          <Heading size="sm" mb={4}>Risk Score Breakdown</Heading>
          <Box height="300px">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomPieTooltip />} />
                <Legend
                  formatter={(value, entry: any) => (
                    <span style={{ color: entry.color }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Box>

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
      </VStack>
    </Box>
  );
}

