import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Checkbox,
  Spinner,
  Divider,
  useToast,
  IconButton,
  Tooltip,
  Progress,
} from '@chakra-ui/react';
import { ViewIcon, DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import { SimilarRisk } from '../types/risk';

interface SimilarRisksPanelProps {
  similarRisks: SimilarRisk[];
  onViewRisk: (riskId: string) => void;
  onSelectRisk: (riskId: string, selected: boolean) => void;
  selectedRiskIds: Set<string>;
  onBulkDelete: () => void;
  onBulkExport?: () => void;
  loading: boolean;
  threshold?: number;
  progress?: { current: number; total: number; percentage: number };
}

export function SimilarRisksPanel({
  similarRisks,
  onViewRisk,
  onSelectRisk,
  selectedRiskIds,
  onBulkDelete,
  onBulkExport,
  loading,
  threshold = 70,
  progress,
}: SimilarRisksPanelProps) {
  const _toast = useToast();

  const getSimilarityColor = (score: number): string => {
    if (score >= 80) return 'red';
    if (score >= 60) return 'yellow';
    return 'gray';
  };

  const getSimilarityLabel = (score: number): string => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  if (loading) {
    return (
      <Box p={4} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <VStack spacing={3} align="stretch">
          <HStack spacing={2}>
            <Spinner size="sm" />
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              Finding similar risks...
            </Text>
          </HStack>
          {progress && progress.total > 0 && (
            <>
              <Progress
                value={progress.percentage}
                colorScheme="blue"
                size="sm"
                borderRadius="md"
                isAnimated
                hasStripe
              />
              <Text fontSize="xs" color="gray.500" textAlign="center">
                Comparing {progress.current} of {progress.total} risks ({progress.percentage}%)
              </Text>
            </>
          )}
        </VStack>
      </Box>
    );
  }

  if (similarRisks.length === 0) {
    return (
      <Box p={4} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="sm" color="gray.600">
          No similar risks found (threshold: {threshold}%)
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} bg="white" borderRadius="md" borderWidth="1px" borderColor="gray.200">
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Text fontSize="md" fontWeight="bold">
            Found {similarRisks.length} similar risk{similarRisks.length !== 1 ? 's' : ''}
          </Text>
          {selectedRiskIds.size > 0 && (
            <HStack spacing={2}>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                leftIcon={<DeleteIcon />}
                onClick={onBulkDelete}
              >
                Delete Selected ({selectedRiskIds.size})
              </Button>
              {onBulkExport && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<DownloadIcon />}
                  onClick={onBulkExport}
                >
                  Export Selected
                </Button>
              )}
            </HStack>
          )}
        </HStack>

        <Divider />

        <VStack align="stretch" spacing={3}>
          {similarRisks.map((similarRisk) => {
            const isSelected = selectedRiskIds.has(similarRisk.risk.id);
            const similarityColor = getSimilarityColor(similarRisk.similarityScore);
            const similarityLabel = getSimilarityLabel(similarRisk.similarityScore);

            return (
              <Box
                key={similarRisk.risk.id}
                p={3}
                bg={isSelected ? 'blue.50' : 'gray.50'}
                borderRadius="md"
                borderWidth="1px"
                borderColor={isSelected ? 'blue.200' : 'gray.200'}
              >
                <HStack spacing={3} align="start">
                  <Checkbox
                    isChecked={isSelected}
                    onChange={(e) => onSelectRisk(similarRisk.risk.id, e.target.checked)}
                    mt={1}
                  />
                  <VStack align="stretch" flex={1} spacing={1}>
                    <HStack justify="space-between">
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => onViewRisk(similarRisk.risk.id)}
                      >
                        {similarRisk.risk.title}
                      </Text>
                      <HStack spacing={2}>
                        <Badge colorScheme={similarityColor} fontSize="xs">
                          {similarityLabel} ({similarRisk.similarityScore}%)
                        </Badge>
                        <Tooltip label="View risk in new tab">
                          <IconButton
                            aria-label="View risk"
                            icon={<ViewIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={() => onViewRisk(similarRisk.risk.id)}
                          />
                        </Tooltip>
                      </HStack>
                    </HStack>
                    <HStack spacing={4} fontSize="xs" color="gray.600">
                      {similarRisk.risk.riskCategory && (
                        <Text>
                          Category: <strong>{similarRisk.risk.riskCategory}</strong>
                        </Text>
                      )}
                      {similarRisk.risk.calculatedScore !== null && (
                        <Text>
                          Score: <strong>{similarRisk.risk.calculatedScore}</strong>
                        </Text>
                      )}
                      {similarRisk.risk.owner && (
                        <Text>
                          Owner: <strong>{similarRisk.risk.owner.displayName}</strong>
                        </Text>
                      )}
                    </HStack>
                    {similarRisk.matchedFields.length > 0 && (
                      <Text fontSize="xs" color="gray.500">
                        Matched fields: {similarRisk.matchedFields.join(', ')}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Box>
            );
          })}
        </VStack>
      </VStack>
    </Box>
  );
}

