<!-- 9dd3b672-8898-4240-b0e6-246c273b4e95 5ced17dd-911d-458e-9a51-131568d7b90f -->
# Optimize LLM CPU Usage with Persisted Embeddings

## Overview

Refactor the LLM similarity system to drastically reduce CPU usage by:

1. Using dedicated embedding models (nomic-embed-text) instead of general chat models
2. Precomputing and persisting embeddings in the database
3. Adding cheap lexical prefilters before LLM calls
4. Making chat fallback rare and bounded to small candidate sets

## Implementation Plan

### 1. Database Schema Changes

**File: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)**

Add `embedding` field to the `Risk` model:

```prisma
model Risk {
  // ... existing fields ...
  embedding         Json?    // Store embedding vector as JSON array
  // ... rest of fields ...
}
```

**Action:** Generate and run migration:

- `npm run db:migrate:create` (create migration)
- `npm run db:migrate` (apply migration)

### 2. Configuration Updates

**File: [backend/src/config.ts](backend/src/config.ts)**

Split `llm.model` into separate embedding and chat models:

```typescript
llm: {
  provider: process.env.LLM_PROVIDER || 'ollama',
  baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
  embeddingModel: process.env.LLM_EMBEDDING_MODEL || 'nomic-embed-text',
  chatModel: process.env.LLM_CHAT_MODEL || 'llama2',
  similarityThreshold: parseFloat(process.env.LLM_SIMILARITY_THRESHOLD || '70'),
  maxEmbeddingTextLength: parseInt(process.env.LLM_MAX_EMBEDDING_TEXT_LENGTH || '1024', 10),
}
```

**Environment variables to document:**

- `LLM_EMBEDDING_MODEL` (default: `nomic-embed-text`)
- `LLM_CHAT_MODEL` (default: `llama2`)
- `LLM_MAX_EMBEDDING_TEXT_LENGTH` (default: `1024`)

### 3. Text Normalization Helper

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

Add `normalizeRiskText` function to replace `combineRiskText` for embedding generation:

```typescript
function normalizeRiskText(
  title: string,
  threatDescription?: string | null,
  description?: string | null,
): string {
  const parts = [
    title || '',
    threatDescription || '',
    description || '',
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  let combined = parts.join('\n\n');
  const maxLen = config.llm.maxEmbeddingTextLength;
  if (combined.length > maxLen) {
    combined = combined.slice(0, maxLen);
  }
  return combined;
}
```

Keep `combineRiskText` for backward compatibility in chat-based fallback if needed.

### 4. Embedding Generation Updates

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

Update `generateEmbedding` to:

- Use `config.llm.embeddingModel` instead of `config.llm.model`
- Accept normalized text (use `normalizeRiskText` before calling)
- Add minimal logging for failures (once per distinct cause)

### 5. Refactor Similarity Functions

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

**Update `findSimilarRisks`:**

- Remove batch embedding generation loop
- Accept risks with precomputed `embedding: number[] | null` field
- Generate embedding only for input `riskText` once
- For each risk with non-null embedding, compute cosine similarity directly
- Return empty array if input embedding fails (let caller decide on chat fallback)

**Update `calculateSimilarityScore`:**

- Keep signature but update to use stored embeddings if available
- Only generate embeddings if not already stored
- Fallback to chat-based only for small candidate sets

**Update `calculateSimilarityScoreChat`:**

- Use `config.llm.chatModel` instead of `config.llm.model`
- Add logging for chat fallback usage (count/rate)

### 6. Embedding Persistence on Write

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

Add helper function:

```typescript
export async function computeAndStoreEmbedding(
  riskId: string,
  title: string,
  threatDescription?: string | null,
  description?: string | null,
): Promise<number[] | null> {
  const text = normalizeRiskText(title, threatDescription, description);
  const embedding = await generateEmbedding(text);
  
  if (embedding) {
    await prisma.risk.update({
      where: { id: riskId },
      data: { embedding: embedding },
    });
  }
  
  return embedding;
}
```

**File: [backend/src/routes/risks.ts](backend/src/routes/risks.ts)**

**POST /api/risks (create):**

- After creating risk, call `computeAndStoreEmbedding` with the new risk's ID and text fields
- Store embedding in the same transaction or immediately after

**PUT /api/risks/:id (update):**

- Check if `title`, `threatDescription`, or `description` changed
- If any changed, call `computeAndStoreEmbedding` to recompute and persist
- Otherwise, leave embedding untouched

