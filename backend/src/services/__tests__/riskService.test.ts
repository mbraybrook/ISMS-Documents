/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  calculateRiskScore,
  parseControlCodes,
  normalizeControlCode,
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
      // (C + I + A) * likelihood
      expect(calculateRiskScore(3, 4, 5, 2)).toBe(24); // (3+4+5) * 2 = 24
      expect(calculateRiskScore(1, 1, 1, 1)).toBe(3); // (1+1+1) * 1 = 3
      expect(calculateRiskScore(5, 5, 5, 5)).toBe(75); // (5+5+5) * 5 = 75
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
      const result = parseControlCodes('A.8.3');
      expect(result).toEqual(['A.8.3']);
    });

    it('should return empty array for null/undefined', () => {
      expect(parseControlCodes(null)).toEqual([]);
      expect(parseControlCodes(undefined)).toEqual([]);
      expect(parseControlCodes('')).toEqual([]);
    });

    it('should filter out empty strings', () => {
      const result = parseControlCodes('A.8.3, , A.5.9');
      expect(result).toEqual(['A.8.3', 'A.5.9']);
    });
  });

  describe('normalizeControlCode', () => {
    it('should remove "A." prefix from control codes', () => {
      expect(normalizeControlCode('A.8.25')).toBe('8.25');
      expect(normalizeControlCode('A.5.9')).toBe('5.9');
      expect(normalizeControlCode('A.1.1')).toBe('1.1');
    });

    it('should handle codes without "A." prefix', () => {
      expect(normalizeControlCode('8.25')).toBe('8.25');
      expect(normalizeControlCode('5.9')).toBe('5.9');
    });

    it('should handle case-insensitive prefix removal', () => {
      expect(normalizeControlCode('a.8.25')).toBe('8.25');
      expect(normalizeControlCode('A.8.25')).toBe('8.25');
    });

    it('should trim whitespace', () => {
      expect(normalizeControlCode('  A.8.25  ')).toBe('8.25');
      expect(normalizeControlCode('  8.25  ')).toBe('8.25');
    });

    it('should not remove "A." from middle of code', () => {
      expect(normalizeControlCode('8.A.25')).toBe('8.A.25');
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
      expect(validateStatusTransition('ACTIVE', 'ARCHIVED', 'EDITOR')).toBe(true);
    });

    it('should not allow CONTRIBUTOR to archive ACTIVE risks', () => {
      // CONTRIBUTOR can only transition DRAFT -> PROPOSED
      expect(validateStatusTransition('ACTIVE', 'ARCHIVED', 'CONTRIBUTOR')).toBe(false);
    });

    it('should allow ADMIN/EDITOR to make any transition', () => {
      // ADMIN and EDITOR have flexibility to set any status
      expect(validateStatusTransition('ACTIVE', 'DRAFT', 'ADMIN')).toBe(true);
      expect(validateStatusTransition('REJECTED', 'ACTIVE', 'ADMIN')).toBe(true);
      expect(validateStatusTransition('ACTIVE', 'DRAFT', 'EDITOR')).toBe(true);
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

      // Mock findUnique for exact matches
      mockPrisma.control.findUnique
        .mockResolvedValueOnce({ id: 'control-1', code: 'A.1.1', isStandardControl: false })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // Second call for normalized lookup

      // Mock findMany for normalized lookup (returns empty)
      mockPrisma.control.findMany.mockResolvedValueOnce([]);

      mockPrisma.control.create.mockResolvedValueOnce({ id: 'control-2', code: 'A.1.2' });

      await updateRiskControls(riskId, controlCodes);

      expect(mockPrisma.riskControl.deleteMany).toHaveBeenCalledWith({ where: { riskId } });
      expect(mockPrisma.riskControl.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should find standard control when code has "A." prefix but standard control does not', async () => {
      const riskId = 'risk-1';
      const controlCodes = ['A.8.25'];

      // First lookup fails (exact match)
      mockPrisma.control.findUnique
        .mockResolvedValueOnce(null) // No exact match for "A.8.25"
        .mockResolvedValueOnce(null); // No match for "8.25" either

      // findMany finds the standard control
      mockPrisma.control.findMany.mockResolvedValueOnce([
        { id: 'standard-control-1', code: '8.25', isStandardControl: true },
      ]);

      await updateRiskControls(riskId, controlCodes);

      // Should use the standard control, not create a new one
      expect(mockPrisma.control.create).not.toHaveBeenCalled();
      expect(mockPrisma.riskControl.create).toHaveBeenCalledWith({
        data: {
          riskId,
          controlId: 'standard-control-1',
        },
      });
    });

    it('should find standard control when code does not have "A." prefix but standard control does', async () => {
      const riskId = 'risk-1';
      const controlCodes = ['8.25'];

      // First lookup finds nothing
      mockPrisma.control.findUnique
        .mockResolvedValueOnce(null) // No exact match for "8.25"
        .mockResolvedValueOnce({ id: 'standard-control-1', code: 'A.8.25', isStandardControl: true });

      await updateRiskControls(riskId, controlCodes);

      // Should use the standard control, not create a new one
      expect(mockPrisma.control.create).not.toHaveBeenCalled();
      expect(mockPrisma.riskControl.create).toHaveBeenCalledWith({
        data: {
          riskId,
          controlId: 'standard-control-1',
        },
      });
    });

    it('should prefer standard control over custom control when both exist', async () => {
      const riskId = 'risk-1';
      const controlCodes = ['8.25'];

      // First lookup finds nothing
      mockPrisma.control.findUnique
        .mockResolvedValueOnce(null) // No exact match for "8.25"
        .mockResolvedValueOnce(null); // No match for "A.8.25" either

      // findMany finds both standard and custom
      mockPrisma.control.findMany.mockResolvedValueOnce([
        { id: 'custom-control-1', code: '8.25', isStandardControl: false },
        { id: 'standard-control-1', code: 'A.8.25', isStandardControl: true },
      ]);

      await updateRiskControls(riskId, controlCodes);

      // Should use the standard control
      expect(mockPrisma.control.create).not.toHaveBeenCalled();
      expect(mockPrisma.riskControl.create).toHaveBeenCalledWith({
        data: {
          riskId,
          controlId: 'standard-control-1',
        },
      });
    });
  });
});
