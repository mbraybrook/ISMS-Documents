/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { findSimilarRisks, calculateSimilarityScoreChat, normalizeRiskText } from './llmService';
import { computeAndStoreEmbedding } from './embeddingService';

export interface SimilarRiskResult {
  risk: any; // Risk with relations
  score: number; // 0-100
  fields: string[]; // Matched fields
}

/**
 * Combine risk fields into text for comparison
 * (Currently unused but may be needed for future functionality)
 */
// function combineRiskText(risk: { title: string; threatDescription?: string | null; description?: string | null }): string {
//   const parts: string[] = [];
//   if (risk.title) parts.push(`Title: ${risk.title}`);
//   if (risk.threatDescription) parts.push(`Threat: ${risk.threatDescription}`);
//   if (risk.description) parts.push(`Description: ${risk.description}`);
//   return parts.join(' ');
// }

function _combineRiskText(risk: { title: string; threatDescription?: string | null; description?: string | null }): string {
  const parts: string[] = [];
  if (risk.title) parts.push(`Title: ${risk.title}`);
  if (risk.threatDescription) parts.push(`Threat: ${risk.threatDescription}`);
  if (risk.description) parts.push(`Description: ${risk.description}`);
  return parts.join(' ');
}

/**
 * Find similar risks for an existing risk by ID
 */
