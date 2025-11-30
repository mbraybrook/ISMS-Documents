import { prisma } from '../lib/prisma';
import { config } from '../config';
import { calculateSimilarityScore, findSimilarRisks } from './llmService';

export interface SimilarRiskResult {
  risk: any; // Risk with relations
  score: number; // 0-100
  fields: string[]; // Matched fields
}

/**
 * Combine risk fields into text for comparison
 */
function combineRiskText(risk: { title: string; threatDescription?: string | null; description?: string | null }): string {
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
    // Fetch the risk
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
      },
    });

    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    // Get all non-archived risks (excluding current risk)
    const allRisks = await prisma.risk.findMany({
      where: {
        archived: false,
        id: { not: riskId },
      },
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
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

    // Use the batch similarity approach for better performance
    const riskText = combineRiskText(risk);
    const similarityResults = await findSimilarRisks(
      riskText,
      allRisks.map((r) => ({
        id: r.id,
        title: r.title,
        threatDescription: r.threatDescription,
        description: r.description,
      }))
    );

    // Map results to include full risk data
    const results: SimilarRiskResult[] = similarityResults
      .map((result) => {
        const fullRisk = allRisks.find((r) => r.id === result.riskId);
        if (!fullRisk) return null;

        // Transform AssetCategory to category for frontend compatibility
        const transformedRisk = {
          ...fullRisk,
          asset: fullRisk.asset
            ? {
                ...fullRisk.asset,
                category: fullRisk.asset.AssetCategory || null,
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

    // Get all non-archived risks (excluding the risk being edited if provided)
    const where: any = {
      archived: false,
    };
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

    // Use batch similarity approach
    const riskText = combineRiskText(riskData);
    const similarityResults = await findSimilarRisks(
      riskText,
      allRisks.map((r) => ({
        id: r.id,
        title: r.title,
        threatDescription: r.threatDescription,
        description: r.description,
      }))
    );

    // Map results to include full risk data
    const results: SimilarRiskResult[] = similarityResults
      .map((result) => {
        const fullRisk = allRisks.find((r) => r.id === result.riskId);
        if (!fullRisk) return null;

        // Transform AssetCategory to category for frontend compatibility
        const transformedRisk = {
          ...fullRisk,
          asset: fullRisk.asset
            ? {
                ...fullRisk.asset,
                category: fullRisk.asset.AssetCategory || null,
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
    console.error('Error checking similarity for new risk:', error);
    // Gracefully degrade - return empty array
    return [];
  }
}

