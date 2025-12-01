import { Router, Response, NextFunction } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { authenticateTrustToken, TrustAuthRequest } from '../../middleware/trustAuth';
import { requireRole } from '../../middleware/authorize';
import { downloadLimiter } from '../../middleware/rateLimit';
import {
  getAppOnlyAccessToken,
  downloadSharePointFile,
  parseSharePointUrlToIds,
  verifySharePointFileAccess,
  FileNotFoundError,
  FileTooLargeError,
  PermissionDeniedError,
} from '../../services/sharePointService';
import { addWatermarkToPdf, validatePdfForWatermarking } from '../../services/watermarkService';
import { logTrustAction } from '../../services/trustAuditService';
import { convertToPdf, canConvertToPdf, getPdfFilename } from '../../services/documentConversionService';
import { getCachedPdf, setCachedPdf } from '../../services/pdfCacheService';
import crypto from 'crypto';

const router = Router();

// Helper to get IP address from request
const getIpAddress = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Helper to get SharePoint IDs from TrustDocSetting or parse from URL
const getSharePointIds = async (trustSetting: any): Promise<{
  siteId: string;
  driveId: string;
  itemId: string;
} | null> => {
  // If IDs are cached, use them
  if (trustSetting.sharePointSiteId && trustSetting.sharePointDriveId && trustSetting.sharePointItemId) {
    return {
      siteId: trustSetting.sharePointSiteId,
      driveId: trustSetting.sharePointDriveId,
      itemId: trustSetting.sharePointItemId,
    };
  }

  // If we have a URL, parse it
  if (trustSetting.sharePointUrl) {
    const parsed = await parseSharePointUrlToIds(trustSetting.sharePointUrl);
    if (parsed) {
      // Cache the parsed IDs
      await prisma.trustDocSetting.update({
        where: { id: trustSetting.id },
        data: {
          sharePointSiteId: parsed.siteId,
          sharePointDriveId: parsed.driveId,
          sharePointItemId: parsed.itemId,
        },
      });
      return parsed;
    }
  }

  return null;
};

// Validation helper
const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Conditional trust auth middleware - only authenticates if token is present
const conditionalTrustAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Token present, use full authentication
    return authenticateTrustToken(req as TrustAuthRequest, res, next);
  }
  // No token, continue without authentication (for public access)
  next();
};

