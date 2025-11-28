import { Router, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import {
  getSharePointItem,
  listSharePointItems,
  generateSharePointUrl,
  parseSharePointUrl,
  getDefaultDrive,
  listDrives,
  getSharePointSite,
} from '../services/sharePointService';
import { config } from '../config';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/sharepoint/items - list items in a drive
router.get(
  '/items',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    query('siteId').optional().isString(),
    query('driveId').optional().isString(),
    query('folderPath').optional().isString(),
    query('folderId').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessToken = req.headers['x-graph-token'] as string;

      if (!accessToken) {
        return res.status(400).json({
          error:
            'Access token required. Please provide x-graph-token header with Microsoft Graph access token.',
        });
      }

      // Use provided IDs or fall back to config defaults
      let siteId = (req.query.siteId as string) || config.sharePoint.siteId;
      let driveId = (req.query.driveId as string) || config.sharePoint.driveId;
      const folderPath = req.query.folderPath as string | undefined;
      const folderId = req.query.folderId as string | undefined;

      console.log('[SharePoint] Configuration check:', {
        siteIdFromQuery: req.query.siteId,
        siteIdFromConfig: config.sharePoint.siteId,
        siteIdUsed: siteId,
        driveIdFromQuery: req.query.driveId,
        driveIdFromConfig: config.sharePoint.driveId,
        driveIdUsed: driveId,
        siteIdEmpty: !siteId,
        driveIdEmpty: !driveId,
      });

      if (!siteId) {
        return res.status(400).json({
          error:
            'Site ID is required. Provide it as a query parameter or configure SHAREPOINT_SITE_ID in environment variables.',
          config: {
            siteIdConfigured: !!config.sharePoint.siteId,
            driveIdConfigured: !!config.sharePoint.driveId,
          },
        });
      }

      // If drive ID is not provided, try to get the default drive from the site
      if (!driveId) {
        console.log('[SharePoint] No drive ID provided, fetching default drive from site');
        const defaultDrive = await getDefaultDrive(accessToken, siteId);
        if (!defaultDrive) {
          return res.status(400).json({
            error:
              'Could not determine drive ID. Please provide driveId as a query parameter or configure SHAREPOINT_DRIVE_ID in environment variables.',
          });
        }
        driveId = defaultDrive.id;
        console.log('[SharePoint] Using default drive ID:', driveId);
      }

      console.log('[SharePoint] Attempting to list items with:', {
        siteId,
        driveId,
        folderPath,
        folderId,
      });

      // Try to list items - if it fails with invalid drive, try to get available drives
      try {
        const items = await listSharePointItems(
          accessToken,
          siteId,
          driveId,
          folderPath,
          folderId
        );
        return res.json({ items });
      } catch (error: any) {
        // If drive ID is invalid, fetch available drives to help debug
        if (error.code === 'invalidRequest' && error.message?.includes('drive')) {
          console.log('[SharePoint] Drive ID appears invalid, fetching available drives');
          try {
            const availableDrives = await listDrives(accessToken, siteId);
            console.log('[SharePoint] Available drives:', availableDrives.map((d: any) => ({
              id: d.id,
              name: d.name,
              driveType: d.driveType,
            })));
            
            return res.status(400).json({
              error: 'The provided drive ID is invalid or does not belong to this site.',
              providedDriveId: driveId,
              availableDrives: availableDrives.map((d: any) => ({
                id: d.id,
                name: d.name,
                driveType: d.driveType,
                webUrl: d.webUrl,
              })),
              suggestion: availableDrives.length > 0
                ? `Try using drive ID: ${availableDrives[0].id} (${availableDrives[0].name})`
                : 'No drives found for this site',
            });
          } catch (driveListError) {
            // If we can't list drives, just return the original error
            console.error('[SharePoint] Failed to list drives:', driveListError);
            throw error;
          }
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error listing SharePoint items:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        body: error.body,
      });
      res.status(500).json({
        error: 'Failed to list SharePoint items',
        details: error.message || 'Unknown error',
        code: error.code,
      });
    }
  }
);

