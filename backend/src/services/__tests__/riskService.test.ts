import {
  calculateRiskScore,
  parseControlCodes,
  validateStatusTransition,
  calculateCIAFromWizard,
} from '../riskService';

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
      const result = parseControlCodes('A.8.3,A.5.9,A.8.24');
      expect(result).toEqual(['A.8.3', 'A.5.9', 'A.8.24']);
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
      // ADMIN and EDITOR can set any status (for flexibility)
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
    it('should calculate CIA scores from impact level 1', () => {
      const result = calculateCIAFromWizard(1);
      expect(result.c).toBe(1);
      expect(result.i).toBe(1);
      expect(result.a).toBe(1);
    });

    it('should calculate CIA scores from impact level 2', () => {
      const result = calculateCIAFromWizard(2);
      expect(result.c).toBe(2);
      expect(result.i).toBe(2);
      expect(result.a).toBe(2);
    });

    it('should calculate CIA scores from impact level 3', () => {
      const result = calculateCIAFromWizard(3);
      expect(result.c).toBe(3);
      expect(result.i).toBe(3);
      expect(result.a).toBe(3);
    });

    it('should calculate CIA scores from impact level 4', () => {
      const result = calculateCIAFromWizard(4);
      expect(result.c).toBe(4);
      expect(result.i).toBe(4);
      expect(result.a).toBe(4);
    });

    it('should calculate CIA scores from impact level 5', () => {
      const result = calculateCIAFromWizard(5);
      expect(result.c).toBe(5);
      expect(result.i).toBe(5);
      expect(result.a).toBe(5);
    });

    it('should handle edge cases', () => {
      const result1 = calculateCIAFromWizard(0);
      expect(result1.c).toBe(1);
      expect(result1.i).toBe(1);
      expect(result1.a).toBe(1);

      const result2 = calculateCIAFromWizard(6);
      expect(result2.c).toBe(5);
      expect(result2.i).toBe(5);
      expect(result2.a).toBe(5);
    });
  });
});




