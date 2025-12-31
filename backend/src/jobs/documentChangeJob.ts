import * as cron from 'node-cron';
import { log } from '../lib/logger';
import { checkDocumentChanges } from '../services/documentChangeService';

let job: cron.ScheduledTask | null = null;

/**
 * Start the daily document change check job
 * Runs at 2 AM every day by default
 * @param schedule - Cron schedule (default: '0 2 * * *' = 2 AM daily)
 */
export function startDocumentChangeJob(schedule = '0 2 * * *'): void {
  if (job) {
    log.warn('[DocumentChangeJob] Job already started, stopping existing job');
    stopDocumentChangeJob();
  }

  log.info('[DocumentChangeJob] Starting daily document change check job', {
    schedule,
  });

  job = cron.schedule(
    schedule,
    async () => {
      log.info('[DocumentChangeJob] Running scheduled document change check');
      try {
        const result = await checkDocumentChanges();
        log.info('[DocumentChangeJob] Scheduled check completed', result);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error('[DocumentChangeJob] Scheduled check failed', {
          error: err.message,
          stack: err.stack,
        });
        // Don't throw - we want the job to continue running
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    }
  );

  log.info('[DocumentChangeJob] Job scheduled successfully');
}

/**
 * Stop the daily document change check job
 */
export function stopDocumentChangeJob(): void {
  if (job) {
    job.stop();
    job = null;
    log.info('[DocumentChangeJob] Job stopped');
  }
}

/**
 * Manually trigger the document change check (for testing or manual runs)
 */
export async function runDocumentChangeCheck(): Promise<void> {
  log.info('[DocumentChangeJob] Running manual document change check');
  try {
    const result = await checkDocumentChanges();
    log.info('[DocumentChangeJob] Manual check completed', result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('[DocumentChangeJob] Manual check failed', {
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

