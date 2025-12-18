import { Box, Container, Flex, Heading, Link, Button, Text, Menu, MenuButton, MenuList, MenuItem, Badge, Image } from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { ReactNode, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { RoleSwitcher } from './RoleSwitcher'
import { DataSensitivityFooter } from './DataSensitivityFooter'
import api from '../services/api'
import bannerImage from '../assets/banner.png'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, getEffectiveRole } = useAuth()
  const effectiveRole = getEffectiveRole()
  const [proposedRisksCount, setProposedRisksCount] = useState(0)

  useEffect(() => {
    // Fetch proposed risks count for Editors/Admins
    if (effectiveRole === 'EDITOR' || effectiveRole === 'ADMIN') {
      api.get('/api/risks', {
        params: {
          view: 'inbox',
          page: 1,
          limit: 1,
        },
      })
        .then((response) => {
          setProposedRisksCount(response.data.pagination?.total || 0)
        })
        .catch((error) => {
          console.error('Error fetching proposed risks count:', error)
        })
    }
  }, [effectiveRole])

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottom="1px" borderColor="gray.200" mb={8}>
        <Container maxW="container.xl">
          <Flex py={4} justify="space-between" align="center">
            <Link as={RouterLink} to={effectiveRole === 'STAFF' || effectiveRole === 'CONTRIBUTOR' ? '/admin/staff' : '/admin'}>
              <Heading size="md">
                <Image src={bannerImage} height={100} alt="Paythru Trust Centre" />
              </Heading>
            </Link>
            <Flex gap={4} align="center">
              {user && (
                <>
                  {/* Role Switcher for Admin users */}
                  <RoleSwitcher />

                  {effectiveRole === 'STAFF' ? (
                    // Simplified navigation for STAFF users
                    <>
                      <Link as={RouterLink} to="/admin/staff" fontSize="sm">
                        My ISMS
                      </Link>
                      <Link as={RouterLink} to="/admin/staff/acknowledgments" fontSize="sm">
                        Acknowledgment
                      </Link>
                      <Link as={RouterLink} to="/admin/staff/documents" fontSize="sm">
                        Documents
                      </Link>
                    </>
                  ) : effectiveRole === 'CONTRIBUTOR' ? (
                    // Navigation for CONTRIBUTOR (Staff access + Risk contribution)
                    <>
                      <Link as={RouterLink} to="/admin/staff" fontSize="sm">
                        My ISMS
                      </Link>
                      <Link as={RouterLink} to="/admin/staff/acknowledgments" fontSize="sm">
                        Acknowledgment
                      </Link>
                      <Link as={RouterLink} to="/admin/staff/documents" fontSize="sm">
                        Documents
                      </Link>
                      <Link as={RouterLink} to="/admin/risks/department" fontSize="sm">
                        Department Risks
                      </Link>
                    </>
                  ) : (
                    // Full navigation for ADMIN/EDITOR
                    <>
                      {/* Documents Menu */}
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                          size="sm"
                          variant="ghost"
                          fontSize="sm"
                        >
                          <Box as="span" mr={2}>
                            Documents
                          </Box>
                        </MenuButton>
                        <MenuList>
                          <MenuItem as={RouterLink} to="/admin/documents/documents">
                            Library
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/documents/acknowledgments">
                            Acknowledgments
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/documents/reviews">
                            Reviews
                          </MenuItem>
                        </MenuList>
                      </Menu>

                      {/* Risk Management Menu */}
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                          size="sm"
                          variant="ghost"
                          fontSize="sm"
                        >
                          <Box as="span" mr={2}>
                            Risk Management
                          </Box>
                        </MenuButton>
                        <MenuList>
                          <MenuItem as={RouterLink} to="/admin/risks/risks">
                            Risk Register
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/risks/review">
                            Review Inbox
                            {proposedRisksCount > 0 && (
                              <Badge ml={2} colorScheme="red">
                                {proposedRisksCount}
                              </Badge>
                            )}
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/risks/controls">
                            Controls
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/soa">
                            Statement of Applicability
                          </MenuItem>
                        </MenuList>
                      </Menu>

                      {/* Organization Menu */}
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                          size="sm"
                          variant="ghost"
                          fontSize="sm"
                        >
                          <Box as="span" mr={2}>
                            Organization
                          </Box>
                        </MenuButton>
                        <MenuList>
                          <MenuItem as={RouterLink} to="/admin/assets/assets">
                            Assets
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/assets/asset-categories">
                            Asset Categories
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/suppliers">
                            Suppliers
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/risks/interested-parties">
                            Interested Parties
                          </MenuItem>
                          <MenuItem as={RouterLink} to="/admin/risks/legislation">
                            Legislation
                          </MenuItem>
                        </MenuList>
                      </Menu>

                      {/* System Menu */}
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                          size="sm"
                          variant="ghost"
                          fontSize="sm"
                        >
                          <Box as="span" mr={2}>
                            System
                          </Box>
                        </MenuButton>
                        <MenuList>
                          <MenuItem as={RouterLink} to="/admin/trust">
                            Trust Centre
                          </MenuItem>
                          {effectiveRole === 'ADMIN' && (
                            <MenuItem as={RouterLink} to="/admin/users">
                              User Management
                            </MenuItem>
                          )}
                        </MenuList>
                      </Menu>
                    </>
                  )}
                  <Text fontSize="sm" color="gray.600">
                    {user.displayName}
                  </Text>
                  <Button
                    as={RouterLink}
                    to="/admin/profile"
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
      <DataSensitivityFooter />
    </Box>
  )
}

