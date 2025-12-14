import { FormControl, FormLabel, Input, Text } from '@chakra-ui/react';
import { formatDateForDisplay } from '../utils/documentForm';
import type { DocumentFormData, Document } from '../utils/documentForm';

interface DocumentReviewDatesProps {
  formData: DocumentFormData;
  onChange: (updates: Partial<DocumentFormData>) => void;
  readOnly?: boolean;
  document: Document | null;
  isReviewContext?: boolean;
}

export function DocumentReviewDates({ formData, onChange, readOnly = false, document, isReviewContext = false }: DocumentReviewDatesProps) {
  if (document) {
    // For existing documents, show review dates as text
    return (
      <>
        <FormControl>
          <FormLabel>Last Review Date</FormLabel>
          <Text fontSize="md" color="gray.700">
            {formatDateForDisplay(formData.lastReviewDate)}
          </Text>
        </FormControl>

        <FormControl>
          <FormLabel>Next Review Date</FormLabel>
          <Text fontSize="md" color="gray.700">
            {formatDateForDisplay(formData.nextReviewDate)}
          </Text>
        </FormControl>
        {!readOnly && (
          <Text fontSize="xs" color="gray.500" mt={1}>
            Review dates are updated when you update the document version.
          </Text>
        )}
      </>
    );
  }

  // For new documents, show editable date inputs
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


