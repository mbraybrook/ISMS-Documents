import { Router, Request, Response } from 'express';
import { generateEmbedding } from '../services/llmService';
import { cosineSimilarity, mapToScore } from '../services/llmService';
import { calculateSimilarityScore, calculateSimilarityScoreChat } from '../services/llmService';

const router = Router();

/**
 * POST /v1/embeddings/generate
 * Generate embedding for text
 * Body: { text: string }
 * Returns: { embedding: number[] }
 */
router.post('/embeddings/generate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid text field',
        code: 'MISSING_FIELDS',
        details: 'text (string) is required',
      });
    }

    const embedding = await generateEmbedding(text);

    if (!embedding) {
      return res.status(500).json({
        error: 'Failed to generate embedding',
        code: 'EMBEDDING_ERROR',
        details: 'Ollama may not be available or model does not support embeddings',
      });
    }

    res.json({ embedding });
  } catch (error: any) {
    console.error('[AIRoutes] Generate embedding error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate embedding',
      code: 'EMBEDDING_ERROR',
    });
  }
});

/**
 * POST /v1/similarity/calculate
 * Calculate similarity between two embeddings or risk texts
 * Body: { embedding1?: number[], embedding2?: number[], risk1?: {...}, risk2?: {...} }
 * Returns: { score: number, matchedFields: string[] }
 */
router.post('/similarity/calculate', async (req: Request, res: Response) => {
  try {
    const { embedding1, embedding2, risk1, risk2 } = req.body;

    // If embeddings provided directly, calculate cosine similarity
    if (embedding1 && embedding2) {
      if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
        return res.status(400).json({
          error: 'Invalid embeddings',
          code: 'INVALID_FIELDS',
          details: 'embedding1 and embedding2 must be arrays',
        });
      }

      if (embedding1.length !== embedding2.length) {
        return res.status(400).json({
          error: 'Embeddings must have same length',
          code: 'INVALID_FIELDS',
        });
      }

      const cosineSim = cosineSimilarity(embedding1, embedding2);
      const score = mapToScore(cosineSim);

      return res.json({
        score: Math.round(score),
        matchedFields: [],
      });
    }

    // If risk objects provided, use calculateSimilarityScore
    if (risk1 && risk2) {
      const result = await calculateSimilarityScore(risk1, risk2);

      if (!result) {
        return res.status(500).json({
          error: 'Failed to calculate similarity',
          code: 'SIMILARITY_ERROR',
        });
      }

      return res.json(result);
    }

    return res.status(400).json({
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
      details: 'Either (embedding1, embedding2) or (risk1, risk2) must be provided',
    });
  } catch (error: any) {
    console.error('[AIRoutes] Calculate similarity error:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate similarity',
      code: 'SIMILARITY_ERROR',
    });
  }
});

/**
 * POST /v1/similarity/search
 * Search for similar items using embeddings
 * Body: { queryEmbedding: number[], candidateEmbeddings: Array<{ id: string, embedding: number[] }>, limit?: number }
 * Returns: { results: Array<{ id: string, score: number, matchedFields: string[] }> }
 */
router.post('/similarity/search', async (req: Request, res: Response) => {
  try {
    const { queryEmbedding, candidateEmbeddings, limit = 10 } = req.body;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      return res.status(400).json({
        error: 'Missing or invalid queryEmbedding',
        code: 'MISSING_FIELDS',
        details: 'queryEmbedding (array) is required',
      });
    }

    if (!candidateEmbeddings || !Array.isArray(candidateEmbeddings)) {
      return res.status(400).json({
        error: 'Missing or invalid candidateEmbeddings',
        code: 'MISSING_FIELDS',
        details: 'candidateEmbeddings (array) is required',
      });
    }

    const results: Array<{ id: string; score: number; matchedFields: string[] }> = [];

    for (const candidate of candidateEmbeddings) {
      if (!candidate.id || !candidate.embedding || !Array.isArray(candidate.embedding)) {
        continue;
      }

      if (candidate.embedding.length !== queryEmbedding.length) {
        continue; // Skip embeddings with different dimensions
      }

      const cosineSim = cosineSimilarity(queryEmbedding, candidate.embedding);
      const score = mapToScore(cosineSim);

      results.push({
        id: candidate.id,
        score: Math.round(score),
        matchedFields: [],
      });
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    res.json({ results: limitedResults });
  } catch (error: any) {
    console.error('[AIRoutes] Similarity search error:', error);
    res.status(500).json({
      error: error.message || 'Failed to search similarities',
      code: 'SIMILARITY_ERROR',
    });
  }
});

/**
 * POST /v1/similarity/calculate-chat
 * Calculate similarity using chat-based approach (for fallback)
 * Body: { risk1: {...}, risk2: {...} }
 * Returns: { score: number, matchedFields: string[] }
 */
router.post('/similarity/calculate-chat', async (req: Request, res: Response) => {
  try {
    const { risk1, risk2 } = req.body;

    if (!risk1 || !risk2) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        details: 'risk1 and risk2 are required',
      });
    }

    const result = await calculateSimilarityScoreChat(risk1, risk2);

    res.json(result);
  } catch (error: any) {
    console.error('[AIRoutes] Calculate similarity (chat) error:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate similarity',
      code: 'SIMILARITY_ERROR',
    });
  }
});

export { router as aiRoutes };





