import { prisma } from '../lib/prisma';

export interface AuditLogDetails {
  [key: string]: any;
}

export async function logTrustAction(
  action: string,
  performedByUserId?: string,
  performedByExternalUserId?: string,
  targetUserId?: string,
  targetDocumentId?: string,
  details?: AuditLogDetails,
  ipAddress?: string
): Promise<void> {
  try {
    await prisma.trustAuditLog.create({
      data: {
        action,
        performedByUserId: performedByUserId || null,
        performedByExternalUserId: performedByExternalUserId || null,
        targetUserId: targetUserId || null,
        targetDocumentId: targetDocumentId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    console.error('[TRUST_AUDIT] Failed to log action:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

