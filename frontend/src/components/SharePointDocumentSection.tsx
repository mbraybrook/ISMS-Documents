import {
  FormControl,
  FormLabel,
  Input,
  Button,
  HStack,
  VStack,
  Alert,
  AlertIcon,
  AlertDescription,
  Text,
  Box,
  Link,
} from '@chakra-ui/react';
import { SharePointFileBrowser } from './SharePointFileBrowser';
import type { DocumentFormData, Document } from '../utils/documentForm';
import type { SharePointItem } from '../hooks/useSharePointIntegration';

interface SharePointDocumentSectionProps {
  formData: DocumentFormData;
  readOnly?: boolean;
  document: Document | null;
  onFileSelect: (item: SharePointItem) => void;
  onUrlParse: () => void;
  sharePointUrl: string;
  setSharePointUrl: (url: string) => void;
  parsingUrl: boolean;
  urlError: string | null;
  setUrlError: (error: string | null) => void;
  documentUrl: string | null;
  loadingUrl: boolean;
  showReplaceOptions: boolean;
  onToggleReplace: () => void;
  browserOpen: boolean;
  setBrowserOpen: (open: boolean) => void;
}

export function SharePointDocumentSection({
  formData,
  readOnly = false,
  document,
  onFileSelect,
  onUrlParse,
  sharePointUrl,
  setSharePointUrl,
  parsingUrl,
  urlError,
  setUrlError,
  documentUrl,
  loadingUrl,
  showReplaceOptions,
  onToggleReplace,
  browserOpen,
  setBrowserOpen,
}: SharePointDocumentSectionProps) {
  if (!document) {
    // Create mode: Show paste URL and browse options
    return (
      <>
        <FormControl>
          <FormLabel>SharePoint Link (Optional)</FormLabel>
          <HStack spacing={2}>
            <Input
              placeholder="Paste SharePoint file URL here"
              value={sharePointUrl}
              onChange={(e) => {
                setSharePointUrl(e.target.value);
                setUrlError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onUrlParse();
                }
              }}
            />
            <Button
              onClick={onUrlParse}
              isLoading={parsingUrl}
              colorScheme="blue"
              size="md"
            >
              Parse URL
            </Button>
          </HStack>
          {urlError && (
            <Alert status="error" mt={2} size="sm">
              <AlertIcon />
              <AlertDescription>{urlError}</AlertDescription>
            </Alert>
          )}
        </FormControl>
        <FormControl>
          <FormLabel>Or Browse SharePoint</FormLabel>
          <VStack align="stretch" spacing={2}>
            <Button
              onClick={() => setBrowserOpen(true)}
              colorScheme="blue"
              variant="outline"
              width="100%"
            >
              Browse SharePoint Files
            </Button>
            {formData.sharePointItemId && (
              <Box
                p={3}
                bg="green.50"
                borderRadius="md"
                borderWidth="1px"
                borderColor="green.200"
              >
                <Text fontSize="sm" fontWeight="medium" color="green.800">
                  Selected: {formData.title || 'SharePoint File'}
                </Text>
                <Text fontSize="xs" color="green.600" mt={1}>
                  Item ID: {formData.sharePointItemId}
                </Text>
              </Box>
            )}
          </VStack>
        </FormControl>
        <SharePointFileBrowser
          isOpen={browserOpen}
          onClose={() => setBrowserOpen(false)}
          onSelect={onFileSelect}
          defaultSiteId={formData.sharePointSiteId || undefined}
          driveId={formData.sharePointDriveId || undefined}
          allowSiteSelection={true}
        />
      </>
    );
  }

  // Edit/View mode: Show document link and replace option
  if (!showReplaceOptions) {
    return (
      <>
        <FormControl>
          <FormLabel>SharePoint Document</FormLabel>
          <VStack align="start" spacing={2}>
            {loadingUrl ? (
              <Text fontSize="sm" color="gray.500">Loading document link...</Text>
            ) : documentUrl ? (
              <HStack spacing={2} align="center">
                <Link href={documentUrl} isExternal color="blue.500" fontWeight="medium">
                  Open in SharePoint
                </Link>
                {formData.sharePointItemId && (
                  <Text fontSize="xs" color="gray.500">
                    (ID: {formData.sharePointItemId})
                  </Text>
                )}
              </HStack>
            ) : formData.sharePointItemId ? (
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.500">Document link unavailable</Text>
                <Text fontSize="xs" color="gray.500">
                  Item ID: {formData.sharePointItemId}
                </Text>
              </VStack>
            ) : (
              <Text fontSize="sm" color="gray.500">No SharePoint document selected</Text>
            )}
            {!readOnly && (
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleReplace}
              >
                Replace Document
              </Button>
            )}
          </VStack>
        </FormControl>
      </>
    );
  }

  // Replace mode
  return (
    <>
      <FormControl>
        <FormLabel>Replace SharePoint Document</FormLabel>
        <VStack spacing={3} align="stretch">
          <HStack spacing={2}>
            <Input
              placeholder="Paste SharePoint file URL here"
              value={sharePointUrl}
              onChange={(e) => {
                setSharePointUrl(e.target.value);
                setUrlError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onUrlParse();
                }
              }}
            />
            <Button
              onClick={onUrlParse}
              isLoading={parsingUrl}
              colorScheme="blue"
              size="md"
            >
              Parse URL
            </Button>
          </HStack>
          {urlError && (
            <Alert status="error" size="sm">
              <AlertIcon />
              <AlertDescription>{urlError}</AlertDescription>
            </Alert>
          )}
          <Text textAlign="center" fontSize="sm" color="gray.500">OR</Text>
          <Button
            onClick={() => setBrowserOpen(true)}
            colorScheme="blue"
            variant="outline"
            width="100%"
          >
            Browse SharePoint Files
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onToggleReplace();
              setSharePointUrl('');
              setUrlError(null);
            }}
          >
            Cancel
          </Button>
        </VStack>
      </FormControl>
      <SharePointFileBrowser
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={onFileSelect}
        defaultSiteId={formData.sharePointSiteId || undefined}
        driveId={formData.sharePointDriveId || undefined}
        allowSiteSelection={true}
      />
    </>
  );
}

