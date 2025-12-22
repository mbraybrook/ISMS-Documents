import axios from 'axios';
import { config } from '../config';

const aiService = config.aiService;

const client = axios.create({
  baseURL: aiService.baseUrl,
  timeout: aiService.timeout,
});

// Add internal service token to all requests
client.interceptors.request.use((config) => {
  config.headers['X-Internal-Service-Token'] = aiService.internalToken;
  return config;
});

/**
 * Exponential backoff retry helper
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[AIServiceClient] Attempt ${attempt} failed, retrying in ${delay}ms...`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
}

export interface GenerateEmbeddingResponse {
  embedding: number[];
}

/**
 * Generate embedding for text
 */
export async function generateEmbeddingRemote(text: string): Promise<number[] | null> {
  try {
    const response = await retryWithBackoff(async () => {
      return await client.post<GenerateEmbeddingResponse>('/v1/embeddings/generate', { text });
    });
    return response.data.embedding;
  } catch (error) {
    console.error('[AIServiceClient] Failed to generate embedding:', error);
    return null;
  }
}

export interface CalculateSimilarityParams {
  embedding1?: number[];
  embedding2?: number[];
  risk1?: {
    title: string;
    threatDescription?: string | null;
    description?: string | null;
    embedding?: number[] | null;
  };
  risk2?: {
    title: string;
    threatDescription?: string | null;
    description?: string | null;
    embedding?: number[] | null;
  };
}

export interface CalculateSimilarityResponse {
  score: number;
  matchedFields: string[];
}

/**
 * Calculate similarity between two embeddings or risks
 */
export async function calculateSimilarityRemote(input: CalculateSimilarityParams): Promise<CalculateSimilarityResponse> {
  const response = await client.post<CalculateSimilarityResponse>('/v1/similarity/calculate', input);
  return response.data;
}

export interface SimilaritySearchParams {
  queryEmbedding: number[];
  candidateEmbeddings: Array<{
    id: string;
    embedding: number[];
  }>;
  limit?: number;
}

export interface SimilaritySearchResponse {
  results: Array<{
    id: string;
    score: number;
    matchedFields: string[];
  }>;
}

/**
 * Search for similar items using embeddings
 */
export async function similaritySearchRemote(input: SimilaritySearchParams): Promise<SimilaritySearchResponse> {
  const response = await client.post<SimilaritySearchResponse>('/v1/similarity/search', input);
  return response.data;
}

export interface CalculateSimilarityChatParams {
  risk1: {
    title: string;
    threatDescription?: string | null;
    description?: string | null;
  };
  risk2: {
    title: string;
    threatDescription?: string | null;
    description?: string | null;
  };
}

/**
 * Calculate similarity using chat-based approach (fallback)
 */
export async function calculateSimilarityChatRemote(input: CalculateSimilarityChatParams): Promise<CalculateSimilarityResponse> {
  const response = await client.post<CalculateSimilarityResponse>('/v1/similarity/calculate-chat', input);
  return response.data;
}

