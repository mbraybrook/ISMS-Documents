import {
  FormControl,
  FormLabel,
  Input,
  Select,
  HStack,
  Button,
  Textarea,
  Text,
} from '@chakra-ui/react';
import type { DocumentFormData, Document } from '../utils/documentForm';

interface DocumentFormFieldsProps {
  formData: DocumentFormData;
  onChange: (updates: Partial<DocumentFormData>) => void;
  readOnly?: boolean;
  onVersionUpdateClick?: () => void;
  document: Document | null;
  hideStorageLocation?: boolean;
}

export function DocumentFormFields({
  formData,
  onChange,
  readOnly = false,
  onVersionUpdateClick,
  document,
  hideStorageLocation = false,
}: DocumentFormFieldsProps) {
  return (
    <>
      <FormControl isRequired>
        <FormLabel>Title</FormLabel>
        <Input
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          isReadOnly={readOnly}
        />
      </FormControl>

      <FormControl isRequired>
        <FormLabel>Type</FormLabel>
        <Select
          value={formData.type}
          onChange={(e) => {
            const newType = e.target.value;
            onChange({
              type: newType,
              // Auto-set requiresAcknowledgement to true only when changing TO POLICY
              // Don't change it when changing away from POLICY (user may want to keep it)
              requiresAcknowledgement: newType === 'POLICY' ? true : formData.requiresAcknowledgement,
            });
          }}
          isDisabled={readOnly}
        >
          <option value="POLICY">Policy</option>
          <option value="PROCEDURE">Procedure</option>
          <option value="MANUAL">Manual</option>
          <option value="RECORD">Record</option>
          <option value="TEMPLATE">Template</option>
          <option value="CERTIFICATE">Certificate</option>
          <option value="OTHER">Other</option>
        </Select>
      </FormControl>

      {!hideStorageLocation && (
        <FormControl isRequired>
          <FormLabel>Storage Location</FormLabel>
          <Select
            value={formData.storageLocation}
            onChange={(e) => onChange({ storageLocation: e.target.value })}
            isDisabled={readOnly}
          >
            <option value="SHAREPOINT">SharePoint</option>
            <option value="CONFLUENCE">Confluence</option>
          </Select>
        </FormControl>
      )}

      <FormControl isRequired>
        <FormLabel>Version</FormLabel>
        <HStack spacing={2}>
          <Input
            value={formData.version}
            isReadOnly={true}
            bg="gray.50"
            flex={1}
          />
          {!readOnly && document && onVersionUpdateClick && (
            <Button
              size="md"
              colorScheme="blue"
              variant="outline"
              onClick={onVersionUpdateClick}
            >
              Update version
            </Button>
          )}
        </HStack>
      </FormControl>

      {!readOnly && document && (
        <FormControl>
          <FormLabel>Version Notes</FormLabel>
          <Textarea
            value={formData.versionNotes}
            onChange={(e) => onChange({ versionNotes: e.target.value })}
            placeholder="Briefly describe what changed in this version..."
            rows={3}
            resize="vertical"
          />
          <Text fontSize="xs" color="gray.500" mt={1}>
            Briefly describe what changed in this version.
          </Text>
        </FormControl>
      )}

      <FormControl isRequired>
        <FormLabel>Status</FormLabel>
        <Select
          value={formData.status}
          onChange={(e) => onChange({ status: e.target.value })}
          isDisabled={readOnly}
        >
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="SUPERSEDED">Superseded</option>
        </Select>
      </FormControl>
    </>
  );
}


