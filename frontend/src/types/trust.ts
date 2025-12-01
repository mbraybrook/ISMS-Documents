export interface ExternalUser {
  id: string;
  email: string;
  companyName: string;
  isApproved: boolean;
  termsAcceptedAt?: string | null;
  createdAt?: string;
}

export interface TrustDocSetting {
  id: string;
  documentId: string;
  visibilityLevel: 'public' | 'private';
  category: 'certification' | 'policy' | 'report';
  sharePointUrl?: string | null;
  sharePointSiteId?: string | null;
  sharePointDriveId?: string | null;
  sharePointItemId?: string | null;
  publicDescription?: string | null;
  displayOrder?: number | null;
  requiresNda: boolean;
  maxFileSizeMB?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustDownload {
  id: string;
  externalUserId: string | null;
  docId: string;
  downloadToken?: string | null;
  termsAccepted: boolean;
  timestamp: string;
}

export interface TrustDocument {
  id: string;
  title: string;
  type: string;
  version: string;
  status: string;
  category: 'certification' | 'policy' | 'report';
  visibilityLevel?: 'public' | 'private';
  publicDescription?: string | null;
  displayOrder?: number | null;
  requiresNda?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrustCategoryGroup {
  category: string;
  documents: TrustDocument[];
}

export type TrustCategory = 'certification' | 'policy' | 'report';

export interface TrustAuditLog {
  id: string;
  action: string;
  performedByUserId?: string | null;
  performedByExternalUserId?: string | null;
  targetUserId?: string | null;
  targetDocumentId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  timestamp: string;
}

