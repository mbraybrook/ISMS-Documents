import { SupplierLifecycleState } from '../types/enums';

export interface SupplierWithAssessments {
  id: string;
  lifecycleState: string;
  supplierType: string;
  criticality: string | null;
  pciStatus: string | null;
  cisoExemptionGranted: boolean;
}

/**
 * Validates if a lifecycle state transition is allowed
 * @param currentState Current supplier lifecycle state
 * @param newState Desired new state
 * @param supplier Supplier data with assessments
 * @returns true if transition is allowed, false otherwise
 * 
 * NOTE: All transitions are now allowed - restrictions have been removed
 */
export function validateLifecycleTransition(
  _currentState: SupplierLifecycleState,
  _newState: SupplierLifecycleState,
  _supplier?: SupplierWithAssessments
): boolean {
  // All transitions are now allowed
  return true;
}

/**
 * Auto-determines the next lifecycle state based on supplier status
 * @param supplier Supplier data
 * @returns The determined next state, or null if state should remain unchanged
 * 
 * NOTE: Assessment-based auto-transitions have been removed. This function now returns null
 * to allow manual state management.
 */
export async function determineNextState(
  _supplier: SupplierWithAssessments
): Promise<SupplierLifecycleState | null> {
  // Assessment-based auto-transitions have been removed
  // Lifecycle state is now managed manually
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


