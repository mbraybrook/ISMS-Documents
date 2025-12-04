import { prisma } from '../lib/prisma';
import { CertificateType } from '../types/enums';

export interface CertificateForExpiry {
  id: string;
  supplierId: string;
  certificateType: string;
  expiryDate: Date;
  supplier: {
    id: string;
    name: string;
    relationshipOwnerUserId: string | null;
  };
}

/**
 * Finds certificates expiring within the specified number of days
 * @param daysBeforeExpiry Number of days before expiry to check
 * @returns Array of certificates expiring soon
 */
export async function findCertificatesExpiringSoon(
  daysBeforeExpiry: number = 30
): Promise<CertificateForExpiry[]> {
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysBeforeExpiry);

  const certificates = await prisma.supplierCertificate.findMany({
    where: {
      expiryDate: {
        gte: now,
        lte: thresholdDate,
      },
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          relationshipOwnerUserId: true,
        },
      },
    },
    orderBy: {
      expiryDate: 'asc',
    },
  });

  return certificates.map((cert) => ({
    id: cert.id,
    supplierId: cert.supplierId,
    certificateType: cert.certificateType,
    expiryDate: cert.expiryDate,
    supplier: cert.supplier,
  }));
}

/**
 * Creates a review task for an expiring certificate
 * @param supplier Supplier data
 * @param certificate Certificate data
 * @returns Created ReviewTask or null if creation failed
 */
export async function createCertificateExpiryTask(
  supplier: { id: string; name: string; relationshipOwnerUserId: string | null },
  certificate: { id: string; certificateType: string; expiryDate: Date }
): Promise<any | null> {
  // Check if there's already an open task for this certificate
  const existingTask = await prisma.reviewTask.findFirst({
    where: {
      supplierId: supplier.id,
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
      changeNotes: {
        contains: `Certificate ${certificate.certificateType}`,
      },
    },
  });

  if (existingTask) {
    return null; // Task already exists
  }

  // Assign to relationshipOwner or first ADMIN
  let reviewerUserId: string | null = supplier.relationshipOwnerUserId;

  if (!reviewerUserId) {
    const admin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    reviewerUserId = admin?.id || null;
  }

  if (!reviewerUserId) {
    console.warn(`Cannot create certificate expiry task: no reviewer available for supplier ${supplier.id}`);
    return null;
  }

  // Determine status based on expiry date
  const now = new Date();
  const status = certificate.expiryDate < now ? 'OVERDUE' : 'PENDING';

  try {
    const reviewTask = await prisma.reviewTask.create({
      data: {
        id: `cert-${certificate.id}-${Date.now()}`,
        supplierId: supplier.id,
        reviewerUserId,
        dueDate: certificate.expiryDate,
        status,
        changeNotes: `Certificate ${certificate.certificateType} expiring on ${certificate.expiryDate.toLocaleDateString()}`,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return reviewTask;
  } catch (error: any) {
    console.error(`Error creating certificate expiry task for certificate ${certificate.id}:`, error);
    return null;
  }
}

/**
 * Helper to parse certificate information from evidence links (for migration/backfill)
 * This is a placeholder for future functionality to extract certificate data from URLs
 * @param links Array of evidence link URLs
 * @returns Array of parsed certificate info (if any can be extracted)
 */
export function parseCertificateFromEvidenceLinks(links: string[] | null): Array<{
  type: CertificateType;
  expiryDate?: Date;
  evidenceLink: string;
}> {
  // Placeholder implementation - in practice, this might:
  // 1. Parse URLs to detect certificate types
  // 2. Extract expiry dates from metadata
  // 3. Call external APIs to validate certificates
  // For now, return empty array
  return [];
}


