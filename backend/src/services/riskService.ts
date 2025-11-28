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
            code,
            title: `Control ${code}`,
            description: `Annex A Control ${code}`,
            selectedForRiskAssessment: false,
            selectedForContractualObligation: false,
            selectedForLegalRequirement: false,
            selectedForBusinessRequirement: false,
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
    await prisma.riskControl.createMany({
      data: controls.map((control) => ({
        riskId,
        controlId: control.id,
      })),
    });
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
  // Get all controls
  const controls = await prisma.control.findMany();

  for (const control of controls) {
    // Check if control is referenced by any risk
    const riskCount = await prisma.riskControl.count({
      where: { controlId: control.id },
    });

    // Automatically update Risk Assessment reason based on risk relationships
    await prisma.control.update({
      where: { id: control.id },
      data: {
        selectedForRiskAssessment: riskCount > 0,
      },
    });
  }
}

