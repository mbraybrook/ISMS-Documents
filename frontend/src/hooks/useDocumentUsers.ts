import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import api from '../services/api';

export type UserForOwner = {
  id: string;
  displayName: string;
  email: string;
  role: string;
};

interface UseDocumentUsersOptions {
  documentOwnerUserId?: string;
  canEditOwner: boolean;
  isOpen: boolean;
}

export function useDocumentUsers({ documentOwnerUserId, canEditOwner, isOpen }: UseDocumentUsersOptions) {
  const toast = useToast();
  const [users, setUsers] = useState<UserForOwner[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get<{ data: UserForOwner[] }>('/api/users');
      const allUsers = response.data.data || [];
      // Filter to only Admin and Editor roles for owner assignment
      const adminEditorUsers = allUsers.filter((u: UserForOwner) => u.role === 'ADMIN' || u.role === 'EDITOR');
      
      // If editing a document, include the current owner even if they're not Admin/Editor
      // This handles edge cases where a document might have a non-Admin/Editor owner
      if (documentOwnerUserId) {
        const currentOwner = allUsers.find((u: UserForOwner) => u.id === documentOwnerUserId);
        if (currentOwner && !adminEditorUsers.find((u: UserForOwner) => u.id === currentOwner.id)) {
          adminEditorUsers.push(currentOwner);
        }
      }
      
      setUsers(adminEditorUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users for owner selection',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [documentOwnerUserId, toast]);

  useEffect(() => {
    if (isOpen && canEditOwner) {
      fetchUsers();
    }
  }, [isOpen, canEditOwner, fetchUsers]);

  return {
    users,
    loadingUsers,
  };
}


