import { Card, CardBody, Heading, Text, Button, Badge, HStack, VStack, Spinner } from '@chakra-ui/react';
import { DownloadIcon, LockIcon } from '@chakra-ui/icons';
import { trustApi } from '../services/trustApi';
import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import type { TrustDocument } from '../types/trust';

interface TrustDocumentCardProps {
  document: TrustDocument;
  onDownload?: () => void;
}

function TrustDocumentCard({ document, onDownload }: TrustDocumentCardProps) {
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (isDownloading) return; // Prevent multiple simultaneous downloads
    
    setIsDownloading(true);
    try {
      const { blob, filename } = await trustApi.downloadDocument(document.id);
      
      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Received empty file');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      // Use the actual filename from the response, or construct from document title
      // Don't hardcode .pdf extension - use the actual filename extension
      a.download = filename || document.title;
      a.style.display = 'none';
      window.document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay to ensure download starts
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

      if (onDownload) {
        onDownload();
      }
    } catch (error: unknown) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download document';
      const apiError = error as { response?: { data?: { error?: string } } };
      toast({
        title: 'Download failed',
        description: apiError.response?.data?.error || errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRequestAccess = () => {
    toast({
      title: 'Access Request',
      description: 'Please login or register to request access to this document.',
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  const isPrivate = document.visibilityLevel === 'private';
  const isRestricted = document.status?.toUpperCase() === 'RESTRICTED' || isPrivate;
  
  // Get document type badge text
  const getDocumentTypeBadge = () => {
    if (document.category === 'policy') return 'POLICY';
    if (document.category === 'certification') return 'CERTIFICATION';
    if (document.category === 'report') return 'REPORT';
    return document.type?.toUpperCase() || 'DOCUMENT';
  };

  // Get status badge color
  const getStatusColor = () => {
    const status = document.status?.toUpperCase();
    if (status === 'APPROVED') return 'green';
    if (status === 'RESTRICTED') return 'red';
    return 'gray';
  };

  return (
    <Card
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      _hover={{
        boxShadow: 'md',
        borderColor: 'blue.300',
      }}
      transition="all 0.2s"
    >
      <CardBody>
        <VStack align="stretch" spacing={4}>
          {/* Title and Type Badge */}
          <HStack justify="space-between" align="start">
            <VStack align="start" spacing={2} flex={1}>
              <HStack spacing={2} flexWrap="wrap">
                <Heading size="sm" color="gray.900">
                  {document.title}
                </Heading>
                <Badge
                  colorScheme="blue"
                  fontSize="xs"
                  px={2}
                  py={0.5}
                  borderRadius="md"
                  fontWeight="semibold"
                >
                  {getDocumentTypeBadge()}
                </Badge>
              </HStack>
              {document.publicDescription && (
                <Text color="gray.600" fontSize="sm">
                  {document.publicDescription}
                </Text>
              )}
            </VStack>
          </HStack>

          {/* Version and Status */}
          <HStack spacing={2} flexWrap="wrap">
            <Text fontSize="xs" color="gray.500">
              Version {document.version}
            </Text>
            <Text fontSize="xs" color="gray.400">•</Text>
            <Badge
              colorScheme={getStatusColor()}
              fontSize="xs"
              px={2}
              py={0.5}
              borderRadius="md"
            >
              {document.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </HStack>

          {/* Action Button */}
          <HStack justify="flex-end">
            {isRestricted ? (
              <Button
                leftIcon={<LockIcon />}
                colorScheme="gray"
                size="sm"
                variant="outline"
                onClick={handleRequestAccess}
                isDisabled
              >
                Request Access
              </Button>
            ) : (
              <Button
                leftIcon={isDownloading ? <Spinner size="sm" /> : <DownloadIcon />}
                colorScheme="blue"
                size="sm"
                onClick={handleDownload}
                isLoading={isDownloading}
                loadingText="Preparing..."
                isDisabled={isDownloading}
              >
                Download
              </Button>
            )}
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
}

export { TrustDocumentCard };

