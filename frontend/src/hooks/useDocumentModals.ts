import { useState, useRef } from 'react';
import { useDisclosure } from '@chakra-ui/react';
import { Control } from '../types/control';

export function useDocumentModals() {
  const { isOpen: isVersionUpdateOpen, onOpen: onVersionUpdateOpen, onClose: onVersionUpdateClose } = useDisclosure();
  const { isOpen: isControlModalOpen, onOpen: onControlModalOpen, onClose: onControlModalClose } = useDisclosure();
  const { isOpen: isConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleControlModalClose = () => {
    onControlModalClose();
    setSelectedControl(null);
  };

  return {
    isVersionUpdateOpen,
    onVersionUpdateOpen,
    onVersionUpdateClose,
    isControlModalOpen,
    onControlModalOpen,
    onControlModalClose: handleControlModalClose,
    isConfirmOpen,
    onConfirmClose,
    selectedControl,
    setSelectedControl,
    cancelRef,
  };
}


