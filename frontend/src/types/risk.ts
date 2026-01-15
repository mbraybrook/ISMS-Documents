// Type definitions
export type RiskStatus = 'DRAFT' | 'PROPOSED' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';
export type Department = 'BUSINESS_STRATEGY' | 'FINANCE' | 'HR' | 'OPERATIONS' | 'PRODUCT' | 'MARKETING';

// Helper to get display name for department
export function getDepartmentDisplayName(dept: Department | null | undefined): string {
  if (!dept) return 'Not assigned';
  const displayNames: Record<Department, string> = {
    BUSINESS_STRATEGY: 'Business Strategy',
    FINANCE: 'Finance',
    HR: 'HR',
    OPERATIONS: 'Operations',
    PRODUCT: 'Product',
    MARKETING: 'Marketing',
  };
  return displayNames[dept] || dept;
}

// Risk interface matching the backend model
export interface Risk {
  id: string;
  title: string;
  description: string | null;
  dateAdded: string;
  riskCategory: string | null;
  riskNature: string | null;
  archived: boolean;
  archivedDate: string | null;
  expiryDate: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  ownerUserId: string | null;
  acceptedByUserId?: string | null;
  acceptedAt?: string | null;
  acceptanceRationale?: string | null;
  appetiteThreshold?: number | null;
  reviewCadenceDays?: number | null;
  department: string | null;
  status: RiskStatus;
  wizardData: string | null;
  rejectionReason: string | null;
  mergedIntoRiskId: string | null;
  assetCategory: string | null;
  assetId: string | null;
  assetCategoryId: string | null;
  asset: {
    id: string;
    nameSerialNo: string | null;
    model: string | null;
    category: {
      id: string;
      name: string;
    };
  } | null;
  linkedAssetCategory: {
    id: string;
    name: string;
  } | null;
  interestedParty: {
    id: string;
    name: string;
    group: string | null;
  } | null;
  threatDescription: string | null;
  confidentialityScore: number;
  integrityScore: number;
  availabilityScore: number;
  riskScore: number | null;
  likelihood: number;
  calculatedScore: number;
  initialRiskTreatmentCategory: string | null;
  mitigatedConfidentialityScore: number | null;
  mitigatedIntegrityScore: number | null;
  mitigatedAvailabilityScore: number | null;
  mitigatedRiskScore: number | null;
  mitigatedLikelihood: number | null;
  mitigatedScore: number | null;
  mitigationImplemented: boolean;
  mitigationDescription: string | null;
  residualRiskTreatmentCategory: string | null;
  annexAControlsRaw: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  riskControls?: Array<{
    control: {
      id: string;
      code: string;
      title: string;
      description: string | null;
    };
  }>;
}

// Similar risk result from API
export interface SimilarRisk {
  risk: Risk;
  similarityScore: number; // 0-100
  matchedFields: string[]; // ['title', 'threatDescription', 'description']
}

// Similar risk result (internal representation)
export interface SimilarRiskResult {
  risk: Risk;
  score: number;
  fields: string[];
}


