import { generateSoAData } from '../soaService';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    control: {
      findMany: jest.fn(),
    },
  },
}));

describe('soaService', () => {
  describe('generateSoAData', () => {
    it('should generate SoA data structure', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Test Control',
          isApplicable: true,
          applicabilitySource: 'AUTO_FROM_RISK',
          justification: 'Test justification',
          riskControls: [
            {
              risk: {
                id: 'risk-1',
                externalId: 'R001',
                title: 'Test Risk',
              },
            },
          ],
          documentControls: [
            {
              document: {
                id: 'doc-1',
                title: 'Test Document',
                version: '1.0',
              },
            },
          ],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result).toHaveLength(1);
      expect(result[0].controlCode).toBe('A.8.3');
      expect(result[0].applicable).toBe('Yes');
      expect(result[0].linkedRiskCount).toBe(1);
      expect(result[0].linkedDocumentCount).toBe(1);
    });

    it('should handle non-applicable controls', async () => {
      const mockControls = [
        {
          id: 'control-2',
          code: 'A.5.9',
          title: 'Non-Applicable Control',
          isApplicable: false,
          applicabilitySource: null,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result[0].applicable).toBe('No');
      expect(result[0].linkedRiskCount).toBe(0);
    });
  });
});


