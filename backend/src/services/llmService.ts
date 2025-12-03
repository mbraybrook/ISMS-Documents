import { config } from '../config';

export interface SimilarityResult {
  score: number; // 0-100
  matchedFields: string[];
}

/**
 * Normalize and combine risk text for embedding generation
 * Truncates to maxEmbeddingTextLength and normalizes case
 */
export function normalizeRiskText(
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

/**
 * Generate embedding for text using Ollama
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const normalized = text.trim();
  if (!normalized) return null;

  try {
    // Ollama embeddings API format
    const response = await fetch(`${config.llm.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llm.embeddingModel,
        prompt: normalized, // Ollama uses 'prompt' not 'input'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Embedding Error] HTTP ${response.status}: ${errorText}`);
      console.error(`[Embedding Error] Model '${config.llm.embeddingModel}' may not support embeddings.`);
      console.error(`[Embedding Error] Try installing an embedding model: ollama pull nomic-embed-text`);
      return null;
    }

    const data = await response.json();
    
    // Ollama returns { embedding: [...] }
    const embedding = (data as any).embedding;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.error(`[Embedding Error] Model '${config.llm.embeddingModel}' returned empty embeddings.`);
      console.error(`[Embedding Error] This model does not support embeddings. Install an embedding model:`);
      console.error(`[Embedding Error]   ollama pull nomic-embed-text`);
      console.error(`[Embedding Error] Then set LLM_EMBEDDING_MODEL=nomic-embed-text in your .env file`);
      return null;
    }
    
    return embedding;
  } catch (error: any) {
    console.error('[Embedding Error] Failed to generate embedding:', error.message);
    console.error(`[Embedding Error] Make sure Ollama is running and model '${config.llm.embeddingModel}' supports embeddings`);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Map cosine similarity to 0-100 score
 * For embeddings, cosine similarity is typically in [0, 1] where:
 * - 0 = completely different
 * - 1 = identical
 * We map directly: 0 → 0%, 1 → 100%
 * If somehow we get negative values (shouldn't happen with normalized embeddings), we clamp to 0
 */
export function mapToScore(cosineSimilarity: number): number {
  // Clamp to [0, 1] range (embeddings should never be negative, but handle edge cases)
  const clamped = Math.max(0, Math.min(1, cosineSimilarity));
  // Map directly to 0-100
  return clamped * 100;
}

/**
 * Combine risk fields into a single text for comparison
 */
function combineRiskText(title: string, threatDescription?: string | null, description?: string | null): string {
  const parts: string[] = [];
  if (title) parts.push(`Title: ${title}`);
  if (threatDescription) parts.push(`Threat: ${threatDescription}`);
  if (description) parts.push(`Description: ${description}`);
  return parts.join(' ');
}

/**
 * Simple text similarity using word overlap (for quick checks)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Calculate similarity score between two risks using embeddings
 * Note: This function does NOT call chat fallback - that decision belongs to the caller
 */
export async function calculateSimilarityScore(
  risk1: { title: string; threatDescription?: string | null; description?: string | null; embedding?: number[] | null },
  risk2: { title: string; threatDescription?: string | null; description?: string | null; embedding?: number[] | null }
): Promise<SimilarityResult | null> {
  try {
    // Use stored embeddings if available, otherwise generate
    let embedding1: number[] | null = risk1.embedding || null;
    let embedding2: number[] | null = risk2.embedding || null;

    if (!embedding1) {
      const text1 = normalizeRiskText(risk1.title, risk1.threatDescription, risk1.description);
      embedding1 = await generateEmbedding(text1);
    }

    if (!embedding2) {
      const text2 = normalizeRiskText(risk2.title, risk2.threatDescription, risk2.description);
      embedding2 = await generateEmbedding(text2);
    }

    // If embeddings failed, return null (caller decides on fallback)
    if (!embedding1 || !embedding2) {
      return null;
    }

    // Calculate cosine similarity
    const cosineSim = cosineSimilarity(embedding1, embedding2);
    const score = mapToScore(cosineSim);

    // Determine matched fields (simple heuristic: check if titles/descriptions are similar)
    const matchedFields: string[] = [];
    if (risk1.title && risk2.title && risk1.title.toLowerCase() === risk2.title.toLowerCase()) {
      matchedFields.push('title');
    }
    if (risk1.threatDescription && risk2.threatDescription) {
      matchedFields.push('threatDescription');
    }
    if (risk1.description && risk2.description) {
      matchedFields.push('description');
    }

    return {
      score: Math.round(score),
      matchedFields,
    };
  } catch (error: any) {
    console.error('[Similarity] Error calculating similarity score:', error.message);
    return null;
  }
}

/**
 * Calculate similarity score using chat-based approach
 * This should only be called by similarityService for small candidate sets
 */
export async function calculateSimilarityScoreChat(
  risk1: { title: string; threatDescription?: string | null; description?: string | null },
  risk2: { title: string; threatDescription?: string | null; description?: string | null }
): Promise<SimilarityResult> {
  // First, check for exact matches (should be 100%)
  const title1 = (risk1.title || '').trim().toLowerCase();
  const title2 = (risk2.title || '').trim().toLowerCase();
  const threat1 = (risk1.threatDescription || '').trim().toLowerCase();
  const threat2 = (risk2.threatDescription || '').trim().toLowerCase();
  const desc1 = (risk1.description || '').trim().toLowerCase();
  const desc2 = (risk2.description || '').trim().toLowerCase();
  
  // If all fields are identical, return 100%
  if (title1 === title2 && threat1 === threat2 && desc1 === desc2 && title1 !== '') {
    const matchedFields: string[] = [];
    if (title1) matchedFields.push('title');
    if (threat1) matchedFields.push('threatDescription');
    if (desc1) matchedFields.push('description');
    return { score: 100, matchedFields };
  }
  
  // If titles are identical and both have content, that's a strong signal
  if (title1 === title2 && title1 !== '') {
    // Check if descriptions are also very similar
    const descSimilarity = calculateTextSimilarity(desc1, desc2);
    const threatSimilarity = calculateTextSimilarity(threat1, threat2);
    
    if (descSimilarity > 0.8 && threatSimilarity > 0.8) {
      return { 
        score: 95, 
        matchedFields: ['title', 'threatDescription', 'description'] 
      };
    } else if (descSimilarity > 0.7 || threatSimilarity > 0.7) {
      return { 
        score: 85, 
        matchedFields: ['title'] 
      };
    } else {
      return { 
        score: 70, 
        matchedFields: ['title'] 
      };
    }
  }
  
  // Use LLM for semantic comparison only if not exact match
  // Check if risks are too incomplete to compare meaningfully
  const risk1Complete = risk1.title && (risk1.threatDescription || risk1.description);
  const risk2Complete = risk2.title && (risk2.threatDescription || risk2.description);
  
  // If risks are incomplete, be more conservative
  const completenessPenalty = (!risk1Complete || !risk2Complete) ? 20 : 0;
  
  const prompt = `You are a risk management expert. Compare these two information security risks and determine if they describe the SAME SPECIFIC RISK or DIFFERENT risks.

CRITICAL: Risks are only similar if they describe the EXACT SAME threat, scenario, or security issue. Being in the same category (e.g., "both are security risks") is NOT enough for a high score.

Risk 1:
Title: ${risk1.title || 'N/A'}
Threat Description: ${risk1.threatDescription || 'N/A'}
Description: ${risk1.description || 'N/A'}

Risk 2:
Title: ${risk2.title || 'N/A'}
Threat Description: ${risk2.threatDescription || 'N/A'}
Description: ${risk2.description || 'N/A'}

Scoring rules (BE STRICT):
- 90-100: Risks describe the EXACT SAME threat/scenario (e.g., "Phishing emails targeting staff" = "Phishing emails targeting staff")
- 80-89: Risks describe the same threat but with minor variations (e.g., "Phishing emails" vs "Phishing attacks via email")
- 70-79: Risks are related but describe different aspects (e.g., "Phishing emails" vs "Malware from email attachments")
- 50-69: Risks are in the same category but clearly different (e.g., "Phishing" vs "Ransomware")
- 30-49: Risks are both security risks but unrelated
- 0-29: Completely different risks

IMPORTANT:
- If risk data is incomplete (missing threat description or description), be MORE conservative
- Generic risks (e.g., "Security risk" or "Data breach") should score LOW unless they're truly identical
- Different attack vectors, different assets, or different scenarios = DIFFERENT risks

Respond with ONLY a JSON object:
{
  "score": <number 0-100>,
  "matchedFields": ["title", "threatDescription", "description"],
  "reasoning": "<brief explanation of why this score>"
}`;

  try {
    const response = await fetch(`${config.llm.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llm.chatModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.message?.content || data.response || '';

    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        let score = Math.max(0, Math.min(100, parsed.score || 0));
        
        // Apply completeness penalty if risks are incomplete
        const risk1Complete = risk1.title && (risk1.threatDescription || risk1.description);
        const risk2Complete = risk2.title && (risk2.threatDescription || risk2.description);
        if (!risk1Complete || !risk2Complete) {
          score = Math.max(0, score - 15); // Penalize incomplete risks
        }
        
        // Penalize if titles are too generic
        const title1 = (risk1.title || '').toLowerCase();
        const title2 = (risk2.title || '').toLowerCase();
        const genericTerms = ['risk', 'security', 'threat', 'vulnerability', 'breach', 'attack'];
        const isGeneric1 = genericTerms.some(term => title1.split(/\s+/).length <= 3 && title1.includes(term));
        const isGeneric2 = genericTerms.some(term => title2.split(/\s+/).length <= 3 && title2.includes(term));
        if ((isGeneric1 || isGeneric2) && score > 70) {
          score = Math.max(score - 10, 50); // Cap generic risks at lower scores
        }
        
        console.log(`[Similarity Chat] LLM score: ${parsed.score || 0} -> adjusted: ${Math.round(score)}, reasoning: ${parsed.reasoning || 'N/A'}`);
        console.log(`[Similarity Chat] Chat fallback used - this should be rare`);
        return {
          score: Math.round(score),
          matchedFields: parsed.matchedFields || [],
        };
      } catch (e) {
        console.warn('[Similarity Chat] Failed to parse JSON response:', jsonMatch[0]);
      }
    }

    // Fallback: try to extract number from response
    const scoreMatch = content.match(/\b(\d{1,3})\b/);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    
    console.warn(`[Similarity Chat] Could not parse JSON, extracted score: ${score} from response`);

    return {
      score: Math.max(0, Math.min(100, score)),
      matchedFields: [],
    };
  } catch (error: any) {
    console.error('Chat-based similarity calculation failed:', error);
    // Return a default low score if all methods fail
    return {
      score: 0,
      matchedFields: [],
    };
  }
}

/**
 * Find similar risks by comparing a risk text against multiple risks with stored embeddings
 * Note: This function does NOT call chat fallback - that decision belongs to the caller
 */
export async function findSimilarRisks(
  riskText: string,
  existingRisks: Array<{ id: string; title: string; threatDescription?: string | null; description?: string | null; embedding: number[] | null }>
): Promise<Array<{ riskId: string; score: number; matchedFields: string[] }>> {
  if (existingRisks.length === 0) {
    return [];
  }

  try {
    // Generate embedding for input text once
    const inputEmbedding = await generateEmbedding(riskText);
    
    // If input embedding failed, return empty array (caller decides on fallback)
    if (!inputEmbedding) {
      return [];
    }

    // Calculate similarities using stored embeddings
    const results: Array<{ riskId: string; score: number; matchedFields: string[] }> = [];

    for (const risk of existingRisks) {
      // Skip risks without embeddings
      if (!risk.embedding) continue;

      const cosineSim = cosineSimilarity(inputEmbedding, risk.embedding);
      const score = mapToScore(cosineSim);

      // Determine matched fields
      const matchedFields: string[] = [];
      if (riskText.toLowerCase().includes(risk.title.toLowerCase())) {
        matchedFields.push('title');
      }

      results.push({
        riskId: risk.id,
        score: Math.round(score),
        matchedFields,
      });
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  } catch (error: any) {
    console.error('[Similarity] Error finding similar risks:', error);
    return [];
  }
}


