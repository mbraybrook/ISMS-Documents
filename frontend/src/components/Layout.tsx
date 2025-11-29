import { Box, Container, Flex, Heading, Link, Button, Text, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
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
                  <Menu>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="sm" variant="ghost" fontSize="sm">
                      Document Management
                    </MenuButton>
                    <MenuList>
                      <MenuItem as={RouterLink} to="/documents/documents">
                        Documents
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/documents/acknowledgments">
                        Acknowledgment
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/documents/reviews">
                        Reviews
                      </MenuItem>
                    </MenuList>
                  </Menu>
                  <Menu>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="sm" variant="ghost" fontSize="sm">
                      Risk Management
                    </MenuButton>
                    <MenuList>
                      <MenuItem as={RouterLink} to="/risks/risks">
                        Risks
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/risks/controls">
                        Controls
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/risks/interested-parties">
                        Interested Parties
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/risks/legislation">
                        Legislation
                      </MenuItem>
                    </MenuList>
                  </Menu>
                  <Menu>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="sm" variant="ghost" fontSize="sm">
                      Asset Management
                    </MenuButton>
                    <MenuList>
                      <MenuItem as={RouterLink} to="/assets/assets">
                        Assets
                      </MenuItem>
                      <MenuItem as={RouterLink} to="/assets/asset-categories">
                        Asset Categories
                      </MenuItem>
                    </MenuList>
                  </Menu>
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

