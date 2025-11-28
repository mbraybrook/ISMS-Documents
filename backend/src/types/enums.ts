/**
 * Type definitions for enum-like values
 * Since SQLite doesn't support enums, we use string types with these type definitions
 * to maintain type safety in TypeScript
 */

export type UserRole = 'ADMIN' | 'EDITOR' | 'STAFF';

export type DocumentType = 'POLICY' | 'PROCEDURE' | 'MANUAL' | 'RECORD' | 'TEMPLATE' | 'OTHER';

export type StorageLocation = 'SHAREPOINT' | 'CONFLUENCE';

export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUPERSEDED';

export type ReviewTaskStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE';

export type ApplicabilitySource = 'AUTO_FROM_RISK' | 'MANUAL_OVERRIDE';

export type SoAExportFormat = 'EXCEL' | 'PDF';

