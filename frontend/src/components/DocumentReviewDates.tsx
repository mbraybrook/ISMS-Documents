import { FormControl, FormLabel, Input, Text } from '@chakra-ui/react';
import type { DocumentFormData, Document } from '../utils/documentForm';

interface DocumentReviewDatesProps {
  formData: DocumentFormData;
  onChange: (updates: Partial<DocumentFormData>) => void;
  readOnly?: boolean;
  document: Document | null;
  isReviewContext?: boolean;
}

export function DocumentReviewDates({ formData, onChange, readOnly = false, document: _document, isReviewContext = false }: DocumentReviewDatesProps) {
  // Show editable date inputs for all documents (new and existing)
  return (
    <>
      <FormControl>
        <FormLabel>Last Review Date</FormLabel>
        <Input
          type="date"
          value={formData.lastReviewDate}
          onChange={(e) => onChange({ lastReviewDate: e.target.value })}
          isReadOnly={readOnly}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Next Review Date</FormLabel>
        <Input
          type="date"
          value={formData.nextReviewDate}
          onChange={(e) => onChange({ nextReviewDate: e.target.value })}
          isReadOnly={readOnly}
        />
        {isReviewContext && !readOnly && (
          <Text fontSize="xs" color="blue.600" mt={1}>
            Next review date set to 1 year from today. You can change this if needed.
          </Text>
        )}
      </FormControl>
    </>
  );
}


