import express from 'express';
import { aiRoutes } from './routes/aiRoutes';
import { authInternal } from './middleware/authInternal';

const app = express();
const PORT = parseInt(process.env.PORT || '4002', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (no auth required)
// Check Ollama connection status
app.get('/health', async (_req, res) => {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  let ollamaStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    const response = await fetch(`${ollamaEndpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    if (response.ok) {
      ollamaStatus = 'connected';
    }
  } catch (error) {
    // Ollama not available
    ollamaStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    service: 'ai-service',
    ollama: ollamaStatus,
  });
});

// Protected routes - require internal service token
app.use('/v1', authInternal, aiRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[AIService] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[AIService] Server running on port ${PORT}`);
  console.log(`[AIService] OLLAMA_ENDPOINT: ${process.env.OLLAMA_ENDPOINT || 'http://localhost:11434'}`);
  console.log(`[AIService] OLLAMA_MODEL: ${process.env.OLLAMA_MODEL || 'nomic-embed-text'}`);
});

