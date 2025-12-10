/* eslint-disable react-hooks/exhaustive-deps */
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
  Select,
  VStack,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ReviewFormModalProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  document: any;
}

export function ReviewFormModal({ isOpen, onClose, document }: ReviewFormModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    reviewerUserId: user?.id || '',
    dueDate: '',
    changeNotes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (document) {
        // Set due date to document's nextReviewDate if available
        const nextReviewDate = document.nextReviewDate
          ? new Date(document.nextReviewDate).toISOString().split('T')[0]
          : '';
        setFormData({
          reviewerUserId: user?.id || '',
          dueDate: nextReviewDate,
          changeNotes: '',
        });
      }
    }
  }, [isOpen, document, user]);

  const fetchUsers = async () => {
    try {
      // For now, we'll need to get users from a users endpoint
      // This is a placeholder - in a real app, you'd have a users API
      // For now, we'll just use the current user
      setUsers([user].filter(Boolean));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setLoading(true);

    try {
      const payload = {
        documentId: document.id,
        reviewerUserId: formData.reviewerUserId,
        dueDate: formData.dueDate,
        changeNotes: formData.changeNotes || undefined,
      };

      await api.post('/api/reviews', payload);
      onClose(true);
    } catch (error: any) {
      console.error('Error creating review:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create review',
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
    <Modal isOpen={isOpen} onClose={() => onClose(false)} size="md">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Schedule Review</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {document && (
                <FormControl>
                  <FormLabel>Document</FormLabel>
                  <Input value={document.title} isReadOnly />
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel>Reviewer</FormLabel>
                <Select
                  value={formData.reviewerUserId}
                  onChange={(e) =>
                    setFormData({ ...formData, reviewerUserId: e.target.value })
                  }
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Due Date</FormLabel>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel>Change Notes (Optional)</FormLabel>
                <Textarea
                  value={formData.changeNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, changeNotes: e.target.value })
                  }
                  placeholder="Optional notes about the review..."
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button colorScheme="blue" type="submit" isLoading={loading}>
              Schedule Review
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

