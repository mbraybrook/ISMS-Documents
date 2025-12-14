import { FormControl, FormLabel, Select, Text } from '@chakra-ui/react';
import type { DocumentFormData } from '../utils/documentForm';
import type { UserForOwner } from '../hooks/useDocumentUsers';

interface DocumentOwnerSelectionProps {
  formData: DocumentFormData;
  onChange: (updates: Partial<DocumentFormData>) => void;
  readOnly?: boolean;
  users: UserForOwner[];
  loadingUsers: boolean;
}

export function DocumentOwnerSelection({ formData, onChange, readOnly = false, users, loadingUsers }: DocumentOwnerSelectionProps) {
  return (
    <FormControl isRequired>
      <FormLabel>Owner</FormLabel>
      <Select
        value={formData.ownerUserId}
        onChange={(e) => onChange({ ownerUserId: e.target.value })}
        isDisabled={readOnly || loadingUsers}
        placeholder={loadingUsers ? 'Loading users...' : 'Select owner'}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName} ({u.email}) - {u.role}
          </option>
        ))}
      </Select>
      <Text fontSize="xs" color="gray.500" mt={1}>
        Only Admin and Editor roles can be assigned as document owners
      </Text>
    </FormControl>
  );
}


