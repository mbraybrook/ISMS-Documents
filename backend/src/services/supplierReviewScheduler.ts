import { prisma } from '../lib/prisma';
import { Criticality } from '../types/enums';

export interface SupplierForReview {
  id: string;
  criticality: string | null;
  lastReviewAt: Date | null;
  nextReviewAt: Date | null;
  relationshipOwnerUserId: string | null;
  lifecycleState: string;
}

/**
 * Calculates the next review date based on supplier criticality
 * @param supplier Supplier data
 * @returns Next review date or null for Low criticality
 */
export function calculateNextReviewDate(supplier: SupplierForReview): Date | null {
  const criticality = supplier.criticality as Criticality | null;

  if (!criticality || criticality === 'LOW') {
    // Low criticality: optional/ad-hoc, no scheduled review
    return null;
  }

  // High and Medium: 1 year from now (or from lastReviewAt if exists)
  const baseDate = supplier.lastReviewAt || new Date();
  const nextReview = new Date(baseDate);
  nextReview.setFullYear(nextReview.getFullYear() + 1);

  return nextReview;
}

/**
 * Checks if a supplier needs a review task created
 * @param supplier Supplier data
 * @param thresholdDays Days before due date to create task (default 30)
 * @returns true if task should be created
 */
export async function shouldCreateReviewTask(
  supplier: SupplierForReview,
  thresholdDays: number = 30
): Promise<boolean> {
  if (!supplier.nextReviewAt) {
    return false;
  }

  // Check if there's already an open review task
  const existingTask = await prisma.reviewTask.findFirst({
    where: {
      supplierId: supplier.id,
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
    },
  });

  if (existingTask) {
    return false;
  }

  // Check if nextReviewAt is within threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

  return supplier.nextReviewAt <= thresholdDate;
}

/**
 * Creates a review task for a supplier with appropriate assignee
 * @param supplier Supplier data
 * @returns Created ReviewTask or null if creation failed
 */
export async function createReviewTaskForSupplier(
  supplier: SupplierForReview
): Promise<any | null> {
  const criticality = supplier.criticality as Criticality | null;

  // Determine assignee
  let reviewerUserId: string | null = null;

  if (criticality === 'HIGH') {
    // High criticality: Assign to CISO (ADMIN role) or relationshipOwner if no CISO
    const ciso = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
      },
      orderBy: {
        createdAt: 'asc', // Get first admin as CISO
      },
    });

    reviewerUserId = ciso?.id || supplier.relationshipOwnerUserId || null;
  } else {
    // Medium/Low: Assign to relationshipOwner
    reviewerUserId = supplier.relationshipOwnerUserId || null;
  }

  if (!reviewerUserId) {
    console.warn(`Cannot create review task for supplier ${supplier.id}: no reviewer available`);
    return null;
  }

  if (!supplier.nextReviewAt) {
    console.warn(`Cannot create review task for supplier ${supplier.id}: no nextReviewAt set`);
    return null;
  }

  // Determine status based on due date
  const now = new Date();
  const status = supplier.nextReviewAt < now ? 'OVERDUE' : 'PENDING';

  try {
    const reviewTask = await prisma.reviewTask.create({
      data: {
        id: `review-${supplier.id}-${Date.now()}`,
        supplierId: supplier.id,
        reviewerUserId,
        dueDate: supplier.nextReviewAt,
        status,
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
    console.error(`Error creating review task for supplier ${supplier.id}:`, error);
    return null;
  }
}

/**
 * Recalculates nextReviewAt when criticality changes
 * @param supplierId Supplier ID
 * @param newCriticality New criticality value
 * @returns Updated nextReviewAt or null
 */
export async function recalculateReviewDateOnAssessmentApproval(
  supplierId: string,
  newCriticality: Criticality | null
): Promise<Date | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      criticality: true,
      lastReviewAt: true,
      nextReviewAt: true,
      relationshipOwnerUserId: true,
      lifecycleState: true,
    },
  });

  if (!supplier) {
    return null;
  }

  const nextReviewAt = calculateNextReviewDate({
    ...supplier,
    criticality: newCriticality,
  });

  if (nextReviewAt !== supplier.nextReviewAt) {
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { nextReviewAt },
    });
  }

  return nextReviewAt;
}

