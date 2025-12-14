/* eslint-disable @typescript-eslint/no-explicit-any */
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
    console.error('Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors.array(),
      details: errors.array().map((e: any) => `${e.param}: ${e.msg}`).join(', ')
    });
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
          createdAt: true,
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

      // Store variables for later use
      const isPdf = false; // We'll determine this after cache check or download
      const needsWatermark = isPrivate && externalUser;

      // Check cache FIRST (before downloading from SharePoint)
      // Always check for unwatermarked PDF - we'll apply watermark after retrieval if needed
      const cachedResult = await getCachedPdf(
        document.id,
        document.version,
        document.updatedAt,
        false, // Always cache without watermark
        undefined // No user email in cache key
      );

      let finalBuffer: Buffer;
      let finalFilename: string;
      let finalMimeType: string;
      let originalFilename: string;

      if (cachedResult) {
        // Cache HIT - use cached unwatermarked PDF
        finalBuffer = cachedResult.buffer;
        originalFilename = cachedResult.originalFilename;
        finalFilename = getPdfFilename(originalFilename);
        finalMimeType = 'application/pdf';
        console.log('[TRUST] Cache HIT - using cached unwatermarked PDF:', {
          docId,
          version: document.version,
          size: finalBuffer.length,
          originalFilename,
          finalFilename,
          needsWatermark,
          skippedSharePointDownload: true,
        });
      } else {
        // Cache MISS - download from SharePoint and process
        console.log('[TRUST] Cache MISS - downloading from SharePoint');

        // Download file from SharePoint
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

        finalBuffer = fileData.buffer;
        finalFilename = fileData.name;
        finalMimeType = fileData.mimeType;
        const isPdfFile = fileData.mimeType === 'application/pdf' || fileData.name.toLowerCase().endsWith('.pdf');
        originalFilename = fileData.name;

        // Convert non-PDF files to PDF
        if (!isPdfFile && canConvertToPdf(fileData.mimeType, fileData.name)) {
          try {
            console.log('[TRUST] Converting document to PDF:', {
              originalType: fileData.mimeType,
              originalName: fileData.name,
            });
            finalBuffer = await convertToPdf(fileData.buffer, fileData.mimeType, fileData.name);
            finalFilename = getPdfFilename(originalFilename);
            finalMimeType = 'application/pdf';
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
        } else if (!isPdfFile) {
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

        // Cache the unwatermarked PDF for future requests
        // Always cache without watermark - we'll apply watermark on-the-fly when serving
        await setCachedPdf(
          document.id,
          document.version,
          document.updatedAt,
          finalBuffer, // Unwatermarked PDF
          fileData.mimeType,
          originalFilename,
          false, // Always cache as unwatermarked
          undefined // No user email in cache
        );
      }

      // Apply watermark AFTER cache retrieval (if needed for private documents)
      // This ensures cached files are unwatermarked and watermarks are applied per-user
      if (needsWatermark) {
        try {
          const originalSize = finalBuffer.length;
          const originalBufferHash = crypto.createHash('sha256').update(finalBuffer).digest('hex').substring(0, 16);
          
          console.log('[TRUST] Applying watermark to PDF:', {
            docId,
            userEmail: externalUser.email,
            originalPdfSize: originalSize,
            originalBufferHash,
          });
          
          const validation = validatePdfForWatermarking(finalBuffer);
          if (validation.valid) {
            const watermarkedBuffer = await addWatermarkToPdf(
              finalBuffer,
              externalUser.email,
              new Date(), // Download date
              trustSetting.maxFileSizeMB || config.trustCenter.maxFileSizeMB,
              document.createdAt // Document issue/creation date
            );
            
            const watermarkedBufferHash = crypto.createHash('sha256').update(watermarkedBuffer).digest('hex').substring(0, 16);
            const buffersAreEqual = originalBufferHash === watermarkedBufferHash;
            
            console.log('[TRUST] Watermark process completed:', {
              originalSize,
              watermarkedSize: watermarkedBuffer.length,
              sizeIncrease: watermarkedBuffer.length - originalSize,
              originalBufferHash,
              watermarkedBufferHash,
              buffersAreEqual: buffersAreEqual ? 'WARNING: Buffers are identical!' : 'OK: Buffers differ',
            });
            
            // Only update finalBuffer if it actually changed
            if (!buffersAreEqual) {
              finalBuffer = watermarkedBuffer;
              console.log('[TRUST] Watermark applied successfully - using watermarked buffer');
            } else {
              console.warn('[TRUST] WARNING: Watermark function returned identical buffer - watermark may not have been applied!');
            }
          } else {
            console.warn('[TRUST] PDF validation failed, cannot apply watermark:', validation.reason);
          }
        } catch (error: any) {
          console.error('[TRUST] Watermarking failed:', {
            error: error.message,
            stack: error.stack,
          });
          // Continue with unwatermarked PDF - log error but don't fail the request
        }
      } else {
        console.log('[TRUST] No watermark needed (public document or no external user)');
      }

      // Ensure filename is set correctly - always use original filename with PDF extension
      // This preserves the original filename from SharePoint
      finalFilename = getPdfFilename(originalFilename);

      // Log file type for debugging
      console.log('[TRUST] Download:', {
        docId,
        originalFilename: originalFilename,
        finalFilename,
        finalMimeType,
        size: finalBuffer.length,
        isPrivate,
        hasExternalUser: !!externalUser,
        watermarkApplied: needsWatermark && finalBuffer.length > 0, // Approximate check
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
      // Get internal user from database to get the ID
      const internalUserApproval = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

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
        internalUserApproval?.id,
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
      // Get internal user from database to get the ID
      const internalUserDenial = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

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
        internalUserDenial?.id,
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

// GET /api/trust/admin/users
router.get(
  '/admin/users',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    query('status').optional().isIn(['pending', 'approved', 'all']),
    query('active').optional().isBoolean(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const status = (req.query.status as string) || 'all';
      const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

      const where: any = {};

      // Filter by approval status
      if (status === 'pending') {
        where.isApproved = false;
      } else if (status === 'approved') {
        where.isApproved = true;
      }
      // 'all' means no filter

      // Filter by active status
      if (active !== undefined) {
        where.isActive = active;
      }

      // Search by email or company name
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const users = await prisma.externalUser.findMany({
        where,
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      });

      res.json(users);
    } catch (error: any) {
      console.error('[TRUST] Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// GET /api/trust/admin/users/:userId
router.get(
  '/admin/users/:userId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('userId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await prisma.externalUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          termsAcceptedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get last login date from audit logs
      const lastLoginLog = await prisma.trustAuditLog.findFirst({
        where: {
          performedByExternalUserId: userId,
          action: 'LOGIN_SUCCESS',
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          timestamp: true,
        },
      });

      // Get total downloads count
      const totalDownloads = await prisma.trustDownload.count({
        where: {
          externalUserId: userId,
        },
      });

      // Get approval date and approver from audit logs
      const approvalLog = await prisma.trustAuditLog.findFirst({
        where: {
          targetUserId: userId,
          action: 'USER_APPROVED',
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          timestamp: true,
          performedByUserId: true,
        },
      });

      let approvedBy: string | null = null;
      if (approvalLog?.performedByUserId) {
        const approver = await prisma.user.findUnique({
          where: { id: approvalLog.performedByUserId },
          select: { email: true },
        });
        approvedBy = approver?.email || null;
      }

      res.json({
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        isApproved: user.isApproved,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() || null,
        lastLoginDate: lastLoginLog?.timestamp.toISOString() || null,
        totalDownloads,
        approvalDate: approvalLog?.timestamp.toISOString() || null,
        approvedBy,
      });
    } catch (error: any) {
      console.error('[TRUST] Error fetching user details:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  }
);

// PUT /api/trust/admin/users/:userId/revoke
router.put(
  '/admin/users/:userId/revoke',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('userId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      // Get internal user from database to get the ID
      const internalUser = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

      const user = await prisma.externalUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          companyName: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user to set isActive = false and increment tokenVersion
      const updatedUser = await prisma.externalUser.update({
        where: { id: userId },
        data: {
          isActive: false,
          tokenVersion: user.tokenVersion + 1, // Invalidate existing tokens
        },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Log revocation
      await logTrustAction(
        'USER_ACCESS_REVOKED',
        internalUser?.id,
        undefined,
        userId,
        undefined,
        { email: user.email, companyName: user.companyName },
        getIpAddress(req)
      );

      res.json(updatedUser);
    } catch (error: any) {
      console.error('[TRUST] Error revoking user access:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to revoke user access' });
    }
  }
);

// PUT /api/trust/admin/users/:userId/restore
router.put(
  '/admin/users/:userId/restore',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('userId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      // Get internal user from database to get the ID
      const internalUser = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

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

      // Update user to set isActive = true
      const updatedUser = await prisma.externalUser.update({
        where: { id: userId },
        data: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Log restoration
      await logTrustAction(
        'USER_ACCESS_RESTORED',
        internalUser?.id,
        undefined,
        userId,
        undefined,
        { email: user.email, companyName: user.companyName },
        getIpAddress(req)
      );

      res.json(updatedUser);
    } catch (error: any) {
      console.error('[TRUST] Error restoring user access:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to restore user access' });
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
    body('sharePointUrl').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return typeof value === 'string';
    }),
    body('publicDescription').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return typeof value === 'string';
    }),
    body('displayOrder').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = Number(value);
      return Number.isInteger(num) && num >= 0;
    }),
    body('requiresNda').optional().isBoolean(),
    body('maxFileSizeMB').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = Number(value);
      return Number.isInteger(num) && num >= 0;
    }),
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
      // Get internal user from database to get the ID
      const internalUserForLog = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

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
      if (sharePointUrl !== undefined) updateData.sharePointUrl = sharePointUrl || null;
      if (sharePointSiteId !== undefined) updateData.sharePointSiteId = sharePointSiteId;
      if (sharePointDriveId !== undefined) updateData.sharePointDriveId = sharePointDriveId;
      if (sharePointItemId !== undefined) updateData.sharePointItemId = sharePointItemId;
      // Normalize empty strings to null for publicDescription
      if (publicDescription !== undefined) updateData.publicDescription = publicDescription === '' ? null : publicDescription;
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
        internalUserForLog?.id,
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
      // Get internal user from database to get the ID
      const internalUserDelete = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

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
          internalUserDelete?.id,
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

// GET /api/trust/admin/settings
router.get(
  '/admin/settings',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get or create global settings (singleton pattern)
      let settings = await prisma.trustCenterSettings.findUnique({
        where: { key: 'global' },
      });

      if (!settings) {
        // Create default settings
        settings = await prisma.trustCenterSettings.create({
          data: {
            key: 'global',
            watermarkPrefix: 'Paythru Confidential',
          },
        });
      }

      res.json({
        watermarkPrefix: settings.watermarkPrefix,
      });
    } catch (error: any) {
      console.error('[TRUST] Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }
);

// PUT /api/trust/admin/settings
router.put(
  '/admin/settings',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('watermarkPrefix').optional().isString().isLength({ min: 1, max: 100 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { watermarkPrefix } = req.body;
      // Get internal user from database to get the ID
      const internalUserSettings = req.user?.email ? await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      }) : null;

      // Get or create global settings
      let settings = await prisma.trustCenterSettings.findUnique({
        where: { key: 'global' },
      });

      if (settings) {
        // Update existing settings
        settings = await prisma.trustCenterSettings.update({
          where: { id: settings.id },
          data: {
            watermarkPrefix: watermarkPrefix || settings.watermarkPrefix,
          },
        });
      } else {
        // Create new settings
        settings = await prisma.trustCenterSettings.create({
          data: {
            key: 'global',
            watermarkPrefix: watermarkPrefix || 'Paythru Confidential',
          },
        });
      }

      // Log action
      await logTrustAction(
        'TRUST_SETTINGS_UPDATED',
        internalUserSettings?.id,
        undefined,
        undefined,
        undefined,
        {
          watermarkPrefix: settings.watermarkPrefix,
        },
        getIpAddress(req)
      );

      res.json({
        watermarkPrefix: settings.watermarkPrefix,
      });
    } catch (error: any) {
      console.error('[TRUST] Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

// GET /api/trust/suppliers - Get suppliers visible in Trust Center
router.get(
  '/suppliers',
  conditionalTrustAuth,
  async (req: Request, res: Response) => {
    try {
      // Only return suppliers that are marked for Trust Center display and are Active/Approved
      const suppliers = await prisma.supplier.findMany({
        where: {
          showInTrustCenter: true,
          status: 'ACTIVE',
          lifecycleState: 'APPROVED',
        },
        select: {
          id: true,
          trustCenterDisplayName: true,
          trustCenterDescription: true,
          trustCenterCategory: true,
          trustCenterComplianceSummary: true,
          // Exclude internal fields like risk ratings, performance rating, contacts, etc.
        },
        orderBy: [
          { trustCenterCategory: 'asc' },
          { trustCenterDisplayName: 'asc' },
        ],
      });

      // Filter out any suppliers without required display fields
      const validSuppliers = suppliers.filter(
        (s) => s.trustCenterDisplayName && s.trustCenterDescription
      );

      res.json({
        suppliers: validSuppliers.map((s) => ({
          id: s.id,
          displayName: s.trustCenterDisplayName,
          description: s.trustCenterDescription,
          category: s.trustCenterCategory || 'OTHER',
          complianceSummary: s.trustCenterComplianceSummary || null,
        })),
      });
    } catch (error: any) {
      console.error('[TRUST] Error fetching suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  }
);

export { router as trustRouter };

