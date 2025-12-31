import { config } from './config';
import { log } from './lib/logger';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';
import { acknowledgmentsRouter } from './routes/acknowledgments';
import { reviewsRouter } from './routes/reviews';
import { risksRouter } from './routes/risks';
import { controlsRouter } from './routes/controls';
import { soaRouter } from './routes/soa';
import { sharePointRouter } from './routes/sharepoint';
import { confluenceRouter } from './routes/confluence';
import { usersRouter } from './routes/users';
import classificationsRouter from './routes/classifications';
import assetCategoriesRouter from './routes/assetCategories';
import assetsRouter from './routes/assets';
import interestedPartiesRouter from './routes/interestedParties';
import legislationRouter from './routes/legislation';
import suppliersRouter from './routes/suppliers';
import supplierLinksRouter from './routes/supplierLinks';
import supplierExitPlansRouter from './routes/supplierExitPlans';
import { dashboardRouter } from './routes/dashboard';
import { trustRouter } from './routes/trust';
import { trustAuthRouter } from './routes/trust/auth';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimit';
import { startDocumentChangeJob } from './jobs/documentChangeJob';

const app = express();

// CORS configuration - allow Trust Centre subdomain
// Supports wildcard patterns like: https://trust.*.paythru.com
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // For development, allow localhost
    if (config.nodeEnv === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }

    // Get allowed origins from config
    const allowedOrigins = config.cors.trustCenterOrigins || [];

    // Check if origin is in allowed list (exact match)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check for wildcard patterns (e.g., https://trust.*.paythru.com)
    for (const pattern of allowedOrigins) {
      if (pattern.includes('*')) {
        // Convert wildcard pattern to regex
        // Escape special regex characters except *
        const regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
          .replace(/\*/g, '[^.]*'); // Replace * with non-dot characters
        const regex = new RegExp(`^${regexPattern}$`);

        if (regex.test(origin)) {
          return callback(null, true);
        }
      }
    }

    // Origin not allowed
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for PDFs
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
}));
app.use(cors(corsOptions));
app.use(express.json());

// Global rate limiting - applies to all routes except health check
// Specific routes (auth, downloads) have stricter limits applied on top
app.use('/api', globalLimiter);

// CSP headers middleware for PDF downloads
app.use((req, res, next) => {
  // Only set CSP for trust centre routes
  if (req.path.startsWith('/api/trust')) {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
  }
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/acknowledgments', acknowledgmentsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/risks', risksRouter);
app.use('/api/controls', controlsRouter);
app.use('/api/soa', soaRouter);
app.use('/api/sharepoint', sharePointRouter);
app.use('/api/confluence', confluenceRouter);
app.use('/api/users', usersRouter);
app.use('/api/classifications', classificationsRouter);
app.use('/api/asset-categories', assetCategoriesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/interested-parties', interestedPartiesRouter);
app.use('/api/legislation', legislationRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/suppliers', supplierLinksRouter);
app.use('/api/suppliers', supplierExitPlansRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/trust', trustAuthRouter);
app.use('/api/trust', trustRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  log.info(`Server running on port ${PORT}`);
  log.info('Auth config loaded', {
    tenantId: config.auth.tenantId ? `${config.auth.tenantId.substring(0, 8)}...` : 'MISSING',
    clientId: config.auth.clientId ? `${config.auth.clientId.substring(0, 8)}...` : 'MISSING',
    hasClientSecret: !!config.auth.clientSecret,
    redirectUri: config.auth.redirectUri,
  });

  // Start scheduled jobs
  try {
    startDocumentChangeJob();
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Failed to start document change job', {
      error: err.message,
      stack: err.stack,
    });
    // Don't prevent server from starting if job fails
  }
});


