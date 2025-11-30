import { config } from '../config';

export interface SimilarityResult {
  score: number; // 0-100
  matchedFields: string[];
}

/**
 * Generate embedding for text using Ollama
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Ollama embeddings API format
    const response = await fetch(`${config.llm.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llm.model,
        prompt: text, // Ollama uses 'prompt' not 'input'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Embedding Error] HTTP ${response.status}: ${errorText}`);
      console.error(`[Embedding Error] Model '${config.llm.model}' may not support embeddings.`);
      console.error(`[Embedding Error] Try installing an embedding model: ollama pull nomic-embed-text`);
      return null;
    }

    const data = await response.json();
    
    // Ollama returns { embedding: [...] }
    const embedding = data.embedding;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.error(`[Embedding Error] Model '${config.llm.model}' returned empty embeddings.`);
      console.error(`[Embedding Error] This model does not support embeddings. Install an embedding model:`);
      console.error(`[Embedding Error]   ollama pull nomic-embed-text`);
      console.error(`[Embedding Error] Then set LLM_MODEL=nomic-embed-text in your .env file`);
      return null;
    }
    
    console.log(`[Embedding] Generated embedding of length ${embedding.length} for text: "${text.substring(0, 50)}..."`);
    
    return embedding;
  } catch (error: any) {
    console.error('[Embedding Error] Failed to generate embedding:', error.message);
    console.error(`[Embedding Error] Make sure Ollama is running and model '${config.llm.model}' supports embeddings`);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
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
function mapToScore(cosineSimilarity: number): number {
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
 */
export async function calculateSimilarityScore(
  risk1: { title: string; threatDescription?: string | null; description?: string | null },
  risk2: { title: string; threatDescription?: string | null; description?: string | null }
): Promise<SimilarityResult> {
  try {
    const text1 = combineRiskText(risk1.title, risk1.threatDescription, risk1.description);
    const text2 = combineRiskText(risk2.title, risk2.threatDescription, risk2.description);

    // Generate embeddings
    const [embedding1, embedding2] = await Promise.all([
      generateEmbedding(text1),
      generateEmbedding(text2),
    ]);

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
    // Fallback to chat-based approach if embeddings fail
    console.warn('Embedding approach failed, trying chat-based approach:', error.message);
    return calculateSimilarityScoreChat(risk1, risk2);
  }
}

/**
 * Calculate similarity score using chat-based approach (fallback)
 */
