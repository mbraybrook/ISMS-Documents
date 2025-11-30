import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  HStack,
  Box,
  Text,
  Badge,
  Button,
  Collapse,
  useDisclosure,
  IconButton,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon, ViewIcon, CopyIcon } from '@chakra-ui/icons';
import { SimilarRisk } from '../types/risk';

interface SimilarityAlertProps {
  similarRisks: SimilarRisk[];
  onViewRisk: (riskId: string) => void;
  onUseAsTemplate: (riskId: string) => void;
  onDismiss: () => void;
}

export function SimilarityAlert({
  similarRisks,
  onViewRisk,
  onUseAsTemplate,
  onDismiss,
}: SimilarityAlertProps) {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });
  const showTop3 = similarRisks.slice(0, 3);
  const showMore = similarRisks.slice(3);

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

  return (
    <Alert status="warning" borderRadius="md" flexDirection="column" align="stretch">
      <HStack justify="space-between" w="100%">
        <HStack>
          <AlertIcon />
          <AlertTitle>Similar Risks Found</AlertTitle>
        </HStack>
        <Button size="xs" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </HStack>
      <AlertDescription w="100%" mt={2}>
        <VStack align="stretch" spacing={3}>
          <Text fontSize="sm">
            Found {similarRisks.length} similar risk(s). Review before creating to avoid duplicates.
          </Text>

          <VStack align="stretch" spacing={2}>
            {showTop3.map((similarRisk) => {
              const similarityColor = getSimilarityColor(similarRisk.similarityScore);
              const similarityLabel = getSimilarityLabel(similarRisk.similarityScore);

              return (
                <Box
                  key={similarRisk.risk.id}
                  p={2}
                  bg="white"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="gray.200"
                >
                  <HStack justify="space-between" align="start">
                    <VStack align="start" spacing={1} flex={1}>
                      <HStack>
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          cursor="pointer"
                          _hover={{ textDecoration: 'underline' }}
                          onClick={() => onViewRisk(similarRisk.risk.id)}
                        >
                          {similarRisk.risk.title}
                        </Text>
                        <Badge colorScheme={similarityColor} fontSize="xs">
                          {similarityLabel} ({similarRisk.similarityScore}%)
                        </Badge>
                      </HStack>
                      {similarRisk.risk.riskCategory && (
                        <Text fontSize="xs" color="gray.600">
                          Category: {similarRisk.risk.riskCategory}
                        </Text>
                      )}
                    </VStack>
                    <HStack spacing={1}>
                      <Button
                        size="xs"
                        variant="outline"
                        leftIcon={<ViewIcon />}
                        onClick={() => onViewRisk(similarRisk.risk.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="blue"
                        leftIcon={<CopyIcon />}
                        onClick={() => onUseAsTemplate(similarRisk.risk.id)}
                      >
                        Use as Template
                      </Button>
                    </HStack>
                  </HStack>
                </Box>
              );
            })}

            {showMore.length > 0 && (
              <>
                <Collapse in={isOpen} animateOpacity>
                  <VStack align="stretch" spacing={2} mt={2}>
                    {showMore.map((similarRisk) => {
                      const similarityColor = getSimilarityColor(similarRisk.similarityScore);
                      const similarityLabel = getSimilarityLabel(similarRisk.similarityScore);

                      return (
                        <Box
                          key={similarRisk.risk.id}
                          p={2}
                          bg="white"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="gray.200"
                        >
                          <HStack justify="space-between" align="start">
                            <VStack align="start" spacing={1} flex={1}>
                              <HStack>
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  cursor="pointer"
                                  _hover={{ textDecoration: 'underline' }}
                                  onClick={() => onViewRisk(similarRisk.risk.id)}
                                >
                                  {similarRisk.risk.title}
                                </Text>
                                <Badge colorScheme={similarityColor} fontSize="xs">
                                  {similarityLabel} ({similarRisk.similarityScore}%)
                                </Badge>
                              </HStack>
                              {similarRisk.risk.riskCategory && (
                                <Text fontSize="xs" color="gray.600">
                                  Category: {similarRisk.risk.riskCategory}
                                </Text>
                              )}
                            </VStack>
                            <HStack spacing={1}>
                              <Button
                                size="xs"
                                variant="outline"
                                leftIcon={<ViewIcon />}
                                onClick={() => onViewRisk(similarRisk.risk.id)}
                              >
                                View
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="blue"
                                leftIcon={<CopyIcon />}
                                onClick={() => onUseAsTemplate(similarRisk.risk.id)}
                              >
                                Use as Template
                              </Button>
                            </HStack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </Collapse>
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  onClick={onToggle}
                >
                  {isOpen ? 'Show Less' : `Show ${showMore.length} More`}
                </Button>
              </>
            )}
          </VStack>

          <HStack justify="flex-end" mt={2}>
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Continue Creating
            </Button>
          </HStack>
        </VStack>
      </AlertDescription>
    </Alert>
  );
}

