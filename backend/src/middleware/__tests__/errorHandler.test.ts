/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../errorHandler';
import { createMockRequest, createMockResponse, createMockNext } from '../../lib/test-helpers';

// Mock config
jest.mock('../../config', () => ({
  config: {
    nodeEnv: 'development',
  },
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { log } from '../../lib/logger';
import { config } from '../../config';

describe('errorHandler middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      ...createMockRequest(),
      path: '/api/test',
      method: 'GET',
    };
    mockResponse = createMockResponse();
    nextFunction = createMockNext();
    jest.clearAllMocks();
  });

  describe('error status code handling', () => {
    it('should use statusCode from error if provided', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      
      const error: AppError = new Error('Not found') as AppError;
      error.statusCode = 404;
      delete error.stack; // Remove stack trace

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Not found',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should default to 500 if statusCode is not provided', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      
      const error = new Error('Internal server error');
      delete error.stack; // Remove stack trace

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should use default message if error message is empty', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      
      const error = new Error('') as AppError;
      error.statusCode = 400;
      // Empty string is falsy, so it will use default
      error.message = '';
      delete error.stack; // Remove stack trace

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal Server Error',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('stack trace handling', () => {
    it('should include stack trace in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (config.nodeEnv as any) = 'development';
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          stack: 'Error: Test error\n    at test.js:1:1',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should NOT include stack trace in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (config.nodeEnv as any) = 'production';
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
        },
      });
      expect(mockResponse.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.anything(),
          }),
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should NOT include stack trace when NODE_ENV is production even if config.nodeEnv is development', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (config.nodeEnv as any) = 'development';
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should NOT include stack trace when error has no stack', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (config.nodeEnv as any) = 'development';
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      delete error.stack;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
        },
      });

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('error logging', () => {
    it('should log error with message, stack, statusCode, path, and method', () => {
      const error = new Error('Test error') as AppError;
      error.statusCode = 404;
      error.stack = 'Error: Test error\n    at test.js:1:1';

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(log.error).toHaveBeenCalledWith('Error occurred', {
        message: 'Test error',
        stack: 'Error: Test error\n    at test.js:1:1',
        statusCode: 404,
        path: '/api/test',
        method: 'GET',
      });
    });

    it('should log error without stack if stack is not available', () => {
      const error = new Error('Test error') as AppError;
      error.statusCode = 500;
      delete error.stack;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(log.error).toHaveBeenCalledWith('Error occurred', {
        message: 'Test error',
        stack: undefined,
        statusCode: 500,
        path: '/api/test',
        method: 'GET',
      });
    });

    it('should log with default statusCode 500 if not provided', () => {
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(log.error).toHaveBeenCalledWith('Error occurred', {
        message: 'Test error',
        stack: error.stack,
        statusCode: 500,
        path: '/api/test',
        method: 'GET',
      });
    });
  });

  describe('request information logging', () => {
    it('should log request path and method', () => {
      mockRequest = {
        ...mockRequest,
        path: '/api/users/123',
        method: 'POST',
      };
      
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(log.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        path: '/api/users/123',
        method: 'POST',
      }));
    });
  });
});