// GET /api/sharepoint/items/:itemId - get item metadata
router.get(
  '/items/:itemId',
  authenticateToken,
  [
    query('siteId').notEmpty(),
    query('driveId').notEmpty(),
    param('itemId').notEmpty(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessToken = req.headers['x-graph-token'] as string;

      if (!accessToken) {
        return res.status(400).json({
          error:
            'Access token required. Please provide x-graph-token header with Microsoft Graph access token.',
        });
      }

      const { siteId, driveId } = req.query;
      const { itemId } = req.params;

      const item = await getSharePointItem(
        accessToken,
        siteId as string,
        driveId as string,
        itemId
      );

      if (!item) {
        return res.status(404).json({ error: 'SharePoint item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Error fetching SharePoint item:', error);
      res.status(500).json({ error: 'Failed to fetch SharePoint item' });
    }
  }
);

// GET /api/sharepoint/url - generate SharePoint URL
router.get(
  '/url',
  authenticateToken,
  [
    query('siteId').notEmpty(),
    query('driveId').notEmpty(),
    query('itemId').notEmpty(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { siteId, driveId, itemId } = req.query;
      const accessToken = req.headers['x-graph-token'] as string;

      // Try to get the actual webUrl from SharePoint if we have an access token
      if (accessToken) {
        try {
          const item = await getSharePointItem(
            accessToken,
            siteId as string,
            driveId as string,
            itemId as string
          );
          if (item?.webUrl) {
            return res.json({ url: item.webUrl });
          }
        } catch (error) {
          console.warn('Could not fetch webUrl from SharePoint, using generated URL:', error);
        }
      }

      // Fallback to generated URL
      const url = generateSharePointUrl(
        siteId as string,
        driveId as string,
        itemId as string
      );

      res.json({ url });
    } catch (error) {
      console.error('Error generating SharePoint URL:', error);
      res.status(500).json({ error: 'Failed to generate SharePoint URL' });
    }
  }
);

// GET /api/sharepoint/verify-config - verify SharePoint configuration
router.get(
  '/verify-config',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessToken = req.headers['x-graph-token'] as string;

      if (!accessToken) {
        return res.status(400).json({
          error:
            'Access token required. Please provide x-graph-token header with Microsoft Graph access token.',
        });
      }

      const result: any = {
        config: {
          siteId: config.sharePoint.siteId || '(not set)',
          driveId: config.sharePoint.driveId || '(not set)',
          siteIdConfigured: !!config.sharePoint.siteId,
          driveIdConfigured: !!config.sharePoint.driveId,
        },
        validation: {},
      };

      // Test site ID
      if (config.sharePoint.siteId) {
        try {
          const site = await getSharePointSite(accessToken, config.sharePoint.siteId);
          if (site) {
            result.validation.siteId = {
              valid: true,
              siteName: site.displayName || site.name,
              webUrl: site.webUrl,
            };
          } else {
            result.validation.siteId = {
              valid: false,
              error: 'Site not found or inaccessible',
            };
          }
        } catch (error: any) {
          result.validation.siteId = {
            valid: false,
            error: error.message || 'Failed to access site',
            details: error.code || error.statusCode,
          };
        }
      } else {
        result.validation.siteId = {
          valid: false,
          error: 'Site ID not configured',
        };
      }

      // Test drive ID and list available drives
      if (config.sharePoint.siteId) {
        try {
          const availableDrives = await listDrives(accessToken, config.sharePoint.siteId);
          result.availableDrives = availableDrives.map((d: any) => ({
            id: d.id,
            name: d.name,
            driveType: d.driveType,
            webUrl: d.webUrl,
          }));

          if (config.sharePoint.driveId) {
            // Check if configured drive ID matches any available drive
            const matchingDrive = availableDrives.find(
              (d: any) => d.id === config.sharePoint.driveId
            );

            if (matchingDrive) {
              try {
                const items = await listSharePointItems(
                  accessToken,
                  config.sharePoint.siteId,
                  config.sharePoint.driveId
                );
                result.validation.driveId = {
                  valid: true,
                  itemCount: items.length,
                  message: `Successfully accessed drive "${matchingDrive.name}" (found ${items.length} items)`,
                  driveName: matchingDrive.name,
                };
              } catch (error: any) {
                result.validation.driveId = {
                  valid: false,
                  error: error.message || 'Failed to access drive',
                  details: error.code || error.statusCode,
                  body: error.body,
                  driveName: matchingDrive.name,
                };
              }
            } else {
              result.validation.driveId = {
                valid: false,
                error: `Configured drive ID "${config.sharePoint.driveId}" not found in available drives`,
                configuredDriveId: config.sharePoint.driveId,
                suggestion: availableDrives.length > 0
                  ? `Try using: ${availableDrives[0].id} (${availableDrives[0].name})`
                  : 'No drives available',
              };
            }
          } else {
            // No drive ID configured, suggest the default
            if (availableDrives.length > 0) {
              result.validation.driveId = {
                valid: false,
                error: 'Drive ID not configured, but drives are available',
                suggestedDriveId: availableDrives[0].id,
                driveName: availableDrives[0].name,
                message: `Suggested: Use drive ID "${availableDrives[0].id}" for "${availableDrives[0].name}"`,
              };
            } else {
              result.validation.driveId = {
                valid: false,
                error: 'Drive ID not configured and no drives found',
              };
            }
          }
        } catch (error: any) {
          result.validation.driveId = {
            valid: false,
            error: 'Failed to list drives',
            details: error.message,
          };
        }
      } else {
        result.validation.driveId = {
          valid: false,
          error: 'Drive ID not configured (site ID also required)',
        };
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error verifying SharePoint config:', error);
      res.status(500).json({
        error: 'Failed to verify configuration',
        details: error.message,
      });
    }
  }
);

// POST /api/sharepoint/parse-url - parse SharePoint URL and extract IDs
router.post(
  '/parse-url',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const accessToken = req.headers['x-graph-token'] as string;

      if (!accessToken) {
        return res.status(400).json({
          error:
            'Access token required. Please provide x-graph-token header with Microsoft Graph access token.',
        });
      }

      const parsed = await parseSharePointUrl(accessToken, url);

      if (!parsed) {
        return res.status(404).json({
          error: 'Could not parse SharePoint URL. Please ensure the URL is valid and accessible.',
        });
      }

      res.json(parsed);
    } catch (error) {
      console.error('Error parsing SharePoint URL:', error);
      res.status(500).json({ error: 'Failed to parse SharePoint URL' });
    }
  }
);

export { router as sharePointRouter };

