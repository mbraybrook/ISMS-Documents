/**
 * Type definitions for enum-like values
 * Since SQLite doesn't support enums, we use string types with these type definitions
 * to maintain type safety in TypeScript
 */

export type UserRole = 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR';

export type DocumentType = 'POLICY' | 'PROCEDURE' | 'MANUAL' | 'RECORD' | 'TEMPLATE' | 'OTHER';

export type StorageLocation = 'SHAREPOINT' | 'CONFLUENCE';

export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUPERSEDED';

export type ReviewTaskStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE';

export type ApplicabilitySource = 'AUTO_FROM_RISK' | 'MANUAL_OVERRIDE';

export type SoAExportFormat = 'EXCEL' | 'PDF';

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

export type SupplierStatus = 'ACTIVE' | 'IN_ONBOARDING' | 'IN_EXIT' | 'INACTIVE';
export type SupplierType = 'SERVICE_PROVIDER' | 'CONNECTED_ENTITY' | 'PCI_SERVICE_PROVIDER';
export type ServiceSubType = 'CLOUD_VENDOR' | 'SAAS' | 'OTHER';
export type CiaImpact = 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH';
export type Criticality = 'LOW' | 'MEDIUM' | 'HIGH';
export type PciStatus = 'UNKNOWN' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type IsoStatus = 'UNKNOWN' | 'CERTIFIED' | 'NOT_CERTIFIED' | 'IN_PROGRESS';
export type GdprStatus = 'UNKNOWN' | 'ADEQUATE' | 'HIGH_RISK' | 'NOT_APPLICABLE';
export type PerformanceRating = 'GOOD' | 'CAUTION' | 'BAD';
export type AssessmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type SupplierLifecycleState = 'DRAFT' | 'IN_ASSESSMENT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_REVIEW' | 'EXIT_IN_PROGRESS';
export type ReviewType = 'SCHEDULED' | 'TRIGGERED_BY_INCIDENT' | 'TRIGGERED_BY_CHANGE';
export type ReviewOutcome = 'PASS' | 'ISSUES_FOUND' | 'FAIL';
export type CertificateType = 'PCI' | 'ISO27001' | 'ISO22301' | 'ISO9001' | 'GDPR' | 'OTHER';
export type ExitPlanStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TrustCenterCategory = 'HOSTING' | 'PAYMENTS' | 'COMMUNICATIONS' | 'SECURITY' | 'OTHER';