export async function findSimilarRisksForRisk(riskId: string, limit: number = 10): Promise<SimilarRiskResult[]> {
  try {
    // Fetch the risk with embedding field (explicit select)
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
        embedding: true,
      },
    });

    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    // If risk has no embedding, compute once, persist, and reuse
    if (!risk.embedding) {
      const embedding = await computeAndStoreEmbedding(
        risk.id,
        risk.title,
        risk.threatDescription,
        risk.description,
      );
      if (embedding) {
        risk.embedding = embedding as any;
      }
    }

    // Get all risks (including archived) (excluding current risk) with embedding field
    const allRisks = await prisma.risk.findMany({
      where: {
        id: { not: riskId },
      },
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
        embedding: true, // Explicit select for embedding
        riskCategory: true,
        calculatedScore: true,
        ownerUserId: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        assetCategory: true,
        riskAssets: {
          select: {
            asset: {
              select: {
                id: true,
                nameSerialNo: true,
                model: true,
                AssetCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          take: 1, // Take first asset for backward compatibility
        },
        interestedParty: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });

    if (allRisks.length === 0) {
      return [];
    }

    // Use normalizeRiskText for input
    const riskText = normalizeRiskText(risk.title, risk.threatDescription, risk.description);
    
    // Prepare risks with embeddings for findSimilarRisks
    const risksWithEmbeddings = allRisks.map((r: { id: string; title: string; threatDescription: string | null; description: string | null; embedding: unknown }) => ({
      id: r.id,
      title: r.title,
      threatDescription: r.threatDescription,
      description: r.description,
      embedding: (r.embedding as number[] | null) || null,
    }));

    const similarityResults = await findSimilarRisks(riskText, risksWithEmbeddings);

    // Map results to include full risk data
    const results: SimilarRiskResult[] = similarityResults
      .map((result) => {
        const fullRisk = allRisks.find((r: { id: string }) => r.id === result.riskId);
        if (!fullRisk) return null;

        // Transform AssetCategory to category for frontend compatibility
        // Handle many-to-many relationship: take first asset for backward compatibility
        const firstAsset = fullRisk.riskAssets && fullRisk.riskAssets.length > 0 ? fullRisk.riskAssets[0].asset : null;
        const transformedRisk = {
          ...fullRisk,
          asset: firstAsset
            ? {
                ...firstAsset,
                category: firstAsset.AssetCategory || null,
              }
            : null,
        };
        // Remove AssetCategory from asset if it exists
        if (transformedRisk.asset && 'AssetCategory' in transformedRisk.asset) {
          delete (transformedRisk.asset as any).AssetCategory;
        }

        return {
          risk: transformedRisk,
          score: result.score,
          fields: result.matchedFields,
        };
      })
      .filter((r): r is SimilarRiskResult => r !== null && r.score >= config.llm.similarityThreshold)
      .slice(0, limit);

    return results;
  } catch (error: any) {
    console.error('Error finding similar risks:', error);
    // Gracefully degrade - return empty array
    return [];
  }
}

/**
 * Check similarity for a new risk being created/edited
 */
export async function checkSimilarityForNewRisk(
  riskData: {
    title: string;
    threatDescription?: string | null;
    description?: string | null;
    excludeId?: string;
  },
  limit: number = 5
): Promise<SimilarRiskResult[]> {
  try {
    // Validate minimum input
    if (!riskData.title || riskData.title.length < 3) {
      return [];
    }

    // Get all risks (including archived) (excluding the risk being edited if provided) with embedding field
    const where: any = {};
    if (riskData.excludeId) {
      where.id = { not: riskData.excludeId };
    }

    const allRisks = await prisma.risk.findMany({
      where,
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
        embedding: true, // Explicit select for embedding
        riskCategory: true,
        calculatedScore: true,
        ownerUserId: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        assetCategory: true,
        riskAssets: {
          select: {
            asset: {
              select: {
                id: true,
                nameSerialNo: true,
                model: true,
                AssetCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          take: 1, // Take first asset for backward compatibility
        },
        interestedParty: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
      take: 100, // Limit to 100 risks for performance
    });

    if (allRisks.length === 0) {
      return [];
    }

    // Cheap exact title prefilter before LLM calls
    const normalizedTitle = riskData.title.trim().toLowerCase();
    const exactMatches = allRisks.filter(
      (r: typeof allRisks[0]) => r.title.trim().toLowerCase() === normalizedTitle,
    );

    if (exactMatches.length > 0) {
      return exactMatches.slice(0, limit).map((r: { id: string; title: string; riskAssets: Array<{ asset: { AssetCategory: unknown } | null }> | null }) => {
        // Transform AssetCategory to category for frontend compatibility
        // Handle many-to-many relationship: take first asset for backward compatibility
        const firstAsset = r.riskAssets && r.riskAssets.length > 0 ? r.riskAssets[0].asset : null;
        const transformedRisk = {
          ...r,
          asset: firstAsset
            ? {
                ...firstAsset,
                category: firstAsset.AssetCategory || null,
              }
            : null,
        };
        if (transformedRisk.asset && 'AssetCategory' in transformedRisk.asset) {
          delete (transformedRisk.asset as any).AssetCategory;
        }
        return {
          risk: transformedRisk,
          score: 95,
          fields: ['title'],
        };
      });
    }

    // Use normalizeRiskText for input
    const riskText = normalizeRiskText(riskData.title, riskData.threatDescription, riskData.description);
    
    // Prepare risks with embeddings for findSimilarRisks
    const risksWithEmbeddings = allRisks.map((r: { id: string; title: string; threatDescription: string | null; description: string | null; embedding: unknown }) => ({
      id: r.id,
      title: r.title,
      threatDescription: r.threatDescription,
      description: r.description,
      embedding: (r.embedding as number[] | null) || null,
    }));

    const similarityResults = await findSimilarRisks(riskText, risksWithEmbeddings);

    // Map results to include full risk data
    let results: SimilarRiskResult[] = similarityResults
      .map((result) => {
        const fullRisk = allRisks.find((r: { id: string }) => r.id === result.riskId);
        if (!fullRisk) return null;

        // Transform AssetCategory to category for frontend compatibility
        // Handle many-to-many relationship: take first asset for backward compatibility
        const firstAsset = fullRisk.riskAssets && fullRisk.riskAssets.length > 0 ? fullRisk.riskAssets[0].asset : null;
        const transformedRisk = {
          ...fullRisk,
          asset: firstAsset
            ? {
                ...firstAsset,
                category: firstAsset.AssetCategory || null,
              }
            : null,
        };
        // Remove AssetCategory from asset if it exists
        if (transformedRisk.asset && 'AssetCategory' in transformedRisk.asset) {
          delete (transformedRisk.asset as any).AssetCategory;
        }

        return {
          risk: transformedRisk,
          score: result.score,
          fields: result.matchedFields,
        };
      })
      .filter((r): r is SimilarRiskResult => r !== null && r.score >= config.llm.similarityThreshold);

    // Chat fallback for borderline scores (65-85) - only similarityService decides when to use this
    const borderlineResults = results.filter((r) => r.score >= 65 && r.score <= 85);
    const maxChatCalls = 10; // Hard per-request cap
    const chatCandidates = borderlineResults.slice(0, maxChatCalls);

    if (chatCandidates.length > 0) {
      console.log(`[Similarity] Refining ${chatCandidates.length} borderline scores with chat fallback`);
      
      const refinedResults = await Promise.all(
        chatCandidates.map(async (result) => {
          try {
            const chatResult = await calculateSimilarityScoreChat(
              {
                title: riskData.title,
                threatDescription: riskData.threatDescription || null,
                description: riskData.description || null,
              },
              {
                title: result.risk.title,
                threatDescription: result.risk.threatDescription || null,
                description: result.risk.description || null,
              },
            );
            return {
              ...result,
              score: chatResult.score,
            };
          } catch (error: any) {
            console.error(`[Similarity] Chat fallback failed for risk ${result.risk.id}:`, error.message);
            return result; // Keep original score
          }
        }),
      );

      // Replace borderline results with refined scores
      const nonBorderlineResults = results.filter((r) => r.score < 65 || r.score > 85);
      results = [...nonBorderlineResults, ...refinedResults].sort((a, b) => b.score - a.score);
    }

    if (chatCandidates.length >= maxChatCalls) {
      console.log(`[Similarity] Chat fallback cap reached (${maxChatCalls} calls) - operator may need to tune thresholds`);
    }

    return results.slice(0, limit);
  } catch (error: any) {
    console.error('Error checking similarity for new risk:', error);
    // Gracefully degrade - return empty array
    return [];
  }
}

