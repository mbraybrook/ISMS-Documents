import { prisma } from '../lib/prisma';
import { generateEmbedding, normalizeRiskText } from './llmService';
import { ConcurrencyLimiter } from '../utils/concurrencyLimiter';

/**
 * Compute and store embedding for a risk
 * This is a best-effort operation - failures do not roll back the risk creation/update
 */
export async function computeAndStoreEmbedding(
  riskId: string,
  title: string,
  threatDescription?: string | null,
  description?: string | null,
): Promise<number[] | null> {
  try {
    const text = normalizeRiskText(title, threatDescription, description);
    const embedding = await generateEmbedding(text);
    
    if (embedding) {
      await prisma.risk.update({
        where: { id: riskId },
        data: { embedding: embedding },
      });
    } else {
      console.error(`[Embedding Service] Failed to generate embedding for risk ${riskId}`);
    }
    
    return embedding;
  } catch (error: any) {
    console.error(`[Embedding Service] Error computing/storing embedding for risk ${riskId}:`, error.message);
    // Do not throw - this is best-effort
    return null;
  }
}

/**
 * Backfill embeddings for risks that don't have them
 * Idempotent and safe to re-run (only processes risks with embedding IS NULL)
 */
export async function backfillRiskEmbeddings(
  batchSize: number = 10,
  concurrency: number = 2,
  dryRun: boolean = false,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const limiter = new ConcurrencyLimiter(concurrency);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let offset = 0;

  console.log(`[Backfill] Starting backfill (batchSize=${batchSize}, concurrency=${concurrency}, dryRun=${dryRun})`);

  while (true) {
    // Always query with WHERE embedding IS NULL (idempotent, safe to re-run)
    // For JSON fields in Prisma, we need to use a raw query or check for DbNull
    // Using raw SQL for reliable null checking on JSON fields
    const risks = await prisma.$queryRaw<Array<{ id: string; title: string; threatDescription: string | null; description: string | null }>>`
      SELECT id, title, "threatDescription", description
      FROM "Risk"
      WHERE embedding IS NULL
      ORDER BY id ASC
      LIMIT ${batchSize}
      OFFSET ${offset}
    `;

    if (risks.length === 0) {
      break; // Loop until zero rows returned
    }

    // Process batch with concurrency limit
    const results = await Promise.all(
      risks.map((risk) =>
        limiter.execute(async () => {
          try {
            if (!dryRun) {
              const embedding = await computeAndStoreEmbedding(
                risk.id,
                risk.title,
                risk.threatDescription,
                risk.description,
              );
              if (embedding) {
                succeeded++;
              } else {
                failed++;
              }
            } else {
              succeeded++; // Count as would-succeed in dry-run
            }
            processed++;
          } catch (error: any) {
            failed++;
            processed++;
            console.error(`[Backfill] Failed for risk ${risk.id}:`, error.message);
          }
        }),
      ),
    );

    offset += batchSize;
    console.log(
      `[Backfill Progress] Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed} (offset: ${offset})`,
    );
  }

  console.log(
    `[Backfill] Complete - Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}`,
  );

  return { processed, succeeded, failed };
}

