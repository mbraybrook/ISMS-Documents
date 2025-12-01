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

