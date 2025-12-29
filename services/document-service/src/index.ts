import express from 'express';
import { documentRoutes } from './routes/documentRoutes';
import { authInternal } from './middleware/authInternal';

const app = express();
const PORT = parseInt(process.env.PORT || '4001', 10);

// Middleware
app.use(express.json({ limit: '100mb' })); // Large limit for PDF buffers

// Health check endpoint (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'document-service',
  });
});

// Protected routes - require internal service token
app.use('/v1', authInternal, documentRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[DocumentService] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[DocumentService] Server running on port ${PORT}`);
  console.log(`[DocumentService] CACHE_DIR: ${process.env.CACHE_DIR || '/cache'}`);
});


