/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface VersionUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  documentId: string;
  onSuccess: () => void;
  currentLastReviewDate?: string | null;
  currentNextReviewDate?: string | null;
}

export function VersionUpdateModal({
  isOpen,
  onClose,
  currentVersion,
  documentId,
  onSuccess,
  currentLastReviewDate: _currentLastReviewDate,
  currentNextReviewDate: _currentNextReviewDate,
}: VersionUpdateModalProps) {
  // Unused parameters - kept for API compatibility
  void _currentLastReviewDate;
  void _currentNextReviewDate;
  const toast = useToast();
  const [newVersion, setNewVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [lastReviewDate, setLastReviewDate] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or currentVersion changes
  useEffect(() => {
    if (isOpen) {
      // Suggest next version (simple increment for numeric versions)
      const versionMatch = currentVersion.match(/^(\d+)(\.\d+)?(.*)$/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10);
        const suggested = `${major + 1}${versionMatch[2] || ''}${versionMatch[3] || ''}`;
        setNewVersion(suggested);
      } else {
        setNewVersion('');
      }
      setNotes('');
      setError(null);
      
      // Default last review date to today
      const today = new Date();
      setLastReviewDate(today.toISOString().split('T')[0]);
      
      // Default next review date to today + 1 year
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      setNextReviewDate(nextYear.toISOString().split('T')[0]);
    }
  }, [isOpen, currentVersion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newVersion.trim()) {
      setError('New version is required');
      return;
    }

    if (!notes.trim()) {
      setError('Version notes are required');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        currentVersion,
        newVersion: newVersion.trim(),
        notes: notes.trim(),
      };
      
      // Include review dates if provided (can be empty strings to clear)
      if (lastReviewDate) {
        payload.lastReviewDate = lastReviewDate;
      } else {
        payload.lastReviewDate = null;
      }
      
      if (nextReviewDate) {
        payload.nextReviewDate = nextReviewDate;
      } else {
        payload.nextReviewDate = null;
      }
      
      await api.post(`/api/documents/${documentId}/version-updates`, payload);

      toast({
        title: 'Success',
        description: 'Document version updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating version:', error);
      
      if (error.response?.status === 409) {
        const errorData = error.response.data;
        setError(
          errorData.message || 
          'Document version has changed. Please refresh the page and try again.'
        );
        toast({
          title: 'Version Conflict',
          description: errorData.message || 'The document version has changed. Please refresh and try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
      } else {
        const errorMessage = error.response?.data?.error || 'Failed to update document version';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Update Document Version</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormControl>
                <FormLabel>Current Version</FormLabel>
                <Input value={currentVersion} isReadOnly bg="gray.50" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>New Version</FormLabel>
                <Input
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="e.g., 2.0"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Enter the new version number for this document
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Version Notes</FormLabel>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Briefly describe what changed in this version..."
                  rows={3}
                  resize="vertical"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Briefly describe what changed in this version.
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Last Review Date</FormLabel>
                <Input
                  type="date"
                  value={lastReviewDate}
                  onChange={(e) => setLastReviewDate(e.target.value)}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Date when this version was reviewed. Leave empty to clear.
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Next Review Date</FormLabel>
                <Input
                  type="date"
                  value={nextReviewDate}
                  onChange={(e) => setNextReviewDate(e.target.value)}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Date when this document should be reviewed next. Leave empty to clear.
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={loading}>
              Cancel
            </Button>
            <Button colorScheme="blue" type="submit" isLoading={loading}>
              Save New Version
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

