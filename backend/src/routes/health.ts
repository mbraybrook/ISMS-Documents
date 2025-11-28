import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    // Check database connection and get document count
    const documentCount = await prisma.document.count();
    const userCount = await prisma.user.count();
    
    res.json({ 
      status: 'ok', 
      message: 'ISMS Backend API is running',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        documentCount,
        userCount,
        databaseUrl: config.databaseUrl.replace(/\/[^\/]+$/, '/***'), // Hide actual path
      },
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      database: {
        connected: false,
        databaseUrl: config.databaseUrl.replace(/\/[^\/]+$/, '/***'),
      },
    });
  }
});

