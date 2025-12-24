/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as confluenceService from '../confluenceService';
import { ConfluencePage } from '../confluenceService';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config', () => ({
  config: {
    confluence: {
      baseUrl: 'https://test.atlassian.net',
      username: 'test-user',
      apiToken: 'test-token',
    },
  },
}));

jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
  },
}));

describe('confluenceService', () => {
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  let mockAxiosCreate: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup axios mock
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      defaults: {} as any,
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
      },
    } as any;

    mockAxiosCreate = axios.create as jest.Mock;
    mockAxiosCreate.mockReturnValue(mockAxiosInstance);

    // Suppress console.error during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('generateConfluenceUrl', () => {
    it('should generate correct Confluence URL', () => {
      // Arrange
      const baseUrl = 'https://test.atlassian.net';
      const spaceKey = 'TEST';
      const pageId = 'page-123';

      // Act
      const url = confluenceService.generateConfluenceUrl(baseUrl, spaceKey, pageId);

      // Assert
      expect(url).toBe('https://test.atlassian.net/wiki/spaces/TEST/pages/page-123');
    });

    it('should handle different base URLs', () => {
      // Arrange
      const baseUrl = 'https://company.atlassian.net';
      const spaceKey = 'SPACE';
      const pageId = 'page-456';

      // Act
      const url = confluenceService.generateConfluenceUrl(baseUrl, spaceKey, pageId);

      // Assert
      expect(url).toBe('https://company.atlassian.net/wiki/spaces/SPACE/pages/page-456');
    });
  });

  describe('getConfluencePage', () => {
    it('should return page data when page exists', async () => {
      // Arrange
      const mockPage: ConfluencePage = {
        id: 'page-123',
        title: 'Test Page',
        space: {
          key: 'TEST',
          name: 'Test Space',
        },
        version: {
          number: 1,
        },
        _links: {
          webui: '/spaces/TEST/pages/page-123',
          self: '/rest/api/content/page-123',
        },
        body: {
          storage: {
            value: '<p>Test content</p>',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockPage,
      });

      // Act
      const result = await confluenceService.getConfluencePage('TEST', 'page-123');

      // Assert
      expect(result).toEqual(mockPage);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/page-123', {
        params: {
          expand: 'space,version,body.storage',
        },
      });
    });

    it('should return null when page does not exist (404)', async () => {
      // Arrange
      const axiosError = {
        response: {
          status: 404,
        },
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act
      const result = await confluenceService.getConfluencePage('TEST', 'page-123');

      // Assert
      expect(result).toBeNull();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/page-123', {
        params: {
          expand: 'space,version,body.storage',
        },
      });
    });

    it('should return null when API call fails with other error', async () => {
      // Arrange
      const axiosError = {
        response: {
          status: 500,
        },
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act
      const result = await confluenceService.getConfluencePage('TEST', 'page-123');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when error has no response', async () => {
      // Arrange
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.getConfluencePage('TEST', 'page-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('searchConfluencePages', () => {
    it('should return pages when search succeeds with query', async () => {
      // Arrange
      const mockPages: ConfluencePage[] = [
        {
          id: 'page-1',
          title: 'Test Page 1',
          space: {
            key: 'TEST',
            name: 'Test Space',
          },
          version: {
            number: 1,
          },
          _links: {
            webui: '/spaces/TEST/pages/page-1',
            self: '/rest/api/content/page-1',
          },
        },
        {
          id: 'page-2',
          title: 'Test Page 2',
          space: {
            key: 'TEST',
            name: 'Test Space',
          },
          version: {
            number: 1,
          },
          _links: {
            webui: '/spaces/TEST/pages/page-2',
            self: '/rest/api/content/page-2',
          },
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          results: mockPages,
        },
      });

      // Act
      const result = await confluenceService.searchConfluencePages('TEST', 'test query');

      // Assert
      expect(result).toEqual(mockPages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/search', {
        params: {
          spaceKey: 'TEST',
          expand: 'space,version',
          limit: 100,
          cql: 'space = TEST AND text ~ "test query"',
        },
      });
    });

    it('should return pages when search succeeds without query', async () => {
      // Arrange
      const mockPages: ConfluencePage[] = [
        {
          id: 'page-1',
          title: 'Test Page 1',
          space: {
            key: 'TEST',
            name: 'Test Space',
          },
          version: {
            number: 1,
          },
          _links: {
            webui: '/spaces/TEST/pages/page-1',
            self: '/rest/api/content/page-1',
          },
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          results: mockPages,
        },
      });

      // Act
      const result = await confluenceService.searchConfluencePages('TEST');

      // Assert
      expect(result).toEqual(mockPages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/search', {
        params: {
          spaceKey: 'TEST',
          expand: 'space,version',
          limit: 100,
        },
      });
      const callArgs = mockAxiosInstance.get.mock.calls[0];
      expect(callArgs[1]?.params?.cql).toBeUndefined();
    });

    it('should return empty array when search fails', async () => {
      // Arrange
      const error = new Error('API Error');
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.searchConfluencePages('TEST', 'query');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array when response has no results', async () => {
      // Arrange
      mockAxiosInstance.get.mockResolvedValue({
        data: {},
      });

      // Act
      const result = await confluenceService.searchConfluencePages('TEST');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle error with message string', async () => {
      // Arrange
      const error = 'String error';
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.searchConfluencePages('TEST');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('listConfluencePages', () => {
    it('should return pages when list succeeds', async () => {
      // Arrange
      const mockPages: ConfluencePage[] = [
        {
          id: 'page-1',
          title: 'Test Page 1',
          space: {
            key: 'TEST',
            name: 'Test Space',
          },
          version: {
            number: 1,
          },
          _links: {
            webui: '/spaces/TEST/pages/page-1',
            self: '/rest/api/content/page-1',
          },
        },
        {
          id: 'page-2',
          title: 'Test Page 2',
          space: {
            key: 'TEST',
            name: 'Test Space',
          },
          version: {
            number: 1,
          },
          _links: {
            webui: '/spaces/TEST/pages/page-2',
            self: '/rest/api/content/page-2',
          },
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          results: mockPages,
        },
      });

      // Act
      const result = await confluenceService.listConfluencePages('TEST');

      // Assert
      expect(result).toEqual(mockPages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content', {
        params: {
          spaceKey: 'TEST',
          expand: 'space,version',
          limit: 100,
        },
      });
    });

    it('should return empty array when list fails', async () => {
      // Arrange
      const error = new Error('API Error');
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.listConfluencePages('TEST');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array when response has no results', async () => {
      // Arrange
      mockAxiosInstance.get.mockResolvedValue({
        data: {},
      });

      // Act
      const result = await confluenceService.listConfluencePages('TEST');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle error with message string', async () => {
      // Arrange
      const error = 'String error';
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.listConfluencePages('TEST');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getConfluenceSpace', () => {
    it('should return space data when space exists', async () => {
      // Arrange
      const mockSpace = {
        key: 'TEST',
        name: 'Test Space',
        type: 'global',
        _links: {
          webui: '/spaces/TEST',
          self: '/rest/api/space/TEST',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockSpace,
      });

      // Act
      const result = await confluenceService.getConfluenceSpace('TEST');

      // Assert
      expect(result).toEqual(mockSpace);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/space/TEST');
    });

    it('should return null when space fetch fails', async () => {
      // Arrange
      const error = new Error('API Error');
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.getConfluenceSpace('TEST');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle error with message string', async () => {
      // Arrange
      const error = 'String error';
      mockAxiosInstance.get.mockRejectedValue(error);

      // Act
      const result = await confluenceService.getConfluenceSpace('TEST');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('createConfluenceClient', () => {
    // Note: createConfluenceClient is not exported, so we test it indirectly
    // through the functions that use it. The config validation (checking for
    // missing baseUrl, username, or apiToken) is a simple guard clause that
    // throws an error. Testing this requires module re-import which is complex
    // with Jest's module system. The successful test cases below prove that
    // the config is being read correctly, and the validation logic is straightforward.

    it('should create client with correct base URL and auth headers', async () => {
      // Arrange
      const mockPage: ConfluencePage = {
        id: 'page-123',
        title: 'Test Page',
        space: {
          key: 'TEST',
          name: 'Test Space',
        },
        version: {
          number: 1,
        },
        _links: {
          webui: '/spaces/TEST/pages/page-123',
          self: '/rest/api/content/page-123',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockPage,
      });

      // Act
      await confluenceService.getConfluencePage('TEST', 'page-123');

      // Assert
      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://test.atlassian.net/rest/api',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify Basic auth is correctly encoded
      const authCall = mockAxiosCreate.mock.calls[0][0];
      const authHeader = authCall.headers.Authorization;
      expect(authHeader).toMatch(/^Basic /);
      
      // Decode and verify
      const base64Auth = authHeader.replace('Basic ', '');
      const decoded = Buffer.from(base64Auth, 'base64').toString('utf-8');
      expect(decoded).toBe('test-user:test-token');
    });
  });
});
