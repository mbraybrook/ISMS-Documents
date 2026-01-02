/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Sanitize HTML configuration
const sanitizeOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br'],
    allowedAttributes: {
        'a': ['href', 'target', 'rel']
    },
    transformTags: {
        'a': (tagName: string, attribs: Record<string, string>) => ({
            tagName: 'a',
            attribs: {
                ...attribs,
                target: '_blank',
                rel: 'noopener noreferrer'
            }
        })
    }
};

// GET /api/notes/documents/:docId - List notes for a document
// Auth: Admin or Editor
router.get(
    '/documents/:docId',
    authenticateToken,
    requireRole('ADMIN', 'EDITOR'),
    async (req: AuthRequest, res: Response) => {
        try {
            const { docId } = req.params;

            const notes = await prisma.note.findMany({
                where: { documentId: docId },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            email: true,
                            // Add avatarUrl if available in schema
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json(notes);
        } catch (error) {
            console.error('Error fetching notes:', error);
            res.status(500).json({ error: 'Failed to fetch notes' });
        }
    }
);

// POST /api/notes/documents/:docId - Create a new note
// Auth: Admin or Editor
router.post(
    '/documents/:docId',
    authenticateToken,
    requireRole('ADMIN', 'EDITOR'),
    [
        body('content').notEmpty().withMessage('Content is required'),
    ],
    validate,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user || !req.user.email) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get DB user
            const user = await prisma.user.findUnique({
                where: { email: req.user.email },
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { docId } = req.params;
            const { content } = req.body;

            // Verify document exists
            const document = await prisma.document.findUnique({
                where: { id: docId },
            });

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Sanitize content
            const sanitizedContent = sanitizeHtml(content, sanitizeOptions);

            const note = await prisma.note.create({
                data: {
                    id: randomUUID(),
                    documentId: docId,
                    authorId: user.id,
                    content: sanitizedContent,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            email: true,
                        },
                    },
                },
            });

            res.status(201).json(note);
        } catch (error) {
            console.error('Error creating note:', error);
            res.status(500).json({ error: 'Failed to create note' });
        }
    }
);

// PUT /api/notes/:noteId - Edit a note
// Auth: Note Author only
router.put(
    '/:noteId',
    authenticateToken,
    [
        body('content').notEmpty().withMessage('Content is required'),
    ],
    validate,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user || !req.user.email) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get DB user
            const user = await prisma.user.findUnique({
                where: { email: req.user.email },
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { noteId } = req.params;
            const { content } = req.body;

            const note = await prisma.note.findUnique({
                where: { id: noteId },
            });

            if (!note) {
                return res.status(404).json({ error: 'Note not found' });
            }

            // Check authorization (Author only)
            if (note.authorId !== user.id) {
                return res.status(403).json({ error: 'You can only edit your own notes' });
            }

            // Sanitize content
            const sanitizedContent = sanitizeHtml(content, sanitizeOptions);

            const updatedNote = await prisma.note.update({
                where: { id: noteId },
                data: {
                    content: sanitizedContent,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            email: true,
                        },
                    },
                },
            });

            res.json(updatedNote);
        } catch (error) {
            console.error('Error updating note:', error);
            res.status(500).json({ error: 'Failed to update note' });
        }
    }
);

// DELETE /api/notes/:noteId - Delete a note
// Auth: Note Author only
router.delete(
    '/:noteId',
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user || !req.user.email) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get DB user
            const user = await prisma.user.findUnique({
                where: { email: req.user.email },
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { noteId } = req.params;

            const note = await prisma.note.findUnique({
                where: { id: noteId },
            });

            if (!note) {
                return res.status(404).json({ error: 'Note not found' });
            }

            // Check authorization (Author only)
            if (note.authorId !== user.id) {
                return res.status(403).json({ error: 'You can only delete your own notes' });
            }

            await prisma.note.delete({
                where: { id: noteId },
            });

            res.status(204).send();
        } catch (error) {
            console.error('Error deleting note:', error);
            res.status(500).json({ error: 'Failed to delete note' });
        }
    }
);

export { router as notesRouter };