async function calculateSimilarityScoreChat(
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
        model: config.llm.model,
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

    const data = await response.json();
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
 * Find similar risks by comparing a risk text against multiple risks
 */
export async function findSimilarRisks(
  riskText: string,
  existingRisks: Array<{ id: string; title: string; threatDescription?: string | null; description?: string | null }>
): Promise<Array<{ riskId: string; score: number; matchedFields: string[] }>> {
  if (existingRisks.length === 0) {
    return [];
  }

  try {
    // Try embeddings approach first (much faster and more accurate)
    const inputEmbedding = await generateEmbedding(riskText);
    
    // If embeddings failed (model doesn't support them), provide helpful error and fall back
    if (!inputEmbedding) {
      console.error('[Similarity] Embeddings not available - model does not support embeddings');
      console.error('[Similarity] For better performance and accuracy, use an embedding model:');
      console.error('[Similarity]   1. Run: ollama pull nomic-embed-text');
      console.error('[Similarity]   2. Set LLM_MODEL=nomic-embed-text in .env');
      console.error('[Similarity] Falling back to slow chat-based approach...');
      return findSimilarRisksChat(riskText, existingRisks);
    }

    // Generate embeddings for all existing risks in batches for progress tracking
    // Process in batches of 50 to allow progress updates
    const BATCH_SIZE = 50;
    const totalRisks = existingRisks.length;
    console.log(`[Similarity] Comparing against ${totalRisks} risks using embeddings (processing in batches of ${BATCH_SIZE})...`);
    
    const existingEmbeddings: (number[] | null)[] = [];
    for (let i = 0; i < existingRisks.length; i += BATCH_SIZE) {
      const batch = existingRisks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await Promise.all(
        batch.map((risk) =>
          generateEmbedding(combineRiskText(risk.title, risk.threatDescription, risk.description))
        )
      );
      existingEmbeddings.push(...batchEmbeddings);
      const progress = Math.min(100, Math.round(((i + batch.length) / totalRisks) * 100));
      console.log(`[Similarity Progress] ${progress}% - Processed ${i + batch.length} of ${totalRisks} risks`);
    }

    // Check if any embeddings failed
    const hasValidEmbeddings = existingEmbeddings.some(e => e !== null);
    if (!hasValidEmbeddings) {
      console.error('[Similarity] Embeddings not available for comparison risks');
      console.error('[Similarity] Falling back to slow chat-based approach');
      return findSimilarRisksChat(riskText, existingRisks);
    }
    
    // Filter out any null embeddings (shouldn't happen if we checked above, but be safe)
    const validEmbeddings = existingEmbeddings.filter((e, i) => {
      if (!e) {
        console.warn(`[Similarity] Skipping risk ${existingRisks[i].id} - embedding failed`);
        return false;
      }
      return true;
    });
    
    const validRisks = existingRisks.filter((_, i) => existingEmbeddings[i] !== null);

    // Calculate similarities using embeddings
    console.log(`[Similarity] Calculating cosine similarity for ${validRisks.length} risks...`);
    const similarities = validEmbeddings.map((embedding, index) => {
      const cosineSim = cosineSimilarity(inputEmbedding, embedding);
      const score = mapToScore(cosineSim);

      // Determine matched fields
      const risk = validRisks[index];
      const matchedFields: string[] = [];
      // Simple heuristic - could be improved
      if (riskText.toLowerCase().includes(risk.title.toLowerCase())) {
        matchedFields.push('title');
      }

      // Debug logging
      const riskTextForComparison = combineRiskText(risk.title, risk.threatDescription, risk.description);
      const isIdentical = riskText.trim().toLowerCase() === riskTextForComparison.trim().toLowerCase();
      
      console.log(`[Similarity] Risk "${risk.title.substring(0, 50)}...": cosine=${cosineSim.toFixed(3)}, score=${Math.round(score)}${isIdentical ? ' [IDENTICAL]' : ''}`);
      
      if (isIdentical && cosineSim < 0.95) {
        console.warn(`[Similarity Warning] Identical text but cosine=${cosineSim.toFixed(3)} (expected ~1.0)`);
      }

      return {
        riskId: risk.id,
        score: Math.round(score),
        matchedFields,
      };
    });

    // Sort by score descending
    return similarities.sort((a, b) => b.score - a.score);
  } catch (error: any) {
    console.error('Error finding similar risks:', error);
    // Fall back to chat-based approach on error
    console.log('[Similarity] Error with embeddings, falling back to chat-based approach');
    return findSimilarRisksChat(riskText, existingRisks);
  }
}

/**
 * Find similar risks using chat-based approach (fallback when embeddings aren't available)
 * This parses the riskText back into components for better comparison
 * Note: This is slower than embeddings, so we limit to first 50 risks
 */
async function findSimilarRisksChat(
  riskText: string,
  existingRisks: Array<{ id: string; title: string; threatDescription?: string | null; description?: string | null }>
): Promise<Array<{ riskId: string; score: number; matchedFields: string[] }>> {
  // Chat-based is slow (sequential LLM calls), so limit to 50 for performance
  // If you need to compare all risks, use an embedding model instead
  const risksToCompare = existingRisks.slice(0, 50);
  if (existingRisks.length > 50) {
    console.warn(`[Similarity Chat] Limiting to first 50 of ${existingRisks.length} risks (chat-based is slow). Use embeddings to compare all risks.`);
  }
  
  // Parse riskText back into components (it was created with combineRiskText)
  // Format: "Title: ... Threat: ... Description: ..."
  const parseRiskText = (text: string) => {
    const titleMatch = text.match(/Title:\s*(.+?)(?:\s+Threat:|$)/);
    const threatMatch = text.match(/Threat:\s*(.+?)(?:\s+Description:|$)/);
    const descMatch = text.match(/Description:\s*(.+)$/);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : text.split(' ').slice(0, 10).join(' '), // Fallback to first words
      threatDescription: threatMatch ? threatMatch[1].trim() : null,
      description: descMatch ? descMatch[1].trim() : null,
    };
  };
  
  const sourceRisk = parseRiskText(riskText);
  
  // Compare against each risk
  const comparisons = await Promise.all(
    risksToCompare.map(async (risk) => {
      // Use the chat-based similarity calculation
      const result = await calculateSimilarityScoreChat(
        sourceRisk,
        { title: risk.title, threatDescription: risk.threatDescription || null, description: risk.description || null }
      );
      
      const matchedFields: string[] = [];
      if (sourceRisk.title.toLowerCase().includes(risk.title.toLowerCase()) || 
          risk.title.toLowerCase().includes(sourceRisk.title.toLowerCase())) {
        matchedFields.push('title');
      }
      if (sourceRisk.threatDescription && risk.threatDescription) {
        matchedFields.push('threatDescription');
      }
      if (sourceRisk.description && risk.description) {
        matchedFields.push('description');
      }
      
      console.log(`[Similarity Chat] Risk "${risk.title.substring(0, 50)}...": score=${result.score}`);
      
      return {
        riskId: risk.id,
        score: result.score,
        matchedFields,
      };
    })
  );
  
  return comparisons.sort((a, b) => b.score - a.score);
}

