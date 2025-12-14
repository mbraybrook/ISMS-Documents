import { FormControl, FormLabel, Input } from '@chakra-ui/react';
import type { DocumentFormData } from '../utils/documentForm';

interface ConfluenceDocumentSectionProps {
  formData: DocumentFormData;
  onChange: (updates: Partial<DocumentFormData>) => void;
  readOnly?: boolean;
}

export function ConfluenceDocumentSection({ formData, onChange, readOnly = false }: ConfluenceDocumentSectionProps) {
  return (
    <>
      <FormControl>
        <FormLabel>Confluence Space Key</FormLabel>
        <Input
          value={formData.confluenceSpaceKey}
          onChange={(e) => onChange({ confluenceSpaceKey: e.target.value })}
          isReadOnly={readOnly}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Confluence Page ID</FormLabel>
        <Input
          value={formData.confluencePageId}
          onChange={(e) => onChange({ confluencePageId: e.target.value })}
          isReadOnly={readOnly}
        />
      </FormControl>
    </>
  );
}