// GET /api/trust/documents - All documents (public + private if authenticated)
router.get('/documents', conditionalTrustAuth, async (req: Request, res: Response) => {
  try {
    const externalUser = (req as TrustAuthRequest).externalUser;
    const isAuthenticated = !!externalUser && externalUser.isApproved;

    // Get public documents
    const publicDocs = await prisma.trustDocSetting.findMany({
      where: {
        visibilityLevel: 'public',
      },
      include: {
        Document: {
          select: {
            id: true,
            title: true,
            type: true,
            version: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Get private documents if authenticated
    let privateDocs: any[] = [];
    if (isAuthenticated) {
      const privateDocsQuery = await prisma.trustDocSetting.findMany({
        where: {
          visibilityLevel: 'private',
        },
        include: {
          Document: {
            select: {
              id: true,
              title: true,
              type: true,
              version: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { category: 'asc' },
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      });

      // Filter documents that require NDA if user hasn't accepted terms
      privateDocs = privateDocsQuery.filter((item: any) => {
        if (item.requiresNda && !externalUser.termsAcceptedAt) {
          return false; // Hide documents requiring NDA if terms not accepted
        }
        return true;
      });
    }

    // Combine and group by category
    const allDocuments = [
      ...publicDocs.map((item: any) => ({ ...item, visibilityLevel: 'public' })),
      ...privateDocs.map((item: any) => ({ ...item, visibilityLevel: 'private' })),
    ];

    const grouped = allDocuments
      .filter((item: any) => item.Document !== null) // Filter out orphaned TrustDocSettings
      .reduce((acc: any, item: any) => {
        const category = item.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          id: item.Document.id,
          title: item.Document.title,
          type: item.Document.type,
          version: item.Document.version,
          status: item.Document.status,
          category: item.category,
          visibilityLevel: item.visibilityLevel,
          publicDescription: item.publicDescription,
          displayOrder: item.displayOrder,
          requiresNda: item.requiresNda,
          createdAt: item.Document.createdAt,
          updatedAt: item.Document.updatedAt,
        });
        return acc;
      }, {});

    // Convert to array format
    const result = Object.keys(grouped).map((category) => ({
      category,
      documents: grouped[category],
    }));

    res.json(result);
  } catch (error: any) {
    console.error('[TRUST] Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/trust/documents/private - Private documents (requires auth)
router.get('/documents/private', authenticateTrustToken, async (req: TrustAuthRequest, res: Response) => {
  try {
    const user = req.externalUser;
    if (!user || !user.isApproved) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const documents = await prisma.trustDocSetting.findMany({
      where: {
        visibilityLevel: 'private',
      },
      include: {
        Document: {
          select: {
            id: true,
            title: true,
            type: true,
            version: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Filter documents that require NDA if user hasn't accepted terms
    const filteredDocuments = documents.filter((item: any) => {
      if (item.requiresNda && !user.termsAcceptedAt) {
        return false; // Hide documents requiring NDA if terms not accepted
      }
      return true;
    });

    // Group by category (filter out documents with missing Document relation)
    const grouped = filteredDocuments
      .filter((item: any) => item.Document !== null) // Filter out orphaned TrustDocSettings
      .reduce((acc: any, item: any) => {
        const category = item.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          id: item.Document.id,
          title: item.Document.title,
          type: item.Document.type,
          version: item.Document.version,
          status: item.Document.status,
          category: item.category,
          publicDescription: item.publicDescription,
          displayOrder: item.displayOrder,
          requiresNda: item.requiresNda,
          createdAt: item.Document.createdAt,
          updatedAt: item.Document.updatedAt,
        });
        return acc;
      }, {});

    // Convert to array format
    const result = Object.keys(grouped).map((category) => ({
      category,
      documents: grouped[category],
    }));

    res.json(result);
  } catch (error: any) {
    console.error('[TRUST] Error fetching private documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/trust/download/:docId - Download document
router.get(
  '/download/:docId',
  downloadLimiter,
  [param('docId').isString().notEmpty()],
  validate,
  conditionalTrustAuth,
  async (req: Request, res: Response) => {
    try {
      const { docId } = req.params;
      const downloadToken = req.query.token as string | undefined;

      // Get document and trust settings
      const document = await prisma.document.findUnique({
        where: { id: docId },
        select: {
          id: true,
          title: true,
          version: true,
          updatedAt: true,
          sharePointSiteId: true,
          sharePointDriveId: true,
          sharePointItemId: true,
          TrustDocSetting: true,
        },
      });

      if (!document || !document.TrustDocSetting) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const trustSetting = document.TrustDocSetting;
      const isPublic = trustSetting.visibilityLevel === 'public';
      const isPrivate = trustSetting.visibilityLevel === 'private';

      // For private documents, require authentication
      const externalUser = (req as TrustAuthRequest).externalUser;
      if (isPrivate) {
        if (!externalUser || !externalUser.isApproved) {
          return res.status(401).json({ error: 'Authentication required for private documents' });
        }

        // Check NDA requirement
        if (trustSetting.requiresNda && !externalUser.termsAcceptedAt) {
          return res.status(403).json({
            error: 'Terms acceptance required',
            requiresTerms: true,
          });
        }
      }

      // Get SharePoint IDs
      const spIds = await getSharePointIds(trustSetting);
      if (!spIds) {
        return res.status(400).json({ error: 'SharePoint file information not available' });
      }

      // Get access token (app-only for external users, delegated for internal)
      let accessToken: string | null = null;
      if (externalUser) {
        // External user - use app-only auth
        accessToken = await getAppOnlyAccessToken();
      } else {
        // Public access or internal user - try to get delegated token from header
        const graphToken = req.headers['x-graph-token'] as string;
        if (graphToken) {
          accessToken = graphToken;
        } else {
          // Fall back to app-only for public documents
          accessToken = await getAppOnlyAccessToken();
        }
      }

      if (!accessToken) {
        return res.status(500).json({ error: 'Failed to obtain access token' });
      }

      // Download file
      let fileData: { buffer: Buffer; mimeType: string; name: string; size: number };
      try {
        fileData = await downloadSharePointFile(
          accessToken,
          spIds.siteId,
          spIds.driveId,
          spIds.itemId,
          trustSetting.maxFileSizeMB || config.trustCenter.maxFileSizeMB
        );
      } catch (error: any) {
        if (error instanceof FileNotFoundError) {
          return res.status(404).json({ error: 'File not found in SharePoint' });
        }
        if (error instanceof FileTooLargeError) {
          return res.status(413).json({ error: error.message });
        }
        if (error instanceof PermissionDeniedError) {
          return res.status(403).json({ error: 'Permission denied to access file' });
        }
        throw error;
      }

      let finalBuffer = fileData.buffer;
      let finalFilename = fileData.name;
      let finalMimeType = fileData.mimeType;
      const isPdf = fileData.mimeType === 'application/pdf' || fileData.name.toLowerCase().endsWith('.pdf');
      const needsWatermark = isPrivate && externalUser;
      const watermarkUserEmail = needsWatermark ? externalUser.email : undefined;

      // Store original filename before any processing
      let originalFilename = fileData.name;
      
      // Check cache first (for converted PDFs or watermarked PDFs)
      const cachedResult = await getCachedPdf(
        document.id,
        document.version,
        document.updatedAt,
        needsWatermark,
        watermarkUserEmail
      );

      if (cachedResult) {
        // Use cached PDF
        finalBuffer = cachedResult.buffer;
        // Use original filename from cache metadata
        originalFilename = cachedResult.originalFilename;
        // Set final filename immediately from cached original
        finalFilename = getPdfFilename(originalFilename);
        finalMimeType = 'application/pdf';
        console.log('[TRUST] Using cached PDF:', {
          docId,
          version: document.version,
          size: finalBuffer.length,
          originalFilename,
          finalFilename,
        });
      } else {
        // Not in cache, need to process
        const wasOriginalPdf = isPdf;
        let wasConverted = false;
        let wasWatermarked = false;

        // Convert non-PDF files to PDF
        if (!isPdf && canConvertToPdf(fileData.mimeType, fileData.name)) {
          try {
            console.log('[TRUST] Converting document to PDF:', {
              originalType: fileData.mimeType,
              originalName: fileData.name,
            });
            finalBuffer = await convertToPdf(fileData.buffer, fileData.mimeType, fileData.name);
            // Update finalFilename to use PDF extension
            finalFilename = getPdfFilename(originalFilename);
            finalMimeType = 'application/pdf';
            wasConverted = true;
            console.log('[TRUST] Conversion successful:', {
              pdfFilename: finalFilename,
              pdfSize: finalBuffer.length,
            });
          } catch (error: any) {
            console.error('[TRUST] PDF conversion failed:', error);
            return res.status(500).json({
              error: 'Failed to convert document to PDF',
              details: error.message,
            });
          }
        } else if (!isPdf) {
          // File type cannot be converted
          console.warn('[TRUST] Unsupported file type for conversion:', {
            mimeType: fileData.mimeType,
            filename: fileData.name,
          });
          return res.status(400).json({
            error: 'File type not supported. Only PDF and Office documents can be served.',
          });
        } else {
          // File is already PDF - ensure filename has .pdf extension
          finalFilename = getPdfFilename(originalFilename);
        }

        // Apply watermark for private documents (now all files are PDF)
        if (needsWatermark) {
          try {
            const validation = validatePdfForWatermarking(finalBuffer);
            if (validation.valid) {
              finalBuffer = await addWatermarkToPdf(
                finalBuffer,
                externalUser.email,
                new Date(),
                trustSetting.maxFileSizeMB || config.trustCenter.maxFileSizeMB
              );
              wasWatermarked = true;
            } else {
              console.warn('[TRUST] PDF validation failed, using original:', validation.reason);
            }
          } catch (error: any) {
            console.error('[TRUST] Watermarking failed, using original PDF:', error);
            // Continue with original PDF
          }
        }

        // Cache the final PDF (if it was converted, watermarked, or is a non-original PDF)
        // Always cache to speed up future downloads
        await setCachedPdf(
          document.id,
          document.version,
          document.updatedAt,
          finalBuffer,
          fileData.mimeType,
          originalFilename,
          needsWatermark,
          watermarkUserEmail
        );
      }

      // Ensure filename is set correctly - always use original filename with PDF extension
      // This preserves the original filename from SharePoint
      finalFilename = getPdfFilename(originalFilename);

      // Log file type for debugging
      console.log('[TRUST] Download:', {
        docId,
        originalFilename: originalFilename,
        originalMimeType: fileData.mimeType,
        finalFilename,
        finalMimeType,
        size: finalBuffer.length,
        wasConverted: !isPdf,
        isWatermarked: isPrivate && externalUser,
      });

      // Encode filename for Content-Disposition header (RFC 5987)
      const encodedFilename = encodeURIComponent(finalFilename);
      const safeFilename = finalFilename.replace(/[^\x20-\x7E]/g, '_'); // Replace non-ASCII with underscore

      // Log the filename being sent
      console.log('[TRUST] Setting download filename:', {
        originalFilename,
        finalFilename,
        safeFilename,
        encodedFilename,
      });

      // Set headers BEFORE any async operations that might fail
      res.setHeader('Content-Type', finalMimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Length', finalBuffer.length.toString());
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Record download in background (don't await - don't block download)
      prisma.trustDownload.create({
        data: {
          externalUserId: externalUser?.id || null,
          docId: docId,
          downloadToken: downloadToken || null,
          termsAccepted: trustSetting.requiresNda ? !!externalUser?.termsAcceptedAt : false,
        },
      }).catch((err) => {
        console.error('[TRUST] Error recording download:', err);
      });

      // Log download in background (don't await - don't block download)
      logTrustAction(
        'DOWNLOAD',
        undefined,
        externalUser?.id,
        undefined,
        docId,
        {
          documentTitle: document.title,
          isPublic,
          isWatermarked: isPrivate && externalUser && isPdf,
        },
        getIpAddress(req)
      ).catch((err) => {
        console.error('[TRUST] Error logging download:', err);
      });

      // Send file as binary data
      // res.send() with a Buffer automatically sends as binary (no encoding)
      res.send(finalBuffer);
    } catch (error: any) {
      console.error('[TRUST] Download error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
);

// POST /api/trust/accept-terms
router.post(
  '/accept-terms',
  authenticateTrustToken,
  [body('documentId').optional().isString()],
  validate,
  async (req: TrustAuthRequest, res: Response) => {
    try {
      const user = req.externalUser;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { documentId } = req.body;

      // Update user's terms acceptance
      await prisma.externalUser.update({
        where: { id: user.id },
        data: {
          termsAcceptedAt: new Date(),
        },
      });

      // Log acceptance
      await logTrustAction(
        'TERMS_ACCEPTED',
        undefined,
        user.id,
        undefined,
        documentId || undefined,
        { email: user.email },
        getIpAddress(req)
      );

      res.json({ message: 'Terms accepted successfully' });
    } catch (error: any) {
      console.error('[TRUST] Accept terms error:', error);
      res.status(500).json({ error: 'Failed to accept terms' });
    }
  }
);

// Admin routes - require internal staff authentication
// GET /api/trust/admin/pending-requests
router.get(
  '/admin/pending-requests',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const users = await prisma.externalUser.findMany({
        where: {
          isApproved: false,
        },
        select: {
          id: true,
          email: true,
          companyName: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(users);
    } catch (error: any) {
      console.error('[TRUST] Error fetching pending requests:', error);
      res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
  }
);

// POST /api/trust/admin/approve-user/:userId
router.post(
  '/admin/approve-user/:userId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('userId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const internalUser = req.user;

      const user = await prisma.externalUser.update({
        where: { id: userId },
        data: {
          isApproved: true,
        },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
        },
      });

      // Log approval
      await logTrustAction(
        'USER_APPROVED',
        internalUser?.id,
        undefined,
        userId,
        undefined,
        { email: user.email, companyName: user.companyName },
        getIpAddress(req)
      );

      // TODO: Send approval email

      res.json(user);
    } catch (error: any) {
      console.error('[TRUST] Error approving user:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to approve user' });
    }
  }
);

// POST /api/trust/admin/deny-user/:userId
router.post(
  '/admin/deny-user/:userId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('userId').isString().notEmpty(), body('reason').optional().isString()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const internalUser = req.user;

      // Get user info before deletion
      const user = await prisma.externalUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          companyName: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Soft delete (or hard delete - adjust as needed)
      await prisma.externalUser.delete({
        where: { id: userId },
      });

      // Log denial
      await logTrustAction(
        'USER_DENIED',
        internalUser?.id,
        undefined,
        userId,
        undefined,
        { email: user.email, companyName: user.companyName, reason: reason || 'No reason provided' },
        getIpAddress(req)
      );

      // TODO: Send denial email with reason

      res.json({ message: 'User denied successfully' });
    } catch (error: any) {
      console.error('[TRUST] Error denying user:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to deny user' });
    }
  }
);

// GET /api/trust/admin/documents
router.get(
  '/admin/documents',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const documents = await prisma.document.findMany({
        include: {
          TrustDocSetting: true,
        },
        orderBy: {
          title: 'asc',
        },
      });

      const result = documents.map((doc) => ({
        document: {
          id: doc.id,
          title: doc.title,
          type: doc.type,
          version: doc.version,
          status: doc.status,
          sharePointSiteId: doc.sharePointSiteId,
          sharePointDriveId: doc.sharePointDriveId,
          sharePointItemId: doc.sharePointItemId,
        },
        trustSetting: doc.TrustDocSetting
          ? {
              id: doc.TrustDocSetting.id,
              visibilityLevel: doc.TrustDocSetting.visibilityLevel,
              category: doc.TrustDocSetting.category,
              sharePointUrl: doc.TrustDocSetting.sharePointUrl,
              publicDescription: doc.TrustDocSetting.publicDescription,
              displayOrder: doc.TrustDocSetting.displayOrder,
              requiresNda: doc.TrustDocSetting.requiresNda,
              maxFileSizeMB: doc.TrustDocSetting.maxFileSizeMB,
            }
          : null,
      }));

      res.json(result);
    } catch (error: any) {
      console.error('[TRUST] Error fetching admin documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }
);

// PUT /api/trust/admin/documents/:docId/settings
router.put(
  '/admin/documents/:docId/settings',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('docId').isString().notEmpty(),
    body('visibilityLevel').optional().isIn(['public', 'private']),
    body('category').optional().isIn(['certification', 'policy', 'report']),
    body('sharePointUrl').optional().isString(),
    body('publicDescription').optional().isString(),
    body('displayOrder').optional().isInt(),
    body('requiresNda').optional().isBoolean(),
    body('maxFileSizeMB').optional().isInt(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { docId } = req.params;
      const {
        visibilityLevel,
        category,
        sharePointUrl,
        publicDescription,
        displayOrder,
        requiresNda,
        maxFileSizeMB,
      } = req.body;
      const internalUser = req.user;

      // Check if document exists
      const document = await prisma.document.findUnique({
        where: { id: docId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Parse SharePoint URL if provided
      let sharePointSiteId = null;
      let sharePointDriveId = null;
      let sharePointItemId = null;

      if (sharePointUrl) {
        const parsed = await parseSharePointUrlToIds(sharePointUrl);
        if (parsed) {
          sharePointSiteId = parsed.siteId;
          sharePointDriveId = parsed.driveId;
          sharePointItemId = parsed.itemId;

          // Verify file access
          const accessToken = await getAppOnlyAccessToken();
          if (accessToken) {
            const isAccessible = await verifySharePointFileAccess(
              accessToken,
              parsed.siteId,
              parsed.driveId,
              parsed.itemId
            );
            if (!isAccessible) {
              return res.status(400).json({ error: 'SharePoint file is not accessible' });
            }
          }
        } else {
          return res.status(400).json({ error: 'Invalid SharePoint URL' });
        }
      } else {
        // Use existing document SharePoint metadata
        sharePointSiteId = document.sharePointSiteId;
        sharePointDriveId = document.sharePointDriveId;
        sharePointItemId = document.sharePointItemId;
      }

      // Get existing setting or create new
      const existingSetting = await prisma.trustDocSetting.findUnique({
        where: { documentId: docId },
      });

      const updateData: any = {};
      if (visibilityLevel !== undefined) updateData.visibilityLevel = visibilityLevel;
      if (category !== undefined) updateData.category = category;
      if (sharePointUrl !== undefined) updateData.sharePointUrl = sharePointUrl;
      if (sharePointSiteId !== undefined) updateData.sharePointSiteId = sharePointSiteId;
      if (sharePointDriveId !== undefined) updateData.sharePointDriveId = sharePointDriveId;
      if (sharePointItemId !== undefined) updateData.sharePointItemId = sharePointItemId;
      if (publicDescription !== undefined) updateData.publicDescription = publicDescription;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      if (requiresNda !== undefined) updateData.requiresNda = requiresNda;
      if (maxFileSizeMB !== undefined) updateData.maxFileSizeMB = maxFileSizeMB;

      let trustSetting;
      if (existingSetting) {
        trustSetting = await prisma.trustDocSetting.update({
          where: { id: existingSetting.id },
          data: updateData,
        });
      } else {
        // Create new setting
        trustSetting = await prisma.trustDocSetting.create({
          data: {
            documentId: docId,
            visibilityLevel: visibilityLevel || 'public',
            category: category || 'policy',
            sharePointUrl: sharePointUrl || null,
            sharePointSiteId: sharePointSiteId,
            sharePointDriveId: sharePointDriveId,
            sharePointItemId: sharePointItemId,
            publicDescription: publicDescription || null,
            displayOrder: displayOrder || null,
            requiresNda: requiresNda || false,
            maxFileSizeMB: maxFileSizeMB || null,
          },
        });
      }

      // Log action
      const action = existingSetting ? 'DOC_SETTINGS_UPDATED' : 'DOC_SETTINGS_CREATED';
      await logTrustAction(
        action,
        internalUser?.id,
        undefined,
        undefined,
        docId,
        {
          visibilityLevel: trustSetting.visibilityLevel,
          category: trustSetting.category,
        },
        getIpAddress(req)
      );

      res.json(trustSetting);
    } catch (error: any) {
      console.error('[TRUST] Error updating document settings:', error);
      res.status(500).json({ error: 'Failed to update document settings' });
    }
  }
);

// DELETE /api/trust/admin/documents/:docId/settings
router.delete(
  '/admin/documents/:docId/settings',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('docId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { docId } = req.params;
      const internalUser = req.user;

      // Check if document exists
      const document = await prisma.document.findUnique({
        where: { id: docId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete TrustDocSetting if it exists
      const existingSetting = await prisma.trustDocSetting.findUnique({
        where: { documentId: docId },
      });

      if (existingSetting) {
        await prisma.trustDocSetting.delete({
          where: { id: existingSetting.id },
        });

        // Log deletion
        await logTrustAction(
          'DOCUMENT_REMOVED_FROM_TRUST_CENTER',
          internalUser?.id,
          undefined,
          undefined,
          docId,
          { documentTitle: document.title },
          getIpAddress(req)
        );
      }

      res.json({ message: 'Document removed from Trust Center' });
    } catch (error: any) {
      console.error('[TRUST] Error deleting document settings:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Setting not found' });
      }
      res.status(500).json({ error: 'Failed to delete document settings' });
    }
  }
);

// GET /api/trust/admin/audit-log
router.get(
  '/admin/audit-log',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    query('action').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { action, startDate, endDate, limit = 100 } = req.query;

      const where: any = {};
      if (action) where.action = action;
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) where.timestamp.lte = new Date(endDate as string);
      }

      const logs = await prisma.trustAuditLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: parseInt(limit as string, 10),
      });

      res.json(logs);
    } catch (error: any) {
      console.error('[TRUST] Error fetching audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);

export { router as trustRouter };

