import { Box, Container, Flex, Heading, Link, Button, Text } from '@chakra-ui/react'
import { ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth()

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottom="1px" borderColor="gray.200" mb={8}>
        <Container maxW="container.xl">
          <Flex py={4} justify="space-between" align="center">
            <Link as={RouterLink} to="/">
              <Heading size="md">ISMS Document Management</Heading>
            </Link>
            <Flex gap={4} align="center">
              {user && (
                <>
                  <Link as={RouterLink} to="/documents" fontSize="sm">
                    Documents
                  </Link>
                  <Link as={RouterLink} to="/acknowledgments" fontSize="sm">
                    Acknowledgment
                  </Link>
                  <Link as={RouterLink} to="/reviews" fontSize="sm">
                    Reviews
                  </Link>
                  <Link as={RouterLink} to="/risks" fontSize="sm">
                    Risks
                  </Link>
                  <Link as={RouterLink} to="/controls" fontSize="sm">
                    Controls
                  </Link>
                  {(user.role === 'ADMIN' || user.role === 'EDITOR') && (
                    <Link as={RouterLink} to="/soa" fontSize="sm">
                      SoA Export
                    </Link>
                  )}
                  <Text fontSize="sm" color="gray.600">
                    {user.displayName}
                  </Text>
                  <Button
                    as={RouterLink}
                    to="/profile"
                    size="sm"
                    variant="ghost"
                  >
                    Profile
                  </Button>
                </>
              )}
            </Flex>
          </Flex>
        </Container>
      </Box>
      <Container maxW="container.xl" py={8}>
        {children}
      </Container>
    </Box>
  )
}

