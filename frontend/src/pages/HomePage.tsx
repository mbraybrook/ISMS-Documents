import { Box, Heading, Text, VStack, Button, Link } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

export function HomePage() {
  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="xl" mb={4}>
          ISMS Document Management
        </Heading>
        <Text fontSize="lg" color="gray.600" mb={6}>
          Welcome to the ISMS Document Management and Compliance Application
        </Text>
        <Link as={RouterLink} to="/documents">
          <Button colorScheme="blue" size="lg">
            View Documents
          </Button>
        </Link>
      </Box>
    </VStack>
  )
}

