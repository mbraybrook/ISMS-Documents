import express from 'express';
import cors from 'cors';
import { config } from './config';
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
import { dashboardRouter } from './routes/dashboard';
import { trustRouter } from './routes/trust';
import { trustAuthRouter } from './routes/trust/auth';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// CORS configuration - allow Trust Center subdomain
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Get allowed origins from config
    const allowedOrigins = config.cors.trustCenterOrigins || [];
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // For development, allow localhost
      if (config.nodeEnv === 'development' && origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// CSP headers middleware for PDF downloads
app.use((req, res, next) => {
  // Only set CSP for trust center routes
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
app.use('/api/dashboard', dashboardRouter);
app.use('/api/trust', trustAuthRouter);
app.use('/api/trust', trustRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Auth config:', {
    tenantId: config.auth.tenantId ? `${config.auth.tenantId.substring(0, 8)}...` : 'MISSING',
    clientId: config.auth.clientId ? `${config.auth.clientId.substring(0, 8)}...` : 'MISSING',
    hasClientSecret: !!config.auth.clientSecret,
    redirectUri: config.auth.redirectUri,
  });
});

