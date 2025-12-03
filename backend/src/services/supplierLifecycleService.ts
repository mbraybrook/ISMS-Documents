import { SupplierLifecycleState, AssessmentStatus } from '../types/enums';
import { prisma } from '../lib/prisma';

export interface SupplierWithAssessments {
  id: string;
  lifecycleState: string;
  supplierType: string;
  criticality: string | null;
  pciStatus: string | null;
  cisoExemptionGranted: boolean;
  riskAssessments?: Array<{
    status: string;
    id: string;
  }>;
  criticalityAssessments?: Array<{
    status: string;
    id: string;
  }>;
}

/**
 * Validates if a lifecycle state transition is allowed
 * @param currentState Current supplier lifecycle state
 * @param newState Desired new state
 * @param supplier Supplier data with assessments
 * @returns true if transition is allowed, false otherwise
 */
export function validateLifecycleTransition(
  currentState: SupplierLifecycleState,
  newState: SupplierLifecycleState,
  supplier?: SupplierWithAssessments
): boolean {
  // Same state is always valid (no-op)
  if (currentState === newState) {
    return true;
  }

  // EXIT_IN_PROGRESS can be set from any state (Phase 4)
  if (newState === 'EXIT_IN_PROGRESS') {
    return true;
  }

  // Valid transitions
  const validTransitions: Record<SupplierLifecycleState, SupplierLifecycleState[]> = {
    DRAFT: ['IN_ASSESSMENT', 'EXIT_IN_PROGRESS'],
    IN_ASSESSMENT: ['AWAITING_APPROVAL', 'DRAFT', 'EXIT_IN_PROGRESS'],
    AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'EXIT_IN_PROGRESS'],
    APPROVED: ['IN_REVIEW', 'EXIT_IN_PROGRESS'],
    REJECTED: ['DRAFT', 'IN_ASSESSMENT', 'EXIT_IN_PROGRESS'],
    IN_REVIEW: ['APPROVED', 'AWAITING_APPROVAL', 'EXIT_IN_PROGRESS'],
    EXIT_IN_PROGRESS: [], // Cannot transition from exit (would need separate exit completion flow)
  };

  const allowedStates = validTransitions[currentState] || [];
  return allowedStates.includes(newState);
}

/**
 * Auto-determines the next lifecycle state based on supplier and assessment statuses
 * @param supplier Supplier with assessments
 * @returns The determined next state, or null if state should remain unchanged
 */
export async function determineNextState(
  supplier: SupplierWithAssessments
): Promise<SupplierLifecycleState | null> {
  const currentState = supplier.lifecycleState as SupplierLifecycleState;

  // Don't auto-transition from these states
  if (['EXIT_IN_PROGRESS', 'REJECTED'].includes(currentState)) {
    return null;
  }

  // Fetch assessments if not provided
  let riskAssessments = supplier.riskAssessments;
  let criticalityAssessments = supplier.criticalityAssessments;

  if (!riskAssessments || !criticalityAssessments) {
    const fullSupplier = await prisma.supplier.findUnique({
      where: { id: supplier.id },
      include: {
        riskAssessments: {
          select: { id: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        criticalityAssessments: {
          select: { id: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!fullSupplier) {
      return null;
    }

    riskAssessments = fullSupplier.riskAssessments;
    criticalityAssessments = fullSupplier.criticalityAssessments;
  }

  const hasRiskAssessment = riskAssessments.length > 0;
  const hasCriticalityAssessment = criticalityAssessments.length > 0;
  const latestRiskAssessment = riskAssessments[0];
  const latestCriticalityAssessment = criticalityAssessments[0];

  // DRAFT → IN_ASSESSMENT: When first assessment is created
  if (currentState === 'DRAFT' && (hasRiskAssessment || hasCriticalityAssessment)) {
    return 'IN_ASSESSMENT';
  }

  // IN_ASSESSMENT → AWAITING_APPROVAL: When both assessments are SUBMITTED
  if (currentState === 'IN_ASSESSMENT') {
    const riskSubmitted = latestRiskAssessment?.status === 'SUBMITTED';
    const criticalitySubmitted = latestCriticalityAssessment?.status === 'SUBMITTED';

    if (riskSubmitted && criticalitySubmitted) {
      return 'AWAITING_APPROVAL';
    }
  }

  // AWAITING_APPROVAL → APPROVED: When both assessments are APPROVED
  if (currentState === 'AWAITING_APPROVAL') {
    const riskApproved = latestRiskAssessment?.status === 'APPROVED';
    const criticalityApproved = latestCriticalityAssessment?.status === 'APPROVED';

    if (riskApproved && criticalityApproved) {
      return 'APPROVED';
    }
  }

  // AWAITING_APPROVAL → REJECTED: When any assessment is REJECTED
  if (currentState === 'AWAITING_APPROVAL') {
    const riskRejected = latestRiskAssessment?.status === 'REJECTED';
    const criticalityRejected = latestCriticalityAssessment?.status === 'REJECTED';

    if (riskRejected || criticalityRejected) {
      return 'REJECTED';
    }
  }

  return null;
}

/**
 * Checks if CISO approval is required for a supplier/assessment based on policy rules
 * @param supplier Supplier data
 * @param assessmentType Type of assessment ('RISK' | 'CRITICALITY')
 * @param assessmentCriticality Criticality from assessment (for criticality assessments)
 * @returns true if CISO approval is required
 */
export function requiresCisoApproval(
  supplier: { supplierType: string; criticality: string | null },
  assessmentType: 'RISK' | 'CRITICALITY',
  assessmentCriticality?: string | null
): boolean {
  // CISO approval required if:
  // 1. supplierType = CONNECTED_ENTITY OR
  // 2. supplierType = PCI_SERVICE_PROVIDER OR
  // 3. criticality = HIGH (from supplier or assessment)
  const criticality = assessmentType === 'CRITICALITY' 
    ? (assessmentCriticality || supplier.criticality)
    : supplier.criticality;

  return (
    supplier.supplierType === 'CONNECTED_ENTITY' ||
    supplier.supplierType === 'PCI_SERVICE_PROVIDER' ||
    criticality === 'HIGH'
  );
}

/**
 * Validates if an approver can approve based on policy rules
 * @param supplier Supplier data
 * @param assessmentType Type of assessment
 * @param assessmentCriticality Criticality from assessment
 * @param approverRole Approver's role
 * @returns true if approver can approve
 */
export function canApproveSupplier(
  supplier: { supplierType: string; criticality: string | null },
  assessmentType: 'RISK' | 'CRITICALITY',
  assessmentCriticality: string | null,
  approverRole: string
): boolean {
  const needsCiso = requiresCisoApproval(supplier, assessmentType, assessmentCriticality);

  if (needsCiso) {
    // Only ADMIN can approve (treating ADMIN as CISO role)
    return approverRole === 'ADMIN';
  }

  // For non-CISO approvals, ADMIN and EDITOR can approve
  return approverRole === 'ADMIN' || approverRole === 'EDITOR';
}

