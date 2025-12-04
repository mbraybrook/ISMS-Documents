import { Box, Heading, VStack } from '@chakra-ui/react';
import { TrustDocumentCard } from './TrustDocumentCard';
import type { TrustDocument } from '../types/trust';

interface TrustCategorySectionProps {
  category: string;
  documents: TrustDocument[];
}

export function TrustCategorySection({ category, documents }: TrustCategorySectionProps) {
  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <Box>
      <Heading size="md" mb={4}>
        {categoryTitle}
      </Heading>
      <VStack spacing={4} align="stretch">
        {documents.map((doc) => (
          <TrustDocumentCard key={doc.id} document={doc} />
        ))}
      </VStack>
    </Box>
  );
}



