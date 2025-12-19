import { Box, Heading, Text, SimpleGrid, Card, CardBody, VStack, HStack, Badge, Link, Spinner } from '@chakra-ui/react';
import { DownloadIcon, LockIcon } from '@chakra-ui/icons';
import { useEffect, useState } from 'react';
import { trustApi } from '../services/trustApi';
import { useToast } from '@chakra-ui/react';
import { useTrustAuth } from '../contexts/TrustAuthContext';

interface Certification {
  id: string;
  name: string;
  type: 'certified' | 'compliant';
  description: string;
  validUntil: string | null;
  displayOrder: number;
  documentCount: number;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    version: string;
    status: string;
    visibilityLevel: string;
  }>;
}

export function TrustCenterCertifications() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [_loading, setLoading] = useState(true);
  const [downloadingDocs, setDownloadingDocs] = useState<Set<string>>(new Set());
  const toast = useToast();
  const { isAuthenticated } = useTrustAuth();

  useEffect(() => {
    const loadCertifications = async () => {
      try {
        setLoading(true);
        const data = await trustApi.getCertifications();
        console.log('[TrustCenterCertifications] Loaded certifications:', data);
        // Filter out SOC 2 Type II and sort by displayOrder
        const filtered = data.filter(cert => cert.id !== 'soc2' && cert.name !== 'SOC 2 Type II');
        const sorted = [...filtered].sort((a, b) => a.displayOrder - b.displayOrder);
        console.log('[TrustCenterCertifications] Filtered and sorted:', sorted);
        setCertifications(sorted);
      } catch (error) {
        console.error('Error loading certifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCertifications();
  }, []);

  // Default certifications if API returns empty
  const defaultCertifications: Certification[] = [
    {
      id: 'iso27001',
      name: 'ISO 27001',
      type: 'certified',
      description: 'Information Security Management',
      validUntil: '2025-12-31',
      displayOrder: 1,
      documentCount: 0,
      documents: [],
    },
    {
      id: 'gdpr',
      name: 'GDPR',
      type: 'compliant',
      description: 'General Data Protection Regulation',
      validUntil: null,
      displayOrder: 3,
      documentCount: 0,
      documents: [],
    },
    {
      id: 'hipaa',
      name: 'HIPAA',
      type: 'compliant',
      description: 'Health Information Privacy',
      validUntil: null,
      displayOrder: 4,
      documentCount: 0,
      documents: [],
    },
    {
      id: 'pci',
      name: 'PCI DSS',
      type: 'certified',
      description: 'Payment Card Industry Standard',
      validUntil: '2025-03-31',
      displayOrder: 5,
      documentCount: 0,
      documents: [],
    },
  ];

  const displayCertifications = certifications.length > 0 ? certifications : defaultCertifications;

  const formatValidUntil = (dateString: string | null): string => {
    if (!dateString) return 'Ongoing';
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      return `Valid until: ${month} ${year}`;
    } catch {
      return 'Ongoing';
    }
  };

  const handleDocumentDownload = async (docId: string, docTitle: string, visibilityLevel: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    // Check if document is private and user is not authenticated
    if (visibilityLevel === 'private' && !isAuthenticated) {
      toast({
        title: 'Access Required',
        description: 'Please login or register to access this document.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    if (downloadingDocs.has(docId)) return;
    
    setDownloadingDocs(prev => new Set(prev).add(docId));
    
    try {
      const { blob, filename } = await trustApi.downloadDocument(docId);
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty file');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename || docTitle;
      a.style.display = 'none';
      window.document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        window.document.body.removeChild(a);
      }, 100);

      toast({
        title: 'Download started',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: unknown) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download document';
      const apiError = error as { response?: { data?: { error?: string } } };
      
      // Check if it's an authentication error
      if (apiError.response?.data?.error?.includes('Authentication required')) {
        toast({
          title: 'Access Required',
          description: 'Please login or register to access this document.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Download failed',
          description: apiError.response?.data?.error || errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setDownloadingDocs(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleViewAllDocuments = (cert: Certification, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Update URL hash for bookmarkability
    window.history.pushState(null, '', `#cert-${cert.id}`);
    
    // Scroll to the specific certification's documents section
    const certElement = document.getElementById(`cert-${cert.id}`);
    if (certElement) {
      certElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll to documents section if specific cert not found
      const documentsSection = document.getElementById('documents');
      if (documentsSection) {
        documentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <Box
      id="certifications"
      py={16}
      px={{ base: 4, md: 8 }}
      bg="gray.50"
    >
      <Box maxW="container.xl" mx="auto">
        <VStack spacing={8} align="stretch">
          <VStack spacing={4} align="start">
            <Heading as="h2" size="xl" color="gray.900">
              Certifications & Compliance
            </Heading>
            <Text fontSize="lg" color="gray.600" maxW="2xl">
              We maintain rigorous compliance with industry-leading security standards and regulations.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {displayCertifications.map((cert) => (
              <Card
                key={cert.id}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="lg"
                _hover={{
                  boxShadow: 'md',
                  borderColor: cert.type === 'certified' ? 'green.300' : 'blue.300',
                }}
                transition="all 0.2s"
              >
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <HStack justify="space-between" w="100%">
                      <Heading as="h3" size="md" color="gray.900">
                        {cert.name}
                      </Heading>
                      <Badge
                        colorScheme={cert.type === 'certified' ? 'green' : 'blue'}
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="xs"
                        fontWeight="semibold"
                      >
                        {cert.type === 'certified' ? 'Certified' : 'Compliant'}
                      </Badge>
                    </HStack>
                    <Text color="gray.600" fontSize="sm">
                      {cert.description}
                    </Text>
                    <Text color="gray.500" fontSize="xs" fontStyle="italic">
                      {formatValidUntil(cert.validUntil)}
                    </Text>
                    
                    {/* Key Certification Documents */}
                    {cert.documentCount > 0 && (
                      <Box w="100%" pt={3} borderTopWidth="1px" borderColor="gray.200">
                        <Text fontSize="xs" color="gray.600" fontWeight="semibold" mb={3}>
                          Key Documents
                        </Text>
                        <VStack align="stretch" spacing={2}>
                          {cert.documents.slice(0, 3).map((doc) => {
                            const isPrivate = doc.visibilityLevel === 'private';
                            const isRestricted = isPrivate && !isAuthenticated;
                            
                            return (
                              <Box
                                key={doc.id}
                                as="button"
                                onClick={(e: React.MouseEvent) => handleDocumentDownload(doc.id, doc.title, doc.visibilityLevel, e)}
                                disabled={downloadingDocs.has(doc.id) || isRestricted}
                                p={2}
                                borderRadius="md"
                                borderWidth="1px"
                                borderColor={
                                  isRestricted
                                    ? 'gray.300'
                                    : cert.type === 'certified'
                                    ? 'green.200'
                                    : 'blue.200'
                                }
                                bg={
                                  isRestricted
                                    ? 'gray.50'
                                    : cert.type === 'certified'
                                    ? 'green.50'
                                    : 'blue.50'
                                }
                                _hover={
                                  isRestricted
                                    ? {}
                                    : {
                                        bg: cert.type === 'certified' ? 'green.100' : 'blue.100',
                                        borderColor: cert.type === 'certified' ? 'green.300' : 'blue.300',
                                      }
                                }
                                _disabled={{
                                  opacity: 0.6,
                                  cursor: 'not-allowed',
                                }}
                                transition="all 0.2s"
                                cursor={isRestricted ? 'not-allowed' : 'pointer'}
                                textAlign="left"
                              >
                                <HStack spacing={2} align="start">
                                  {downloadingDocs.has(doc.id) ? (
                                    <Spinner size="xs" mt={1} />
                                  ) : isRestricted ? (
                                    <LockIcon
                                      boxSize={3}
                                      mt={1}
                                      color="gray.500"
                                    />
                                  ) : (
                                    <DownloadIcon
                                      boxSize={3}
                                      mt={1}
                                      color={cert.type === 'certified' ? 'green.600' : 'blue.600'}
                                    />
                                  )}
                                  <VStack align="start" spacing={0} flex={1}>
                                    <Text
                                      fontSize="xs"
                                      color={isRestricted ? 'gray.500' : 'gray.700'}
                                      fontWeight="medium"
                                      noOfLines={2}
                                    >
                                      {doc.title}
                                    </Text>
                                    {isRestricted && (
                                      <Text
                                        fontSize="2xs"
                                        color="gray.500"
                                        fontStyle="italic"
                                        mt={0.5}
                                      >
                                        Login or Request Access
                                      </Text>
                                    )}
                                  </VStack>
                                </HStack>
                              </Box>
                            );
                          })}
                          {cert.documentCount > 3 && (
                            <Link
                              href={`#cert-${cert.id}`}
                              onClick={(e) => handleViewAllDocuments(cert, e)}
                              fontSize="xs"
                              color={cert.type === 'certified' ? 'green.600' : 'blue.600'}
                              fontWeight="semibold"
                              _hover={{ textDecoration: 'underline' }}
                              mt={1}
                            >
                              View all {cert.documentCount} documents →
                            </Link>
                          )}
                        </VStack>
                      </Box>
                    )}
                    
                    {cert.documentCount === 0 && (
                      <Box w="100%" pt={3} borderTopWidth="1px" borderColor="gray.200">
                        <Link
                          href={`#documents`}
                          onClick={(e) => {
                            e.preventDefault();
                            const documentsSection = document.getElementById('documents');
                            if (documentsSection) {
                              documentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          fontSize="xs"
                          color={cert.type === 'certified' ? 'green.600' : 'blue.600'}
                          fontWeight="semibold"
                          _hover={{ textDecoration: 'underline' }}
                        >
                          View documentation →
                        </Link>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>
      </Box>
    </Box>
  );
}

