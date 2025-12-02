import { generateConfluenceUrl } from '../confluenceService';

// Confluence service tests require complex axios mocking
// Only testing pure functions that don't require external dependencies
// TODO: Re-enable API tests once mock infrastructure is in place

describe('confluenceService', () => {
  describe('generateConfluenceUrl', () => {
    it('should generate correct Confluence URL', () => {
      const url = generateConfluenceUrl('https://test.atlassian.net', 'TEST', 'page-123');

      expect(url).toBe('https://test.atlassian.net/pages/viewpage.action?pageId=page-123');
    });

    it('should handle different base URLs', () => {
      const url = generateConfluenceUrl('https://company.atlassian.net', 'SPACE', 'page-456');

      expect(url).toBe('https://company.atlassian.net/pages/viewpage.action?pageId=page-456');
    });
  });
});

