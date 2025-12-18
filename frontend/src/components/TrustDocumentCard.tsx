import { Card, CardBody, Heading, IconButton, HStack, Spinner, Tooltip, Box } from '@chakra-ui/react';
import { DownloadIcon, LockIcon } from '@chakra-ui/icons';
import { trustApi } from '../services/trustApi';
import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import type { TrustDocument } from '../types/trust';

interface TrustDocumentCardProps {
  document: TrustDocument;
  onDownload?: () => void;
  isAuthenticated?: boolean;
}

function TrustDocumentCard({ document, onDownload, isAuthenticated = false }: TrustDocumentCardProps) {
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent card click when clicking download icon
    }
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

  const handleRequestAccess = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent card click when clicking lock icon
    }
    toast({
      title: 'Access Request',
      description: 'Please login or register to access to this document.',
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  const isPrivate = document.visibilityLevel === 'private';
  const isRestricted = document.status?.toUpperCase() === 'RESTRICTED';
  const canDownload = !isRestricted && (!isPrivate || isAuthenticated);
  
  const handleCardClick = () => {
    if (canDownload) {
      handleDownload();
    } else {
      handleRequestAccess();
    }
  };

  // Format date for tooltip
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Build tooltip content as string
  const tooltipContent = `${document.title}\nVersion ${document.version} • ${document.status?.toUpperCase() || 'UNKNOWN'}\nLast Modified: ${formatDate(document.updatedAt)}`;

  return (
    <Tooltip label={tooltipContent} placement="top" hasArrow whiteSpace="pre-line">
      <Card
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="lg"
        cursor={canDownload ? 'pointer' : 'not-allowed'}
        onClick={handleCardClick}
        _hover={{
          boxShadow: 'md',
          borderColor: canDownload ? 'blue.300' : 'gray.300',
        }}
        transition="all 0.2s"
      >
        <CardBody p={3}>
          <HStack justify="space-between" align="center" spacing={3}>
            {/* Title */}
            <Heading size="sm" color="gray.900" noOfLines={1} flex={1}>
              {document.title}
            </Heading>

            {/* Icon Button */}
            <Box flexShrink={0}>
              {isRestricted || !canDownload ? (
                <IconButton
                  aria-label="Access restricted"
                  icon={<LockIcon />}
                  colorScheme="gray"
                  size="sm"
                  variant="ghost"
                  onClick={handleRequestAccess}
                  isDisabled={isRestricted}
                />
              ) : (
                <IconButton
                  aria-label="Download document"
                  icon={isDownloading ? <Spinner size="sm" /> : <DownloadIcon />}
                  colorScheme="blue"
                  size="sm"
                  variant="ghost"
                  onClick={handleDownload}
                  isLoading={isDownloading}
                  isDisabled={isDownloading}
                />
              )}
            </Box>
          </HStack>
        </CardBody>
      </Card>
    </Tooltip>
  );
}

export { TrustDocumentCard };

