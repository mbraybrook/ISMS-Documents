import {
  Box,
  FormLabel,
  VStack,
  HStack,
  Badge,
  Text,
  IconButton,
  Tooltip,
  Spinner,
  InputGroup,
  InputLeftElement,
  Input,
  Button,
  Divider,
} from '@chakra-ui/react';
import { SearchIcon, DeleteIcon } from '@chakra-ui/icons';

interface LinkedControl {
  id: string;
  code: string;
  title: string;
  category: string | null;
}

interface DocumentControlLinkingProps {
  linkedControls: LinkedControl[];
  controlSearchTerm: string;
  setControlSearchTerm: (term: string) => void;
  availableControls: LinkedControl[];
  suggestedControls: LinkedControl[];
  searchingControls: boolean;
  loadingControls: boolean;
  loadingSuggestedControls: boolean;
  onSearchControls: () => void;
  onLinkControl: (controlId: string) => void;
  onUnlinkControl: (controlId: string) => void;
  onControlClick: (controlId: string) => Promise<void>;
  readOnly?: boolean;
}

export function DocumentControlLinking({
  linkedControls,
  controlSearchTerm,
  setControlSearchTerm,
  availableControls,
  suggestedControls,
  searchingControls,
  loadingControls,
  loadingSuggestedControls,
  onSearchControls,
  onLinkControl,
  onUnlinkControl,
  onControlClick,
  readOnly = false,
}: DocumentControlLinkingProps) {
  const handleControlClick = async (controlId: string) => {
    await onControlClick(controlId);
  };

  return (
    <>
      <Divider />
      <Box>
        <FormLabel fontWeight="bold" color="blue.600" mb={2}>
          Linked Controls ({linkedControls.length})
        </FormLabel>
        {loadingControls ? (
          <Spinner size="sm" />
        ) : (
          <>
            {linkedControls.length > 0 && (
              <VStack align="stretch" spacing={2} mb={4}>
                {linkedControls.map((control) => (
                  <Box
                    key={control.id}
                    p={2}
                    bg="white"
                    borderRadius="md"
                    border="1px"
                    borderColor="blue.200"
                    _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                  >
                    <HStack justify="space-between">
                      <HStack spacing={2} flex={1}>
                        <Badge
                          colorScheme="blue"
                          fontSize="xs"
                          cursor="pointer"
                          _hover={{ bg: "blue.600", color: "white" }}
                          onClick={() => handleControlClick(control.id)}
                        >
                          {control.code}
                        </Badge>
                        <Text
                          fontWeight="medium"
                          color="blue.700"
                          cursor="pointer"
                          _hover={{ textDecoration: "underline", color: "blue.900" }}
                          onClick={() => handleControlClick(control.id)}
                        >
                          {control.title}
                        </Text>
                        {control.category && (
                          <Badge fontSize="xs" colorScheme="gray">
                            {control.category}
                          </Badge>
                        )}
                      </HStack>
                      {!readOnly && (
                        <Tooltip label="Unlink control">
                          <IconButton
                            aria-label="Unlink control"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnlinkControl(control.id);
                            }}
                          />
                        </Tooltip>
                      )}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
            {!readOnly && (
              <VStack align="stretch" spacing={2}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.300" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search controls by code or title..."
                    value={controlSearchTerm}
                    onChange={(e) => {
                      setControlSearchTerm(e.target.value);
                      if (e.target.value.trim()) {
                        onSearchControls();
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && controlSearchTerm.trim()) {
                        e.preventDefault();
                        onSearchControls();
                      }
                    }}
                  />
                </InputGroup>
                {searchingControls && (
                  <HStack>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="gray.500">Searching...</Text>
                  </HStack>
                )}
                {availableControls.length > 0 && (
                  <Box
                    maxH="200px"
                    overflowY="auto"
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    p={2}
                  >
                    <VStack align="stretch" spacing={2}>
                      {availableControls.map((control) => (
                        <Box
                          key={control.id}
                          p={2}
                          bg="gray.50"
                          borderRadius="md"
                          border="1px"
                          borderColor="gray.200"
                          _hover={{ bg: "gray.100", borderColor: "blue.300" }}
                        >
                          <HStack spacing={2} justify="space-between">
                            <HStack
                              spacing={2}
                              flex={1}
                              cursor="pointer"
                              onClick={() => handleControlClick(control.id)}
                            >
                              <Badge
                                colorScheme="blue"
                                fontSize="xs"
                                _hover={{ bg: "blue.600", color: "white" }}
                              >
                                {control.code}
                              </Badge>
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                _hover={{ textDecoration: "underline" }}
                              >
                                {control.title}
                              </Text>
                              {control.category && (
                                <Badge fontSize="xs" colorScheme="gray">
                                  {control.category}
                                </Badge>
                              )}
                            </HStack>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLinkControl(control.id);
                              }}
                            >
                              Link
                            </Button>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}
                {controlSearchTerm.trim() && availableControls.length === 0 && !searchingControls && (
                  <Text fontSize="sm" color="gray.500">
                    No controls found matching "{controlSearchTerm}"
                  </Text>
                )}

                {/* Suggested Controls Section */}
                {!controlSearchTerm.trim() && suggestedControls.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>
                      Suggested Controls (based on document title):
                    </Text>
                    {loadingSuggestedControls ? (
                      <HStack>
                        <Spinner size="sm" />
                        <Text fontSize="sm" color="gray.500">Loading suggestions...</Text>
                      </HStack>
                    ) : (
                      <Box
                        maxH="200px"
                        overflowY="auto"
                        border="1px"
                        borderColor="blue.200"
                        borderRadius="md"
                        p={2}
                        bg="blue.50"
                      >
                        <VStack align="stretch" spacing={2}>
                          {suggestedControls.map((control) => (
                            <Box
                              key={control.id}
                              p={2}
                              bg="white"
                              borderRadius="md"
                              border="1px"
                              borderColor="blue.200"
                              _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                            >
                              <HStack spacing={2} justify="space-between">
                                <HStack
                                  spacing={2}
                                  flex={1}
                                  cursor="pointer"
                                  onClick={() => handleControlClick(control.id)}
                                >
                                  <Badge
                                    colorScheme="blue"
                                    fontSize="xs"
                                    _hover={{ bg: "blue.600", color: "white" }}
                                  >
                                    {control.code}
                                  </Badge>
                                  <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    _hover={{ textDecoration: "underline" }}
                                  >
                                    {control.title}
                                  </Text>
                                  {control.category && (
                                    <Badge fontSize="xs" colorScheme="gray">
                                      {control.category}
                                    </Badge>
                                  )}
                                </HStack>
                                <Button
                                  size="xs"
                                  colorScheme="blue"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLinkControl(control.id);
                                  }}
                                >
                                  Link
                                </Button>
                              </HStack>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                )}
              </VStack>
            )}
          </>
        )}
      </Box>
    </>
  );
}

