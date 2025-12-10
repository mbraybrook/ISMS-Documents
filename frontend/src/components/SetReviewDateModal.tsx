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
  VStack,
  Text,
  HStack,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface SetReviewDateModalProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  document: any;
}

export function SetReviewDateModal({ isOpen, onClose, document }: SetReviewDateModalProps) {
  const toast = useToast();
  const [reviewDate, setReviewDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && document) {
      // Default to 1 year from today if document doesn't have a nextReviewDate
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      
      const defaultDate = document.nextReviewDate
        ? new Date(document.nextReviewDate).toISOString().split('T')[0]
        : nextYear.toISOString().split('T')[0];
      
      setReviewDate(defaultDate);
    }
  }, [isOpen, document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setLoading(true);

    try {
      // Update the document's nextReviewDate
      await api.put(`/api/documents/${document.id}`, {
        nextReviewDate: reviewDate || null,
      });
      
      toast({
        title: 'Success',
        description: 'Review date set successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
      
      onClose(true);
    } catch (error: any) {
      console.error('Error setting review date:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to set review date',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => onClose(false)} size="lg">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Schedule Review</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {document && (
                <>
                  <FormControl>
                    <FormLabel>Document Title</FormLabel>
                    <Text fontSize="md" fontWeight="medium" color="gray.700">
                      {document.title}
                    </Text>
                  </FormControl>

                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel>Type</FormLabel>
                      <Text fontSize="sm" color="gray.600">
                        {document.type || 'N/A'}
                      </Text>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Version</FormLabel>
                      <Badge fontSize="sm" colorScheme="gray" variant="outline">
                        v{document.version || 'N/A'}
                      </Badge>
                    </FormControl>
                  </HStack>

                  {document.owner && (
                    <FormControl>
                      <FormLabel>Owner</FormLabel>
                      <Text fontSize="sm" color="gray.600">
                        {document.owner.displayName || document.owner.email || 'N/A'}
                      </Text>
                    </FormControl>
                  )}

                  {document.nextReviewDate && (
                    <FormControl>
                      <FormLabel>Current Next Review Date</FormLabel>
                      <Text fontSize="sm" color="gray.600">
                        {new Date(document.nextReviewDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </Text>
                    </FormControl>
                  )}
                </>
              )}

              <FormControl isRequired>
                <FormLabel>Next Review Date</FormLabel>
                <Input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button colorScheme="blue" type="submit" isLoading={loading}>
              Set Review Date
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

