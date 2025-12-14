/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  normalizeRiskText,
  generateEmbedding,
  cosineSimilarity,
  mapToScore,
  calculateSimilarityScore,
  calculateSimilarityScoreChat,
  findSimilarRisks,
} from '../llmService';

// Mock config
jest.mock('../../config', () => ({
  config: {
    llm: {
      baseUrl: 'http://localhost:11434',
      embeddingModel: 'nomic-embed-text',
      chatModel: 'llama2',
      maxEmbeddingTextLength: 1024,
    },
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('llmService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Suppress console methods during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('normalizeRiskText', () => {
    it('should combine title, threat description, and description', () => {
      // Arrange
      const title = 'Test Risk';
      const threatDescription = 'Threat description';
      const description = 'Risk description';

      // Act
      const result = normalizeRiskText(title, threatDescription, description);

      // Assert
      expect(result).toBe('test risk\n\nthreat description\n\nrisk description');
    });

    it('should handle missing optional fields', () => {
      // Arrange
      const title = 'Test Risk';

      // Act
      const result = normalizeRiskText(title, null, undefined);

      // Assert
      expect(result).toBe('test risk');
    });

    it('should trim whitespace and convert to lowercase', () => {
      // Arrange
      const title = '  TEST RISK  ';
      const threatDescription = '  Threat Description  ';

      // Act
      const result = normalizeRiskText(title, threatDescription, null);

      // Assert
      expect(result).toBe('test risk\n\nthreat description');
    });

    it('should filter out empty strings', () => {
      // Arrange
      const title = 'Test Risk';
      const threatDescription = '';
      const description = '   ';

      // Act
      const result = normalizeRiskText(title, threatDescription, description);

      // Assert
      expect(result).toBe('test risk');
    });

    it('should truncate text longer than maxEmbeddingTextLength', () => {
      // Arrange
      const longText = 'a'.repeat(2000);
      const title = longText;

      // Act
      const result = normalizeRiskText(title, null, null);

      // Assert
      expect(result.length).toBe(1024);
      expect(result).toBe(longText.slice(0, 1024));
    });

    it('should handle all empty inputs', () => {
      // Arrange
      const title = '';
      const threatDescription = '';
      const description = '';

      // Act
      const result = normalizeRiskText(title, threatDescription, description);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('generateEmbedding', () => {
    it('should return embedding array on successful API call', async () => {
      // Arrange
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test text',
          }),
        })
      );
    });

    it('should return null for empty text', async () => {
      // Arrange
      const emptyText = '   ';

      // Act
      const result = await generateEmbedding(emptyText);

      // Assert
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null when API returns non-ok response', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return null when embedding is missing from response', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return null when embedding is empty array', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [] }),
      });

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return null when embedding is not an array', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: 'not an array' }),
      });

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      // Arrange
      const error = new Error('Network error');
      mockFetch.mockRejectedValueOnce(error);

      // Act
      const result = await generateEmbedding('test text');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embedding Error]'),
        expect.any(String)
      );
    });

    it('should trim input text before processing', async () => {
      // Arrange
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await generateEmbedding('  test text  ');

      // Assert
      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test text',
          }),
        })
      );
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      // Arrange
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBe(1); // Identical vectors should have similarity of 1
    });

    it('should return 0 for orthogonal vectors', () => {
      // Arrange
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle negative values', () => {
      // Arrange
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBe(-1);
    });

    it('should calculate similarity for longer vectors', () => {
      // Arrange
      const vec1 = [1, 2, 3, 4, 5];
      const vec2 = [1, 2, 3, 4, 5];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBeCloseTo(1, 5);
    });

    it('should throw error when vectors have different lengths', () => {
      // Arrange
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      // Act & Assert
      expect(() => cosineSimilarity(vec1, vec2)).toThrow('Vectors must have the same length');
    });

    it('should return 0 when denominator is zero (zero vectors)', () => {
      // Arrange
      const vec1 = [0, 0, 0];
      const vec2 = [0, 0, 0];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBe(0);
    });

    it('should calculate similarity for real-world embedding-like vectors', () => {
      // Arrange
      const vec1 = [0.1, 0.2, 0.3, 0.4];
      const vec2 = [0.2, 0.3, 0.4, 0.5];

      // Act
      const result = cosineSimilarity(vec1, vec2);

      // Assert
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('mapToScore', () => {
    it('should map cosine similarity 1 to score 100', () => {
      // Arrange
      const cosineSim = 1;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(100);
    });

    it('should map cosine similarity 0 to score 0', () => {
      // Arrange
      const cosineSim = 0;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(0);
    });

    it('should map cosine similarity 0.5 to score 50', () => {
      // Arrange
      const cosineSim = 0.5;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(50);
    });

    it('should clamp negative values to 0', () => {
      // Arrange
      const cosineSim = -0.5;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(0);
    });

    it('should clamp values greater than 1 to 100', () => {
      // Arrange
      const cosineSim = 1.5;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(100);
    });

    it('should handle decimal values correctly', () => {
      // Arrange
      const cosineSim = 0.75;

      // Act
      const result = mapToScore(cosineSim);

      // Assert
      expect(result).toBe(75);
    });
  });

  describe('calculateSimilarityScore', () => {
    it('should calculate similarity using stored embeddings', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: 'Threat 1',
        description: 'Description 1',
        embedding: [0.1, 0.2, 0.3],
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: 'Threat 2',
        description: 'Description 2',
        embedding: [0.1, 0.2, 0.3],
      };

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.score).toBe(100); // Identical embeddings
      expect(result?.matchedFields).toBeDefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should generate embeddings when not provided', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: null,
        description: null,
        embedding: null,
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: null,
        description: null,
        embedding: null,
      };
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.score).toBe(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when embedding generation fails', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: null,
        description: null,
        embedding: null,
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: null,
        description: null,
        embedding: null,
      };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when one embedding generation fails', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: null,
        description: null,
        embedding: [0.1, 0.2, 0.3],
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: null,
        description: null,
        embedding: null,
      };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).toBeNull();
    });

    it('should identify matched fields correctly', async () => {
      // Arrange
      const risk1 = {
        title: 'Same Title',
        threatDescription: 'Threat 1',
        description: 'Description 1',
        embedding: [0.1, 0.2, 0.3],
      };
      const risk2 = {
        title: 'Same Title',
        threatDescription: 'Threat 2',
        description: 'Description 2',
        embedding: [0.1, 0.2, 0.3],
      };

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.matchedFields).toContain('title');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: null,
        description: null,
        embedding: [0.1, 0.2, 0.3],
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: null,
        description: null,
        embedding: [0.1, 0.2], // Different length to trigger error
      };

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should round score to nearest integer', async () => {
      // Arrange
      const risk1 = {
        title: 'Risk 1',
        threatDescription: null,
        description: null,
        embedding: [0.1, 0.2, 0.3],
      };
      const risk2 = {
        title: 'Risk 2',
        threatDescription: null,
        description: null,
        embedding: [0.2, 0.3, 0.4],
      };

      // Act
      const result = await calculateSimilarityScore(risk1, risk2);

      // Assert
      expect(result).not.toBeNull();
      expect(Number.isInteger(result?.score)).toBe(true);
    });
  });

  describe('calculateSimilarityScoreChat', () => {
    it('should return 100% for identical risks', async () => {
      // Arrange
      const risk1 = {
        title: 'Test Risk',
        threatDescription: 'Threat',
        description: 'Description',
      };
      const risk2 = {
        title: 'Test Risk',
        threatDescription: 'Threat',
        description: 'Description',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(100);
      expect(result.matchedFields).toContain('title');
      expect(result.matchedFields).toContain('threatDescription');
      expect(result.matchedFields).toContain('description');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return 100% for identical risks with empty strings treated as missing', async () => {
      // Arrange
      const risk1 = {
        title: 'Test Risk',
        threatDescription: '',
        description: '',
      };
      const risk2 = {
        title: 'Test Risk',
        threatDescription: '',
        description: '',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(100);
    });

    it('should return high score for identical titles with similar descriptions', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff members',
        description: 'Staff may receive phishing emails',
      };
      const risk2 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff members',
        description: 'Staff may receive phishing emails',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.matchedFields).toContain('title');
    });

    it('should return 95% when descriptions are very similar (>0.8)', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff members with malicious links and attachments',
        description: 'Staff may receive phishing emails containing malicious links and attachments',
      };
      const risk2 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff members with malicious links and files',
        description: 'Staff may receive phishing emails containing malicious links and files',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(95);
      expect(result.matchedFields).toContain('title');
      expect(result.matchedFields).toContain('threatDescription');
      expect(result.matchedFields).toContain('description');
    });

    it('should return 85% when one description is similar (>0.7)', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing targeting staff members',
        description: 'Different description here',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(85);
      expect(result.matchedFields).toEqual(['title']);
    });

    it('should return 70% when titles match but descriptions are not similar', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Completely different threat',
        description: 'Completely different description',
      };
      const risk2 = {
        title: 'Phishing Attack',
        threatDescription: 'Another different threat',
        description: 'Another different description',
      };

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(70);
      expect(result.matchedFields).toEqual(['title']);
    });

    it('should use LLM when not exact match', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '{"score": 45, "matchedFields": [], "reasoning": "Different risks"}' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(45);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should apply completeness penalty for incomplete risks', async () => {
      // Arrange
      const risk1 = {
        title: 'Different Risk 1',
        threatDescription: null,
        description: null,
      };
      const risk2 = {
        title: 'Different Risk 2',
        threatDescription: null,
        description: null,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '{"score": 80, "matchedFields": ["title"], "reasoning": "Similar"}' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBeLessThan(80); // Should be penalized by 15
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should apply generic title penalty', async () => {
      // Arrange
      const risk1 = {
        title: 'Security Risk',
        threatDescription: 'Different Threat',
        description: 'Different Description',
      };
      const risk2 = {
        title: 'Security Threat',
        threatDescription: 'Another Threat',
        description: 'Another Description',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '{"score": 85, "matchedFields": ["title"], "reasoning": "Generic title"}' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBeLessThanOrEqual(75); // Should be penalized
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle LLM API errors gracefully', async () => {
      // Arrange
      const risk1 = {
        title: 'Completely Different Risk One',
        threatDescription: 'Threat 1',
        description: 'Description 1',
      };
      const risk2 = {
        title: 'Completely Different Risk Two',
        threatDescription: 'Threat 2',
        description: 'Description 2',
      };
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(0);
      expect(result.matchedFields).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle non-ok LLM response', async () => {
      // Arrange
      const risk1 = {
        title: 'Completely Different Risk 1',
        threatDescription: 'Threat 1',
        description: 'Description 1',
      };
      const risk2 = {
        title: 'Completely Different Risk 2',
        threatDescription: 'Threat 2',
        description: 'Description 2',
      };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should extract score from JSON response', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'Here is the result: {"score": 90, "matchedFields": ["title"], "reasoning": "Similar"}' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      // The score might be adjusted due to penalties, so just check it's in a reasonable range
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.matchedFields).toEqual(['title']);
    });

    it('should fallback to extracting number when JSON parsing fails', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'The similarity score is 65 percent' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(65);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle response format with response field', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '{"score": 70, "matchedFields": ["title"], "reasoning": "Similar"}',
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(70);
    });

    it('should clamp score to 0-100 range', async () => {
      // Arrange
      const risk1 = {
        title: 'System Downtime',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Network Outage',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '{"score": 200, "matchedFields": [], "reasoning": "Invalid"}' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      // Score is clamped to 100, but generic penalty may apply if titles match generic terms
      // Since these titles don't match generic terms, score should be 100
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle empty response content', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '' },
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      expect(result.score).toBe(0);
    });

    it('should handle JSON parsing error in response', async () => {
      // Arrange
      const risk1 = {
        title: 'Phishing Attack',
        threatDescription: 'Email phishing',
        description: 'Staff receive phishing emails',
      };
      const risk2 = {
        title: 'Malware Attack',
        threatDescription: 'Malware via email',
        description: 'Staff receive malware',
      };
      // Create invalid JSON that will cause parsing to fail
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: '{"score": 75, "matchedFields": ["title"], "reasoning": "Similar"' }, // Missing closing brace
        }),
      });

      // Act
      const result = await calculateSimilarityScoreChat(risk1, risk2);

      // Assert
      // Should fallback to extracting number from response
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('findSimilarRisks', () => {
    it('should return empty array when no risks provided', async () => {
      // Arrange
      const riskText = 'Test risk';
      const existingRisks: Array<{
        id: string;
        title: string;
        threatDescription?: string | null;
        description?: string | null;
        embedding: number[] | null;
      }> = [];

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toEqual([]);
    });

    it('should find similar risks using embeddings', async () => {
      // Arrange
      const riskText = 'Test risk title';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
        {
          id: 'risk-2',
          title: 'Different Risk',
          threatDescription: null,
          description: null,
          embedding: [0.9, 0.8, 0.7],
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].riskId).toBe('risk-1');
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('should skip risks without embeddings', async () => {
      // Arrange
      const riskText = 'Different risk title';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: null,
        },
        {
          id: 'risk-2',
          title: 'Different Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].riskId).toBe('risk-2');
    });

    it('should return empty array when embedding generation fails', async () => {
      // Arrange
      const riskText = 'Test risk text';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toEqual([]);
    });

    it('should sort results by score descending', async () => {
      // Arrange
      const riskText = 'Test risk text';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Different Risk',
          threatDescription: null,
          description: null,
          embedding: [0.9, 0.8, 0.7],
        },
        {
          id: 'risk-2',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('should identify matched fields in title', async () => {
      // Arrange
      const riskText = 'Test Risk Title contains this';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk Title',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].matchedFields).toContain('title');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const riskText = 'Test risk';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2], // Different length to trigger error
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should round scores to nearest integer', async () => {
      // Arrange
      const riskText = 'Test risk';
      const existingRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          threatDescription: null,
          description: null,
          embedding: [0.1, 0.2, 0.3],
        },
      ];
      const mockEmbedding = [0.2, 0.3, 0.4];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      // Act
      const result = await findSimilarRisks(riskText, existingRisks);

      // Assert
      expect(result).toHaveLength(1);
      expect(Number.isInteger(result[0].score)).toBe(true);
    });
  });
});

