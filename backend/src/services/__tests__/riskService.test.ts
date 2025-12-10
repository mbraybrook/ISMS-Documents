import {
  calculateRiskScore,
  parseControlCodes,
  validateStatusTransition,
  calculateCIAFromWizard,
  calculateMitigatedScore,
  getRiskLevel,
  hasPolicyNonConformance,
  updateRiskControls,
} from '../riskService';

// 1. Mock the module to return the defined structure (INLINED to avoid hoisting issues)
jest.mock('../../lib/prisma', () => ({
  prisma: {
    control: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    riskControl: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

// 2. Import the mocked module
import { prisma } from '../../lib/prisma';

// 3. Cast it to access mock methods
const mockPrisma = prisma as any;

describe('riskService', () => {
  describe('calculateRiskScore', () => {
    it('should calculate risk score correctly', () => {
      expect(calculateRiskScore(3, 4, 5, 2)).toBe(24);
      expect(calculateRiskScore(1, 1, 1, 1)).toBe(3);
      expect(calculateRiskScore(5, 5, 5, 5)).toBe(75);
    });

    it('should handle edge cases', () => {
      expect(calculateRiskScore(1, 1, 1, 5)).toBe(15);
      expect(calculateRiskScore(5, 5, 5, 1)).toBe(15);
    });
  });

  describe('parseControlCodes', () => {
    it('should parse comma-separated control codes', () => {
      const result = parseControlCodes('A.8.3, A.5.9, A.8.24');
      expect(result).toEqual(['A.8.3', 'A.5.9', 'A.8.24']);
    });

    it('should handle spaces correctly', () => {
      expect(parseControlCodes('A.8.3,A.5.9,A.8.24')).toEqual(['A.8.3', 'A.5.9', 'A.8.24']);
    });

    it('should handle single control code', () => {
      expect(parseControlCodes('A.8.3')).toEqual(['A.8.3']);
    });

    it('should return empty array for null/undefined', () => {
      expect(parseControlCodes(null)).toEqual([]);
      expect(parseControlCodes(undefined)).toEqual([]);
      expect(parseControlCodes('')).toEqual([]);
    });

    it('should filter out empty strings', () => {
      expect(parseControlCodes('A.8.3, , A.5.9')).toEqual(['A.8.3', 'A.5.9']);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow DRAFT to PROPOSED transition', () => {
      expect(validateStatusTransition('DRAFT', 'PROPOSED', 'CONTRIBUTOR')).toBe(true);
      expect(validateStatusTransition('DRAFT', 'PROPOSED', 'EDITOR')).toBe(true);
    });

    it('should allow PROPOSED to ACTIVE transition for ADMIN/EDITOR', () => {
      expect(validateStatusTransition('PROPOSED', 'ACTIVE', 'ADMIN')).toBe(true);
      expect(validateStatusTransition('PROPOSED', 'ACTIVE', 'EDITOR')).toBe(true);
    });

    it('should not allow PROPOSED to ACTIVE for CONTRIBUTOR', () => {
      expect(validateStatusTransition('PROPOSED', 'ACTIVE', 'CONTRIBUTOR')).toBe(false);
    });

    it('should allow PROPOSED to REJECTED transition for ADMIN/EDITOR', () => {
      expect(validateStatusTransition('PROPOSED', 'REJECTED', 'ADMIN')).toBe(true);
      expect(validateStatusTransition('PROPOSED', 'REJECTED', 'EDITOR')).toBe(true);
    });

    it('should allow ADMIN/EDITOR to archive ACTIVE risks', () => {
      expect(validateStatusTransition('ACTIVE', 'ARCHIVED', 'ADMIN')).toBe(true);
    });

    it('should not allow CONTRIBUTOR to archive ACTIVE risks', () => {
      expect(validateStatusTransition('ACTIVE', 'ARCHIVED', 'CONTRIBUTOR')).toBe(false);
    });

    it('should allow ADMIN/EDITOR to make any transition', () => {
      expect(validateStatusTransition('ACTIVE', 'DRAFT', 'ADMIN')).toBe(true);
      expect(validateStatusTransition('REJECTED', 'ACTIVE', 'ADMIN')).toBe(true);
    });
  });

  describe('calculateCIAFromWizard', () => {
    it('should calculate CIA scores from impact level', () => {
      expect(calculateCIAFromWizard(1)).toEqual({ c: 1, i: 1, a: 1 });
      expect(calculateCIAFromWizard(3)).toEqual({ c: 3, i: 3, a: 3 });
      expect(calculateCIAFromWizard(5)).toEqual({ c: 5, i: 5, a: 5 });
    });

    it('should handle edge cases', () => {
      expect(calculateCIAFromWizard(0)).toEqual({ c: 1, i: 1, a: 1 });
      expect(calculateCIAFromWizard(6)).toEqual({ c: 5, i: 5, a: 5 });
    });
  });

  describe('calculateMitigatedScore', () => {
    it('should calculate mitigated score correctly', () => {
      expect(calculateMitigatedScore(3, 3, 3, 2)).toBe(18);
    });

    it('should return null if any parameter is missing', () => {
      expect(calculateMitigatedScore(null, 3, 3, 2)).toBeNull();
      expect(calculateMitigatedScore(3, null, 3, 2)).toBeNull();
    });
  });

  describe('getRiskLevel', () => {
    it('should return correct risk levels', () => {
      expect(getRiskLevel(1)).toBe('LOW');
      expect(getRiskLevel(15)).toBe('MEDIUM');
      expect(getRiskLevel(36)).toBe('HIGH');
    });
  });

  describe('hasPolicyNonConformance', () => {
    it('should return false if risk category is not MODIFY', () => {
      const risk = {
        initialRiskTreatmentCategory: 'ACCEPT',
        calculatedScore: 20,
        mitigatedConfidentialityScore: null,
        mitigatedIntegrityScore: null,
        mitigatedAvailabilityScore: null,
        mitigatedLikelihood: null,
        mitigatedScore: null,
        mitigationDescription: null,
      };
      expect(hasPolicyNonConformance(risk)).toBe(false);
    });

    it('should return true if MODIFY and MEDIUM/HIGH but incomplete', () => {
      const risk = {
        initialRiskTreatmentCategory: 'MODIFY',
        calculatedScore: 20, // MEDIUM
        mitigatedConfidentialityScore: null,
        mitigatedIntegrityScore: null,
        mitigatedAvailabilityScore: null,
        mitigatedLikelihood: null,
        mitigatedScore: null,
        mitigationDescription: 'Some description',
      };
      expect(hasPolicyNonConformance(risk)).toBe(true);
    });

    it('should return false if MODIFY and complete', () => {
      const risk = {
        initialRiskTreatmentCategory: 'MODIFY',
        calculatedScore: 20,
        mitigatedConfidentialityScore: 2,
        mitigatedIntegrityScore: 2,
        mitigatedAvailabilityScore: 2,
        mitigatedLikelihood: 1,
        mitigatedScore: 6,
        mitigationDescription: 'Mitigation plan',
      };
      expect(hasPolicyNonConformance(risk)).toBe(false);
    });
  });

  describe('updateRiskControls', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update risk controls correctly', async () => {
      const riskId = 'risk-1';
      const controlCodes = ['A.1.1', 'A.1.2'];

      mockPrisma.control.findUnique
        .mockResolvedValueOnce({ id: 'control-1', code: 'A.1.1' })
        .mockResolvedValueOnce(null);

      mockPrisma.control.create.mockResolvedValueOnce({ id: 'control-2', code: 'A.1.2' });

      await updateRiskControls(riskId, controlCodes);

      expect(mockPrisma.riskControl.deleteMany).toHaveBeenCalledWith({ where: { riskId } });
      expect(mockPrisma.riskControl.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
