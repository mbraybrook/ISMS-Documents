import { Router, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import {
  getConfluencePage,
  searchConfluencePages,
  listConfluencePages,
  generateConfluenceUrl,
} from '../services/confluenceService';
import { config } from '../config';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/confluence/pages - list pages in a space
router.get(
  '/pages',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [query('spaceKey').notEmpty(), query('query').optional().isString()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { spaceKey, query: searchQuery } = req.query;

      let pages;
      if (searchQuery) {
        pages = await searchConfluencePages(
          spaceKey as string,
          searchQuery as string
        );
      } else {
        pages = await listConfluencePages(spaceKey as string);
      }

      res.json({ pages });
    } catch (error) {
      console.error('Error listing Confluence pages:', error);
      res.status(500).json({ error: 'Failed to list Confluence pages' });
    }
  }
);

// GET /api/confluence/pages/:pageId - get page metadata
router.get(
  '/pages/:pageId',
  authenticateToken,
  [query('spaceKey').notEmpty(), param('pageId').notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { spaceKey } = req.query;
      const { pageId } = req.params;

      const page = await getConfluencePage(spaceKey as string, pageId);

      if (!page) {
        return res.status(404).json({ error: 'Confluence page not found' });
      }

      res.json(page);
    } catch (error) {
      console.error('Error fetching Confluence page:', error);
      res.status(500).json({ error: 'Failed to fetch Confluence page' });
    }
  }
);

// GET /api/confluence/url - generate Confluence URL
router.get(
  '/url',
  authenticateToken,
  [query('spaceKey').notEmpty(), query('pageId').notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { spaceKey, pageId } = req.query;

      if (!config.confluence.baseUrl) {
        return res.status(500).json({
          error: 'Confluence base URL not configured',
        });
      }

      const url = generateConfluenceUrl(
        config.confluence.baseUrl,
        spaceKey as string,
        pageId as string
      );

      res.json({ url });
    } catch (error) {
      console.error('Error generating Confluence URL:', error);
      res.status(500).json({ error: 'Failed to generate Confluence URL' });
    }
  }
);

export { router as confluenceRouter };

