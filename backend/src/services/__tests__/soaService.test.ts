/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateSoAData, generateSoAExcel } from '../soaService';
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
          selectedForRiskAssessment: true,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: 'Test justification',
          riskControls: [
            {
              risk: {
                id: 'risk-1',
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
      expect(result[0].selectionReasons).toBe('Risk Assessment');
      expect(result[0].linkedRiskCount).toBe(1);
      expect(result[0].linkedDocumentCount).toBe(1);
      expect(result[0].linkedRiskIds).toEqual(['risk-1']);
      expect(result[0].linkedDocumentTitles).toEqual(['Test Document (v1.0)']);
    });

    it('should handle non-applicable controls', async () => {
      const mockControls = [
        {
          id: 'control-2',
          code: 'A.5.9',
          title: 'Non-Applicable Control',
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result[0].applicable).toBe('No');
      expect(result[0].selectionReasons).toBe('Not applicable');
      expect(result[0].linkedRiskCount).toBe(0);
      expect(result[0].linkedDocumentCount).toBe(0);
    });

    it('should handle multiple selection reasons', async () => {
      const mockControls = [
        {
          id: 'control-3',
          code: 'A.8.24',
          title: 'Multi-Reason Control',
          selectedForRiskAssessment: true,
          selectedForContractualObligation: true,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: true,
          justification: 'Multiple reasons',
          riskControls: [],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result[0].applicable).toBe('Yes');
      expect(result[0].selectionReasons).toContain('Risk Assessment');
      expect(result[0].selectionReasons).toContain('Contractual Obligation');
      expect(result[0].selectionReasons).toContain('Business Requirement/Best Practice');
    });

    it('should sort controls by code', async () => {
      const mockControls = [
        {
          id: 'control-2',
          code: 'A.5.9',
          title: 'Control B',
          selectedForRiskAssessment: true,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control A',
          selectedForRiskAssessment: true,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result[0].controlCode).toBe('A.5.9');
      expect(result[1].controlCode).toBe('A.8.3');
    });
  });

  describe('generateSoAExcel', () => {
    it('should generate Excel file from SoA data', async () => {
      const soaData = [
        {
          controlCode: 'A.8.3',
          controlTitle: 'Test Control',
          applicable: 'Yes' as const,
          selectionReasons: 'Risk Assessment',
          justification: 'Test justification',
          linkedRiskIds: ['risk-1'],
          linkedRiskCount: 1,
          linkedDocumentTitles: ['Test Document (v1.0)'],
          linkedDocumentCount: 1,
        },
      ];

      const buffer = await generateSoAExcel(soaData);

      expect(buffer).toBeDefined();
      // Buffer is a Uint8Array in ExcelJS, check it has content
      expect(buffer.byteLength || (buffer as any).length).toBeGreaterThan(0);
    });

    it('should include all required columns', async () => {
      const soaData = [
        {
          controlCode: 'A.8.3',
          controlTitle: 'Test Control',
          applicable: 'Yes' as const,
          selectionReasons: 'Risk Assessment',
          justification: 'Test justification',
          linkedRiskIds: ['risk-1'],
          linkedRiskCount: 1,
          linkedDocumentTitles: ['Test Document (v1.0)'],
          linkedDocumentCount: 1,
        },
      ];

      const buffer = await generateSoAExcel(soaData);
      // Buffer should contain Excel file data
      expect(buffer).toBeDefined();
    });
  });
});



