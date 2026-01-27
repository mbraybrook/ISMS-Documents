import { Box, Container, Flex, Heading, Link, Button, Text, Menu, MenuButton, MenuList, MenuItem, Badge, Image, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, IconButton, VStack, useDisclosure } from '@chakra-ui/react'
import { ChevronDownIcon, HamburgerIcon } from '@chakra-ui/icons'
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
  const { isOpen, onOpen, onClose } = useDisclosure()

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

  // Helper function to render navigation items (used in both desktop and mobile)
  const renderNavigationItems = (isMobile = false) => {
    if (effectiveRole === 'STAFF') {
      return (
        <>
          <Link as={RouterLink} to="/admin/staff" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            My ISMS
          </Link>
          <Link as={RouterLink} to="/admin/staff/acknowledgments" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Acknowledgment
          </Link>
          <Link as={RouterLink} to="/admin/staff/documents" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Documents
          </Link>
          <Link as={RouterLink} to="/admin/risks/risks" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Risk Register
          </Link>
        </>
      )
    } else if (effectiveRole === 'CONTRIBUTOR') {
      return (
        <>
          <Link as={RouterLink} to="/admin/staff" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            My ISMS
          </Link>
          <Link as={RouterLink} to="/admin/staff/acknowledgments" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Acknowledgment
          </Link>
          <Link as={RouterLink} to="/admin/staff/documents" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Documents
          </Link>
          <Link as={RouterLink} to="/admin/risks/department" fontSize={isMobile ? "md" : "sm"} py={isMobile ? 2 : 0} onClick={isMobile ? onClose : undefined}>
            Department Risks
          </Link>
        </>
      )
    } else {
      // Full navigation for ADMIN/EDITOR
      return (
        <>
          {/* Documents Menu */}
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<ChevronDownIcon />}
              size={isMobile ? "md" : "sm"}
              variant="ghost"
              fontSize={isMobile ? "md" : "sm"}
              w={isMobile ? "100%" : "auto"}
              justifyContent={isMobile ? "space-between" : "flex-start"}
            >
              <Box as="span" mr={2}>
                Documents
              </Box>
            </MenuButton>
            <MenuList>
              <MenuItem as={RouterLink} to="/admin/documents/documents" onClick={isMobile ? onClose : undefined}>
                Library
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/documents/acknowledgments" onClick={isMobile ? onClose : undefined}>
                Acknowledgments
              </MenuItem>
              {(effectiveRole === 'EDITOR' || effectiveRole === 'ADMIN') && (
                <MenuItem as={RouterLink} to="/admin/documents/acknowledgments/reporting" onClick={isMobile ? onClose : undefined}>
                  Acknowledgment Reporting
                </MenuItem>
              )}
              {effectiveRole === 'ADMIN' && (
                <MenuItem as={RouterLink} to="/admin/documents/acknowledgments/config" onClick={isMobile ? onClose : undefined}>
                  Acknowledgment Config
                </MenuItem>
              )}
              <MenuItem as={RouterLink} to="/admin/documents/reviews" onClick={isMobile ? onClose : undefined}>
                Reviews
              </MenuItem>
            </MenuList>
          </Menu>

          {/* Risk Management Menu */}
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<ChevronDownIcon />}
              size={isMobile ? "md" : "sm"}
              variant="ghost"
              fontSize={isMobile ? "md" : "sm"}
              w={isMobile ? "100%" : "auto"}
              justifyContent={isMobile ? "space-between" : "flex-start"}
            >
              <Box as="span" mr={2}>
                Risk Management
              </Box>
            </MenuButton>
            <MenuList>
              <MenuItem as={RouterLink} to="/admin/risks/risks" onClick={isMobile ? onClose : undefined}>
                Risk Register
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/risks/review" onClick={isMobile ? onClose : undefined}>
                Review Inbox
                {proposedRisksCount > 0 && (
                  <Badge ml={2} colorScheme="red">
                    {proposedRisksCount}
                  </Badge>
                )}
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/risks/controls" onClick={isMobile ? onClose : undefined}>
                Controls
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/soa" onClick={isMobile ? onClose : undefined}>
                Statement of Applicability
              </MenuItem>
            </MenuList>
          </Menu>

          {/* Organization Menu */}
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<ChevronDownIcon />}
              size={isMobile ? "md" : "sm"}
              variant="ghost"
              fontSize={isMobile ? "md" : "sm"}
              w={isMobile ? "100%" : "auto"}
              justifyContent={isMobile ? "space-between" : "flex-start"}
            >
              <Box as="span" mr={2}>
                Organization
              </Box>
            </MenuButton>
            <MenuList>
              <MenuItem as={RouterLink} to="/admin/assets/assets" onClick={isMobile ? onClose : undefined}>
                Assets
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/assets/asset-categories" onClick={isMobile ? onClose : undefined}>
                Asset Categories
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/suppliers" onClick={isMobile ? onClose : undefined}>
                Suppliers
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/risks/interested-parties" onClick={isMobile ? onClose : undefined}>
                Interested Parties
              </MenuItem>
              <MenuItem as={RouterLink} to="/admin/risks/legislation" onClick={isMobile ? onClose : undefined}>
                Legislation
              </MenuItem>
            </MenuList>
          </Menu>

          {/* System Menu */}
          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<ChevronDownIcon />}
              size={isMobile ? "md" : "sm"}
              variant="ghost"
              fontSize={isMobile ? "md" : "sm"}
              w={isMobile ? "100%" : "auto"}
              justifyContent={isMobile ? "space-between" : "flex-start"}
            >
              <Box as="span" mr={2}>
                System
              </Box>
            </MenuButton>
            <MenuList>
              <MenuItem as={RouterLink} to="/admin/trust" onClick={isMobile ? onClose : undefined}>
                Trust Centre
              </MenuItem>
              {effectiveRole === 'ADMIN' && (
                <MenuItem as={RouterLink} to="/admin/users" onClick={isMobile ? onClose : undefined}>
                  User Management
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </>
      )
    }
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottom="1px" borderColor="gray.200" mb={8}>
        <Container maxW="container.xl">
          <Flex py={{ base: 3, md: 4 }} justify="space-between" align="center">
            <Link as={RouterLink} to={effectiveRole === 'STAFF' || effectiveRole === 'CONTRIBUTOR' ? '/admin/staff' : '/admin'}>
              <Heading size="md">
                <Image 
                  src={bannerImage} 
                  maxH={{ base: 50, md: 100 }} 
                  h="auto"
                  w="auto"
                  alt="Paythru Trust Centre" 
                />
              </Heading>
            </Link>
            <Flex gap={4} align="center">
              {/* Mobile hamburger menu button */}
              {user && (
                <IconButton
                  aria-label="Open navigation menu"
                  icon={<HamburgerIcon />}
                  variant="ghost"
                  size="md"
                  display={{ base: 'flex', md: 'none' }}
                  onClick={onOpen}
                />
              )}
              {/* Desktop navigation */}
              <Flex gap={4} align="center" display={{ base: 'none', md: 'flex' }}>
                {user && (
                  <>
                    {/* Role Switcher for Admin users */}
                    <RoleSwitcher />
                    {renderNavigationItems(false)}
                    <Text fontSize="sm" color="gray.600" display={{ base: 'none', md: 'block' }}>
                      {user.displayName}
                    </Text>
                    <Button
                      as={RouterLink}
                      to="/admin/profile"
                      size="sm"
                      variant="ghost"
                      display={{ base: 'none', md: 'flex' }}
                    >
                      Profile
                    </Button>
                  </>
                )}
              </Flex>
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Mobile Navigation Drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            <Text fontSize="md" color="gray.600">
              {user?.displayName}
            </Text>
          </DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={4} mt={4}>
              <RoleSwitcher />
              {renderNavigationItems(true)}
              <Button
                as={RouterLink}
                to="/admin/profile"
                size="md"
                variant="ghost"
                w="100%"
                justifyContent="flex-start"
                onClick={onClose}
              >
                Profile
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Container maxW="container.xl" py={{ base: 4, md: 8 }}>
        {children}
      </Container>
      <DataSensitivityFooter />
    </Box>
  )
}

