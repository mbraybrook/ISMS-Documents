import {
  calculateRiskScore,
  parseControlCodes,
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
});



