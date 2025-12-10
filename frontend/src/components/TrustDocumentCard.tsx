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

  const isPrivate = document.visibilityLevel === 'private';

  return (
    <Card
      bg={isPrivate ? 'purple.50' : 'white'}
      borderColor={isPrivate ? 'purple.200' : 'gray.200'}
      borderWidth={isPrivate ? '2px' : '1px'}
    >
      <CardBody>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="start">
            <VStack align="start" spacing={2} flex={1}>
              <HStack spacing={2}>
                <Heading size="md">{document.title}</Heading>
                {isPrivate && (
                  <Badge colorScheme="purple" display="inline-flex" alignItems="center" gap={1}>
                    <LockIcon boxSize={3} />
                    Private
                  </Badge>
                )}
              </HStack>
              {document.publicDescription && (
                <Text color="gray.600" fontSize="sm">
                  {document.publicDescription}
                </Text>
              )}
            </VStack>
            <Badge colorScheme={document.category === 'certification' ? 'green' : document.category === 'policy' ? 'blue' : 'purple'}>
              {document.category}
            </Badge>
          </HStack>

          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.500">
              Version {document.version} • {document.status}
            </Text>
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
          </HStack>

          {document.requiresNda && (
            <Badge colorScheme="orange" size="sm">
              Requires NDA
            </Badge>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

export { TrustDocumentCard };

