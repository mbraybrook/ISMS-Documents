import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
} from '@chakra-ui/react';
import { trustApi } from '../services/trustApi';
import { useTrustAuth } from '../contexts/TrustAuthContext';
import { useToast } from '@chakra-ui/react';

interface NDAAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NDAAcceptanceModal({ isOpen, onClose }: NDAAcceptanceModalProps) {
  const { refreshUser } = useTrustAuth();
  const toast = useToast();

  const handleAccept = async () => {
    try {
      await trustApi.acceptTerms();
      await refreshUser();
      toast({
        title: 'Terms accepted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to accept terms',
        description: error.response?.data?.error || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Accept Terms and Conditions</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text>
              To access private documents, you must accept our Terms and Conditions and Non-Disclosure Agreement.
            </Text>
            <Text fontSize="sm" color="gray.600">
              By clicking "Accept", you agree to keep all confidential information private and not share it with unauthorized parties.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleAccept}>
            Accept
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}


