/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../lib/prisma';
import { generateEmbeddingRemote } from '../clients/aiServiceClient';
import { ConcurrencyLimiter } from '../utils/concurrencyLimiter';
import { config } from '../config';

/**
 * Normalize and combine risk text for embedding generation
 */
function normalizeRiskText(
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
    const embedding = await generateEmbeddingRemote(text);
    
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

  // eslint-disable-next-line no-constant-condition
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
    await Promise.all(
      risks.map((risk: { id: string; title: string; threatDescription: string | null; description: string | null }) =>
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

/**
 * Normalize and combine control text for embedding generation
 */
function normalizeControlText(
  code: string,
  title: string,
  description?: string | null,
  purpose?: string | null,
  guidance?: string | null,
): string {
  const parts = [
    code || '',
    title || '',
    description || '',
    purpose || '',
    guidance || '',
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
 * Compute and store embedding for a control
 * This is a best-effort operation - failures do not roll back the control creation/update
 */
export async function computeAndStoreControlEmbedding(
  controlId: string,
  code: string,
  title: string,
  description?: string | null,
  purpose?: string | null,
  guidance?: string | null,
): Promise<number[] | null> {
  try {
    const text = normalizeControlText(code, title, description, purpose, guidance);
    const embedding = await generateEmbeddingRemote(text);
    
    if (embedding) {
      await prisma.control.update({
        where: { id: controlId },
        data: { embedding: embedding },
      });
    } else {
      console.error(`[Embedding Service] Failed to generate embedding for control ${controlId}`);
    }
    
    return embedding;
  } catch (error: any) {
    console.error(`[Embedding Service] Error computing/storing embedding for control ${controlId}:`, error.message);
    // Do not throw - this is best-effort
    return null;
  }
}

/**
 * Backfill embeddings for controls that don't have them
 * Idempotent and safe to re-run (only processes controls with embedding IS NULL)
 */
export async function backfillControlEmbeddings(
  batchSize: number = 10,
  concurrency: number = 2,
  dryRun: boolean = false,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const limiter = new ConcurrencyLimiter(concurrency);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  console.log(`[Backfill] Starting control embedding backfill (batchSize=${batchSize}, concurrency=${concurrency}, dryRun=${dryRun})`);

  let lastId: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Use cursor-based pagination to avoid skipping rows as embeddings are added
    // This ensures we process all controls with NULL embeddings, even as the result set changes
    let controls: Array<{ id: string; code: string; title: string; description: string | null; purpose: string | null; guidance: string | null }>;
    
    if (lastId) {
      controls = await prisma.$queryRaw<Array<{ id: string; code: string; title: string; description: string | null; purpose: string | null; guidance: string | null }>>`
        SELECT id, code, title, description, purpose, guidance
        FROM "Control"
        WHERE embedding IS NULL AND id > ${lastId}
        ORDER BY id ASC
        LIMIT ${batchSize}
      `;
    } else {
      controls = await prisma.$queryRaw<Array<{ id: string; code: string; title: string; description: string | null; purpose: string | null; guidance: string | null }>>`
        SELECT id, code, title, description, purpose, guidance
        FROM "Control"
        WHERE embedding IS NULL
        ORDER BY id ASC
        LIMIT ${batchSize}
      `;
    }

    if (controls.length === 0) {
      break; // Loop until zero rows returned
    }

    // Process batch with concurrency limit
    await Promise.all(
      controls.map((control) =>
        limiter.execute(async () => {
          try {
            if (!dryRun) {
              const embedding = await computeAndStoreControlEmbedding(
                control.id,
                control.code,
                control.title,
                control.description,
                control.purpose,
                control.guidance,
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
            console.error(`[Backfill] Failed for control ${control.id}:`, error.message);
          }
        }),
      ),
    );

    // Update cursor to the last processed ID
    lastId = controls[controls.length - 1].id;
    console.log(
      `[Backfill Progress] Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed} (lastId: ${lastId})`,
    );
  }

  console.log(
    `[Backfill] Complete - Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}`,
  );

  return { processed, succeeded, failed };
}

