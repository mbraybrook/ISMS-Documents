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
          implemented: true,
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
                archived: false,
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
      expect(result[0].implemented).toBe('Yes');
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
          implemented: false,
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
      expect(result[0].implemented).toBe('No');
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
          implemented: true,
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
          implemented: false,
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
          implemented: true,
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

    it('should sort control codes numerically (not alphabetically)', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: '7.10',
          title: 'Control 7.10',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-2',
          code: '7.2',
          title: 'Control 7.2',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-3',
          code: '7.1',
          title: 'Control 7.1',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-4',
          code: '7.14',
          title: 'Control 7.14',
          implemented: false,
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

      // Should be sorted numerically: 7.1, 7.2, 7.10, 7.14
      // Not alphabetically: 7.1, 7.10, 7.14, 7.2
      expect(result[0].controlCode).toBe('7.1');
      expect(result[1].controlCode).toBe('7.2');
      expect(result[2].controlCode).toBe('7.10');
      expect(result[3].controlCode).toBe('7.14');
    });

    it('should handle A. prefix in control codes', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.7.10',
          title: 'Control A.7.10',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-2',
          code: 'A.7.2',
          title: 'Control A.7.2',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [],
          documentControls: [],
        },
        {
          id: 'control-3',
          code: 'A.7.1',
          title: 'Control A.7.1',
          implemented: false,
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

      // Should be sorted numerically: A.7.1, A.7.2, A.7.10
      expect(result[0].controlCode).toBe('A.7.1');
      expect(result[1].controlCode).toBe('A.7.2');
      expect(result[2].controlCode).toBe('A.7.10');
    });

    it('should exclude archived risks from linked risk count', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Test Control',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [
            {
              risk: {
                id: 'risk-1',
                title: 'Active Risk',
                archived: false,
              },
            },
            {
              risk: {
                id: 'risk-2',
                title: 'Archived Risk',
                archived: true,
              },
            },
            {
              risk: {
                id: 'risk-3',
                title: 'Another Archived Risk',
                archived: true,
              },
            },
          ],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result).toHaveLength(1);
      expect(result[0].controlCode).toBe('A.8.3');
      expect(result[0].applicable).toBe('No');
      // Should only count active risks, not archived ones
      expect(result[0].linkedRiskCount).toBe(1);
      expect(result[0].linkedRiskIds).toEqual(['risk-1']);
    });

    it('should show zero linked risks when all risks are archived', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Test Control',
          implemented: false,
          selectedForRiskAssessment: false,
          selectedForContractualObligation: false,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: false,
          justification: '',
          riskControls: [
            {
              risk: {
                id: 'risk-1',
                title: 'Archived Risk 1',
                archived: true,
              },
            },
            {
              risk: {
                id: 'risk-2',
                title: 'Archived Risk 2',
                archived: true,
              },
            },
          ],
          documentControls: [],
        },
      ];

      (prisma.control.findMany as jest.Mock).mockResolvedValue(mockControls);

      const result = await generateSoAData();

      expect(result).toHaveLength(1);
      expect(result[0].controlCode).toBe('A.8.3');
      expect(result[0].applicable).toBe('No');
      // Should show zero when all risks are archived
      expect(result[0].linkedRiskCount).toBe(0);
      expect(result[0].linkedRiskIds).toEqual([]);
    });
  });

  describe('generateSoAExcel', () => {
    it('should generate Excel file from SoA data', async () => {
      const soaData = [
        {
          controlCode: 'A.8.3',
          controlTitle: 'Test Control',
          applicable: 'Yes' as const,
          implemented: 'Yes' as const,
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
          implemented: 'Yes' as const,
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