**File: [backend/src/services/riskImportService.ts](backend/src/services/riskImportService.ts)**

**CSV Import:**

- After creating each risk, call `computeAndStoreEmbedding`
- Process in batches with concurrency limit (2-4 concurrent) to avoid CPU spikes

### 7. Similarity Service Updates

**File: [backend/src/services/similarityService.ts](backend/src/services/similarityService.ts)**

**Update `checkSimilarityForNewRisk`:**

- Fetch risks with `embedding` field selected
- Add cheap exact title prefilter before LLM calls:
  ```typescript
  const normalizedTitle = riskData.title.trim().toLowerCase();
  const exactMatches = allRisks.filter(
    (r) => r.title.trim().toLowerCase() === normalizedTitle,
  );
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, limit).map((r) => ({
      risk: r,
      score: 95,
      fields: ['title'],
    }));
  }
  ```

- Use `normalizeRiskText` for input
- Pass risks with embeddings to `findSimilarRisks`
- Optionally: for borderline scores (65-85), refine top 5 with chat-based approach

**Update `findSimilarRisksForRisk`:**

- Load target risk with embedding field
- If risk has no embedding, compute once, persist, and reuse
- Use same core similarity logic with stored embeddings

### 8. Backfill Function

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

Add backfill function:

```typescript
export async function backfillRiskEmbeddings(
  batchSize: number = 10,
  concurrency: number = 2,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Fetch risks missing embeddings
  // Process in batches with concurrency limit
  // Update each risk with computed embedding
  // Return statistics
}
```

**File: [backend/scripts/backfill-embeddings.ts](backend/scripts/backfill-embeddings.ts)** (new)

Create standalone script:

- Import and call `backfillRiskEmbeddings`
- Add CLI arguments for batch size and concurrency
- Add progress logging

**File: [backend/package.json](backend/package.json)**

Add script:

```json
"backfill-embeddings": "tsx scripts/backfill-embeddings.ts"
```

### 10. API Routes - No Changes Required

**File: [backend/src/routes/risks.ts](backend/src/routes/risks.ts)**

- `POST /api/risks/check-similarity` - No signature changes, works with updated service
- `POST /api/risks/:id/similar` - No signature changes, works with updated service

Both routes will automatically benefit from persisted embeddings and prefilters.

**Important:** Ensure normal risk list/detail endpoints do NOT include embedding field in responses (use explicit select or exclude).

### 10. Observability

**File: [backend/src/services/llmService.ts](backend/src/services/llmService.ts)**

Add minimal logging:

- Embedding failures: log once per distinct cause (model not found, API error, etc.)
- Chat fallback usage: log count/rate when chat-based approach is used
- Use structured logging (console.log with `[Embedding]`, `[Similarity]` prefixes)

## Testing Considerations

1. **Unit Tests:**

   - Test `normalizeRiskText` truncation and normalization
   - Test embedding persistence on create/update
   - Test prefilter logic

2. **Integration Tests:**

   - Test similarity queries with persisted embeddings
   - Test fallback to chat for risks without embeddings
   - Test backfill script

3. **Performance Tests:**

   - Measure CPU usage before/after
   - Verify embeddings are not recomputed on every query

## Migration Path

1. Add `embedding` column to schema (nullable, no data loss)
2. Deploy code changes
3. Run backfill script for existing risks
4. Monitor CPU usage and chat fallback frequency

## Notes

- Embeddings are treated as opaque numeric arrays - no structural changes in application logic
- Chat fallback is bounded to small candidate sets (max 5-10 pairs)
- All API contracts remain unchanged
- Backward compatible: risks without embeddings will compute on-demand (with logging)

### To-dos

- [ ] Add embedding field to Risk model in Prisma schema and generate migration
- [ ] Split LLM config into embeddingModel and chatModel, add maxEmbeddingTextLength
- [ ] Add normalizeRiskText function with truncation support
- [ ] Update generateEmbedding to use embeddingModel and add error logging
- [ ] Refactor findSimilarRisks to use stored embeddings instead of generating on-the-fly
- [ ] Add computeAndStoreEmbedding helper and integrate into risk create/update routes
- [ ] Add exact title prefilter and update similarityService to use stored embeddings
- [ ] Update chat-based fallback to use chatModel and add usage logging
- [ ] Create backfillRiskEmbeddings function in llmService
- [ ] Create standalone backfill script and add npm script
- [ ] Update CSV import to compute embeddings with concurrency limits