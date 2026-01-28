import { Box, Text } from '@chakra-ui/react';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

export function DataSensitivityFooter() {
  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      py={2}
      px={4}
      bg="transparent"
      textAlign="center"
      zIndex={1}
    >
      <Text
        fontSize="xs"
        color="gray.400"
        opacity={0.7}
      >
        Paythru Confidential • v{APP_VERSION}
      </Text>
    </Box>
  )
}


