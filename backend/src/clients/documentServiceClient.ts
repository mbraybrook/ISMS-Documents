import axios, { AxiosError } from 'axios';
import { config } from '../config';

const documentService = config.documentService;

const client = axios.create({
  baseURL: documentService.baseUrl,
  timeout: documentService.timeout,
});

// Add internal service token to all requests
client.interceptors.request.use((config) => {
  config.headers['X-Internal-Service-Token'] = documentService.internalToken;
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
      console.warn(`[DocumentServiceClient] Attempt ${attempt} failed, retrying in ${delay}ms...`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
}

export interface ConvertToPdfParams {
  bufferBase64: string;
  mimeType: string;
  filename?: string;
}

export interface ConvertToPdfResponse {
  pdfBufferBase64: string;
  filename: string;
}

/**
 * Convert document to PDF
 */
export async function convertToPdfRemote(params: ConvertToPdfParams): Promise<ConvertToPdfResponse> {
  return retryWithBackoff(async () => {
    const response = await client.post<ConvertToPdfResponse>('/v1/convert', params);
    return response.data;
  });
}

export interface WatermarkPdfParams {
  pdfBufferBase64: string;
  watermarkPrefix: string;
  userEmail: string;
  date: string;
  maxSizeMB?: number;
  issuedDate?: string;
}

export interface WatermarkPdfResponse {
  pdfBufferBase64: string;
}

/**
 * Add watermark to PDF
 */
export async function watermarkPdfRemote(params: WatermarkPdfParams): Promise<WatermarkPdfResponse> {
  return retryWithBackoff(async () => {
    const response = await client.post<WatermarkPdfResponse>('/v1/watermark', params);
    return response.data;
  });
}

export interface GetCachedPdfResponse {
  buffer: string; // base64
  originalFilename: string;
}

/**
 * Get cached PDF (no retry - cache miss is expected)
 */
export async function getCachedPdfRemote(cacheKey: string): Promise<GetCachedPdfResponse | null> {
  try {
    const response = await client.get<GetCachedPdfResponse>(`/v1/cache/${cacheKey}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null; // Cache miss is expected
      }
    }
    throw error;
  }
}

export interface SetCachedPdfParams {
  cacheKey: string;
  pdfBufferBase64: string;
  metadata: {
    documentId: string;
    version: string;
    updatedAt: string;
    originalMimeType: string;
    originalFilename: string;
    isWatermarked: boolean;
    watermarkUserEmail?: string;
  };
}

export interface SetCachedPdfResponse {
  success: boolean;
}

/**
 * Store cached PDF
 */
export async function setCachedPdfRemote(payload: SetCachedPdfParams): Promise<SetCachedPdfResponse> {
  return retryWithBackoff(async () => {
    const response = await client.post<SetCachedPdfResponse>('/v1/cache', payload);
    return response.data;
  });
}

export interface InvalidateCacheResponse {
  invalidated: number;
}

/**
 * Invalidate cache for a document
 */
export async function invalidateCacheRemote(documentId: string): Promise<InvalidateCacheResponse> {
  try {
    const response = await client.delete<InvalidateCacheResponse>(`/v1/cache/${documentId}`);
    return response.data;
  } catch (error) {
    // Cache invalidation failures are non-critical
    console.warn('[DocumentServiceClient] Cache invalidation failed:', error);
    return { invalidated: 0 };
  }
}

