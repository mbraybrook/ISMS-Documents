import { prisma } from '../lib/prisma';
import { findSimilarRisks } from './llmService';
import { config } from '../config';

export interface SupplierRiskSuggestion {
  risk: any; // Risk with relations
  similarityScore: number; // 0-100
  matchedFields: string[];
}

/**
 * Normalize and combine supplier fields into text for embedding generation
 * Prioritizes serviceDescription, riskRationale, criticalityRationale
 */
function normalizeSupplierText(
  name: string,
  tradingName: string | null,
  supplierType: string | null,
  serviceDescription: string | null,
  riskRationale: string | null,
  criticalityRationale: string | null
): string {
  const parts: string[] = [];
  
  // Primary fields (weighted more) - these are most relevant for risk matching
  if (serviceDescription && serviceDescription.trim()) {
    parts.push(`Service Description: ${serviceDescription.trim()}`);
  }
  if (riskRationale && riskRationale.trim()) {
    parts.push(`Risk Rationale: ${riskRationale.trim()}`);
  }
  if (criticalityRationale && criticalityRationale.trim()) {
    parts.push(`Criticality Rationale: ${criticalityRationale.trim()}`);
  }
  
  // Context fields - provide additional context
  if (name && name.trim()) {
    parts.push(`Supplier Name: ${name.trim()}`);
  }
  if (tradingName && tradingName.trim()) {
    parts.push(`Trading Name: ${tradingName.trim()}`);
  }
  if (supplierType && supplierType.trim()) {
    parts.push(`Supplier Type: ${supplierType.trim()}`);
  }
  
  let combined = parts.join('\n\n');
  const maxLen = config.llm.maxEmbeddingTextLength;
  if (combined.length > maxLen) {
    // Prioritize primary fields - truncate from the end but try to keep primary fields
    combined = combined.slice(0, maxLen);
  }
  
  return combined.toLowerCase();
}

/**
 * Find relevant risks for a supplier using semantic similarity
 */
export async function findRelevantRisksForSupplier(
  supplierId: string,
  limit: number = 15
): Promise<SupplierRiskSuggestion[]> {
  try {
    // Fetch supplier data
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        tradingName: true,
        supplierType: true,
        serviceDescription: true,
        riskRationale: true,
        criticalityRationale: true,
      },
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Normalize supplier text for embedding
    const supplierText = normalizeSupplierText(
      supplier.name,
      supplier.tradingName,
      supplier.supplierType,
      supplier.serviceDescription,
      supplier.riskRationale,
      supplier.criticalityRationale
    );

    // Validate we have enough text to generate meaningful embeddings
    if (supplierText.trim().length < 10) {
      console.warn(`[SupplierRiskSuggestion] Insufficient supplier data for ${supplierId}`);
      return [];
    }

    // Get all non-archived risks with embeddings
    // Limit to 100 risks for performance (similar to duplicate detection)
    const allRisks = await prisma.risk.findMany({
      where: {
        archived: false,
      },
      select: {
        id: true,
        title: true,
        threatDescription: true,
        description: true,
        embedding: true,
        riskCategory: true,
        calculatedScore: true,
        status: true,
        ownerUserId: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      take: 100, // Limit for performance
    });

    if (allRisks.length === 0) {
      return [];
    }

    // Get already-linked risks to exclude
    const linkedRisks = await prisma.supplierRiskLink.findMany({
      where: { supplierId },
      select: { riskId: true },
    });
    const linkedRiskIds = new Set(linkedRisks.map((link) => link.riskId));

    // Filter out already-linked risks
    const candidateRisks = allRisks.filter((risk) => !linkedRiskIds.has(risk.id));

    if (candidateRisks.length === 0) {
      return [];
    }

    // Use findSimilarRisks to get similarity scores
    const similarityResults = await findSimilarRisks(
      supplierText,
      candidateRisks.map((risk) => ({
        id: risk.id,
        title: risk.title,
        threatDescription: risk.threatDescription,
        description: risk.description,
        embedding: risk.embedding,
      }))
    );

    // Filter by minimum similarity threshold (50)
    const filteredResults = similarityResults.filter((result) => result.score >= 50);

    // Get full risk data for results
    const results: SupplierRiskSuggestion[] = [];
    for (const result of filteredResults.slice(0, limit)) {
      const risk = candidateRisks.find((r) => r.id === result.riskId);
      if (risk) {
        results.push({
          risk: {
            ...risk,
            // Include additional fields that might be useful
            riskCategory: risk.riskCategory,
            calculatedScore: risk.calculatedScore,
            status: risk.status,
            owner: risk.owner,
          },
          similarityScore: result.score,
          matchedFields: result.matchedFields,
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error('[SupplierRiskSuggestion] Error finding relevant risks:', error);
    // Graceful degradation - return empty array
    return [];
  }
}


