/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

/**
 * Calculate risk score: (C + I + A) * likelihood
 */
export function calculateRiskScore(
  confidentiality: number,
  integrity: number,
  availability: number,
  likelihood: number
): number {
  return (confidentiality + integrity + availability) * likelihood;
}

/**
 * Calculate mitigated risk score: (MC + MI + MA) * ML
 */
export function calculateMitigatedScore(
  mitigatedConfidentiality: number | null | undefined,
  mitigatedIntegrity: number | null | undefined,
  mitigatedAvailability: number | null | undefined,
  mitigatedLikelihood: number | null | undefined
): number | null {
  if (
    mitigatedConfidentiality === null ||
    mitigatedConfidentiality === undefined ||
    mitigatedIntegrity === null ||
    mitigatedIntegrity === undefined ||
    mitigatedAvailability === null ||
    mitigatedAvailability === undefined ||
    mitigatedLikelihood === null ||
    mitigatedLikelihood === undefined
  ) {
    return null;
  }
  return (
    mitigatedConfidentiality + mitigatedIntegrity + mitigatedAvailability
  ) * mitigatedLikelihood;
}

/**
 * Get risk level category based on score
 * Low: 3-14, Medium: 15-35, High: 36-75
 */
export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 36) return 'HIGH';
  if (score >= 15) return 'MEDIUM';
  return 'LOW';
}

/**
 * Parse annexAControlsRaw string into individual control codes
 * Example: "A.8.3, A.5.9, A.8.24" -> ["A.8.3", "A.5.9", "A.8.24"]
 */
