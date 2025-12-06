// Type definitions for Supplier
export type SupplierStatus = 'ACTIVE' | 'IN_ONBOARDING' | 'IN_EXIT' | 'INACTIVE';
export type SupplierType = 'SERVICE_PROVIDER' | 'CONNECTED_ENTITY' | 'PCI_SERVICE_PROVIDER';
export type ServiceSubType = 'SAAS';
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH';
export type Criticality = 'LOW' | 'MEDIUM' | 'HIGH';
export type PciStatus = 'UNKNOWN' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type IsoStatus = 'UNKNOWN' | 'CERTIFIED' | 'NOT_CERTIFIED' | 'IN_PROGRESS' | 'NOT_APPLICABLE';
export type GdprStatus = 'UNKNOWN' | 'ADEQUATE' | 'HIGH_RISK' | 'NOT_APPLICABLE';
export type PerformanceRating = 'GOOD' | 'CAUTION' | 'BAD';
export type SupplierLifecycleState = 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_REVIEW' | 'EXIT_IN_PROGRESS';
export type TrustCenterCategory = 'HOSTING' | 'PAYMENTS' | 'COMMUNICATIONS' | 'SECURITY' | 'OTHER';

// Helper functions for display names
export function getSupplierStatusDisplayName(status: SupplierStatus | null | undefined): string {
  if (!status) return 'Unknown';
  const displayNames: Record<SupplierStatus, string> = {
    ACTIVE: 'Active',
    IN_ONBOARDING: 'In Onboarding',
    IN_EXIT: 'In Exit',
    INACTIVE: 'Inactive',
  };
  return displayNames[status] || status;
}

export function getSupplierTypeDisplayName(type: SupplierType | null | undefined): string {
  if (!type) return 'Unknown';
  const displayNames: Record<SupplierType, string> = {
    SERVICE_PROVIDER: 'Service Provider',
    CONNECTED_ENTITY: 'Connected Entity',
    PCI_SERVICE_PROVIDER: 'PCI Service Provider',
  };
  return displayNames[type] || type;
}

export function getServiceSubTypeDisplayName(type: ServiceSubType | null | undefined): string {
  if (!type) return 'Not specified';
  if (type === 'SAAS') return 'SaaS';
  return type;
}

export function getRiskRatingDisplayName(rating: RiskRating | null | undefined): string {
  if (!rating) return 'Not assessed';
  return rating.charAt(0) + rating.slice(1).toLowerCase();
}

export function getCriticalityDisplayName(criticality: Criticality | null | undefined): string {
  if (!criticality) return 'Not assessed';
  return criticality.charAt(0) + criticality.slice(1).toLowerCase();
}

export function getPciStatusDisplayName(status: PciStatus | null | undefined): string {
  if (!status) return 'Unknown';
  const displayNames: Record<PciStatus, string> = {
    UNKNOWN: 'Unknown',
    PASS: 'Pass',
    FAIL: 'Fail',
    NOT_APPLICABLE: 'Not Applicable',
  };
  return displayNames[status] || status;
}

export function getIsoStatusDisplayName(status: IsoStatus | null | undefined): string {
  if (!status) return 'Unknown';
  const displayNames: Record<IsoStatus, string> = {
    UNKNOWN: 'Unknown',
    CERTIFIED: 'Certified',
    NOT_CERTIFIED: 'Not Certified',
    IN_PROGRESS: 'In Progress',
    NOT_APPLICABLE: 'Not Applicable',
  };
  return displayNames[status] || status;
}

export function getGdprStatusDisplayName(status: GdprStatus | null | undefined): string {
  if (!status) return 'Unknown';
  const displayNames: Record<GdprStatus, string> = {
    UNKNOWN: 'Unknown',
    ADEQUATE: 'Adequate',
    HIGH_RISK: 'High Risk',
    NOT_APPLICABLE: 'Not Applicable',
  };
  return displayNames[status] || status;
}

