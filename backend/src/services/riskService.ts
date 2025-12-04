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
 * Update risk-control associations based on annexAControlsRaw
 */
export async function updateRiskControls(riskId: string, controlCodes: string[]) {
  // Find or create controls by code
  const controls = await Promise.all(
    controlCodes.map(async (code) => {
      let control = await prisma.control.findUnique({
        where: { code },
      });

      if (!control) {
        // Create control if it doesn't exist
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
  await prisma.$executeRaw`
    UPDATE Control
    SET selectedForRiskAssessment = (
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM RiskControl WHERE RiskControl.controlId = Control.id
        ) THEN 1 
        ELSE 0 
      END
    )
  `;
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