export function parseControlCodes(rawString: string | null | undefined): string[] {
  if (!rawString) {
    return [];
  }

  return rawString
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

/**
 * Normalize control code by removing "A." prefix if present
 * Example: "A.8.25" -> "8.25", "8.25" -> "8.25"
 */
export function normalizeControlCode(code: string): string {
  return code.trim().replace(/^A\./i, '');
}

/**
 * Find control by code, handling both "8.25" and "A.8.25" formats
 * Prefers standard controls over custom controls when multiple matches exist
 */
async function findControlByCode(code: string) {
  const normalized = normalizeControlCode(code);
  
  // Try exact match first (normalized code)
  let control = await prisma.control.findUnique({
    where: { code: normalized },
  });
  if (control) return control;
  
  // Try with "A." prefix
  control = await prisma.control.findUnique({
    where: { code: `A.${normalized}` },
  });
  if (control) return control;
  
  // If still not found, try finding by normalized code (handles both formats)
  const controls = await prisma.control.findMany({
    where: {
      OR: [
        { code: normalized },
        { code: `A.${normalized}` },
      ],
    },
  });
  
  // Prefer standard control if multiple exist
  const standardControl = controls.find(c => c.isStandardControl);
  return standardControl || controls[0] || null;
}

/**
 * Update risk-control associations based on annexAControlsRaw
 */
export async function updateRiskControls(riskId: string, controlCodes: string[]) {
  // Find or create controls by code
  const controls = await Promise.all(
    controlCodes.map(async (code) => {
      // Use normalized lookup to handle both "8.25" and "A.8.25" formats
      let control = await findControlByCode(code);

      if (!control) {
        // Check if standard control exists with normalized code before creating
        const normalizedCode = normalizeControlCode(code);
        const standardControl = await findControlByCode(normalizedCode);
        
        if (standardControl?.isStandardControl) {
          // Use existing standard control instead of creating duplicate
          control = standardControl;
        } else {
          // Only create if truly no matching control exists
          control = await prisma.control.create({
            data: {
              id: randomUUID(),
              code,
              title: `Control ${code}`,
              description: `Annex A Control ${code}`,
              selectedForRiskAssessment: false,
              selectedForContractualObligation: false,
              selectedForLegalRequirement: false,
              selectedForBusinessRequirement: false,
              updatedAt: new Date(),
            },
          });
        }
      }

      return control;
    })
  );

  // Delete existing associations
  await prisma.riskControl.deleteMany({
    where: { riskId },
  });

  // Create new associations
  if (controls.length > 0) {
    await Promise.all(
      controls.map((control) =>
        prisma.riskControl.create({
          data: {
            riskId,
            controlId: control.id,
          },
        })
      )
    );
  }

  // Update control applicability
  await updateControlApplicability();
}

/**
 * Update control selection reason for Risk Assessment based on risk associations
 * This automatically sets selectedForRiskAssessment based on whether the control
 * is linked to any risks
 */
export async function updateControlApplicability() {
  // Optimize: Use a single raw SQL query to update all controls at once
  // This sets selectedForRiskAssessment to true if the control is referenced in RiskControl, false otherwise
  // Note: PostgreSQL requires quoted identifiers for case-sensitive table/column names
  try {
    await prisma.$executeRaw`
      UPDATE "Control"
      SET "selectedForRiskAssessment" = (
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM "RiskControl" WHERE "RiskControl"."controlId" = "Control"."id"
          ) THEN true 
          ELSE false 
        END
      )
    `;
  } catch (error: any) {
    console.error('[CONTROL-APPLICABILITY] Error updating control applicability:', error);
    throw error; // Re-throw so caller can handle it
  }
}

/**
 * Calculate CIA scores from wizard impact level (simplified CIA - all same value)
 * @param impactLevel Impact level from wizard (1-5)
 * @returns Object with c, i, a all set to the same impact level value
 */
export function calculateCIAFromWizard(impactLevel: number): { c: number; i: number; a: number } {
  // Ensure impact level is within valid range
  const clampedImpact = Math.max(1, Math.min(5, impactLevel));
  return {
    c: clampedImpact,
    i: clampedImpact,
    a: clampedImpact,
  };
}

/**
 * Validate status transition based on user role and current status
 * @param currentStatus Current risk status
 * @param newStatus Desired new status
 * @param userRole User's role
 * @returns true if transition is allowed, false otherwise
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
  userRole: string
): boolean {
  // Contributors can only transition DRAFT -> PROPOSED
  if (userRole === 'CONTRIBUTOR') {
    return currentStatus === 'DRAFT' && newStatus === 'PROPOSED';
  }

  // Editors and Admins can transition PROPOSED -> ACTIVE or PROPOSED -> REJECTED
  if (userRole === 'EDITOR' || userRole === 'ADMIN') {
    if (currentStatus === 'PROPOSED') {
      return newStatus === 'ACTIVE' || newStatus === 'REJECTED';
    }
    // Editors/Admins can also set any status (for flexibility)
    return true;
  }

  // Staff cannot change status
  return false;
}

/**
 * Check if a risk has policy non-conformance
 * A risk has policy non-conformance if:
 * - initialRiskTreatmentCategory === 'MODIFY'
 * - AND initial risk score is not LOW (MEDIUM or HIGH)
 * - AND Additional Controls Assessment is incomplete (missing mitigated scores OR missing mitigation description)
 * 
 * Additional Controls Assessment is considered complete when:
 * - At least one mitigated score is set (MC, MI, MA, ML, or MR)
 * - AND mitigationDescription is filled in
 * 
 * Note: LOW risk scores are exempt from non-conformance even if MODIFY, as the risk may have been incorrectly categorized.
 */
export function hasPolicyNonConformance(risk: {
  initialRiskTreatmentCategory: string | null;
  calculatedScore: number;
  mitigatedConfidentialityScore: number | null;
  mitigatedIntegrityScore: number | null;
  mitigatedAvailabilityScore: number | null;
  mitigatedLikelihood: number | null;
  mitigatedScore: number | null;
  mitigationDescription: string | null;
}): boolean {
  // Only MODIFY risks can have policy non-conformance
  if (risk.initialRiskTreatmentCategory !== 'MODIFY') {
    return false;
  }

  // Exempt LOW risk scores from non-conformance (even if MODIFY, may be incorrectly categorized)
  const initialRiskLevel = getRiskLevel(risk.calculatedScore);
  if (initialRiskLevel === 'LOW') {
    return false;
  }

  // Check if Additional Controls Assessment is incomplete
  const hasMitigatedScores =
    risk.mitigatedConfidentialityScore !== null ||
    risk.mitigatedIntegrityScore !== null ||
    risk.mitigatedAvailabilityScore !== null ||
    risk.mitigatedLikelihood !== null ||
    risk.mitigatedScore !== null;

  const hasMitigationDescription = risk.mitigationDescription && risk.mitigationDescription.trim().length > 0;

  // Non-conformance if MODIFY (with MEDIUM/HIGH score) but Additional Controls are incomplete
  return !(hasMitigatedScores && hasMitigationDescription);
}