export function getPerformanceRatingDisplayName(rating: PerformanceRating | null | undefined): string {
  if (!rating) return 'Not rated';
  const displayNames: Record<PerformanceRating, string> = {
    GOOD: 'Good',
    CAUTION: 'Caution',
    BAD: 'Bad',
  };
  return displayNames[rating] || rating;
}

export function getLifecycleStateDisplayName(state: SupplierLifecycleState | null | undefined): string {
  if (!state) return 'Unknown';
  const displayNames: Record<SupplierLifecycleState, string> = {
    DRAFT: 'Draft',
    AWAITING_APPROVAL: 'Awaiting Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    IN_REVIEW: 'In Review',
    EXIT_IN_PROGRESS: 'Exit In Progress',
  };
  return displayNames[state] || state;
}

// Primary contact interface
export interface SupplierContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
}

// Exit Plan Section interfaces
export interface ImpactAssessment {
  notes?: string;
  scopeOfServices?: string;
  dependencies?: string[];
  stakeholders?: string[];
  completed?: boolean;
}

export interface DataAndIpr {
  notes?: string;
  dataInventory?: string;
  exportDetails?: string;
  integrityValidation?: string;
  iprTransfer?: string;
  deletionConfirmation?: string;
  completed?: boolean;
}

export interface ReplacementServiceAnalysis {
  notes?: string;
  alternativeProviders?: string[];
  securityComplianceChecks?: string;
  pocNotes?: string;
  tcoAnalysis?: string;
  completed?: boolean;
}

export interface ContractClosure {
  notes?: string;
  obligationsMet?: string[];
  handoverDocs?: string[];
  ticketClosure?: string[];
  serviceCessationEvidence?: string[];
  completed?: boolean;
}

export interface LessonsLearned {
  notes?: string;
  findings?: string[];
  completed?: boolean;
}

// Exit Plan interface
export interface SupplierExitPlan {
  id: string;
  supplierId: string;
  impactAssessment: ImpactAssessment | null;
  dataAndIpr: DataAndIpr | null;
  replacementServiceAnalysis: ReplacementServiceAnalysis | null;
  contractClosure: ContractClosure | null;
  lessonsLearned: LessonsLearned | null;
  createdAt: string;
  updatedAt: string;
}

// Supplier interface matching the backend model
export interface Supplier {
  id: string;
  name: string;
  tradingName: string | null;
  status: SupplierStatus;
  supplierType: SupplierType;
  serviceSubType: ServiceSubType | null;
  serviceDescription: string | null;
  processesCardholderData: boolean;
  processesPersonalData: boolean;
  hostingRegions: string[] | null;
  customerFacingImpact: boolean;
  overallRiskRating: RiskRating | null;
  criticality: Criticality | null;
  riskRationale: string | null;
  criticalityRationale: string | null;
  pciStatus: PciStatus | null;
  iso27001Status: IsoStatus | null;
  iso22301Status: IsoStatus | null;
  iso9001Status: IsoStatus | null;
  gdprStatus: GdprStatus | null;
  complianceEvidenceLinks: string[] | null;
  relationshipOwnerUserId: string | null;
  relationshipOwner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  primaryContacts: SupplierContact[] | null;
  contractReferences: string[] | null;
  dataProcessingAgreementRef: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  autoRenewal: boolean;
  performanceRating: PerformanceRating | null;
  performanceNotes: string | null;
  lifecycleState: SupplierLifecycleState;
  cisoExemptionGranted: boolean;
  reviewDate: string | null;
  supplierRisks?: Array<{
    risk: {
      id: string;
      title: string;
      calculatedScore: number;
      status: string;
      riskCategory: string | null;
    };
  }>;
  supplierControls?: Array<{
    control: {
      id: string;
      code: string;
      title: string;
      implemented: boolean;
      category: string | null;
    };
  }>;
  // certificates?: SupplierCertificate[]; // TODO: SupplierCertificate type not yet defined
  exitPlan?: SupplierExitPlan | null;
  showInTrustCenter: boolean;
  trustCenterDisplayName: string | null;
  trustCenterDescription: string | null;
  trustCenterCategory: TrustCenterCategory | null;
  trustCenterComplianceSummary: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

