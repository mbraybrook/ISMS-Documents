import {
  validatePciApprovalRule,
  getApprovalRequirements,
  SupplierForApproval,
} from '../supplierApprovalService';

describe('supplierApprovalService', () => {
  describe('validatePciApprovalRule', () => {
    describe('PCI_SERVICE_PROVIDER validation', () => {
      it('should return valid when PCI status is PASS', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'PASS',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return valid when PCI status is NOT_APPLICABLE', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'NOT_APPLICABLE',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return invalid when PCI status is FAIL without exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'PCI Service Providers must have PCI status of PASS or NOT_APPLICABLE to be approved, unless CISO exemption is granted',
        );
      });

      it('should return invalid when PCI status is UNKNOWN without exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'UNKNOWN',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'PCI Service Providers must have PCI status of PASS or NOT_APPLICABLE to be approved, unless CISO exemption is granted',
        );
      });

      it('should return invalid when PCI status is null without exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'PCI Service Providers must have PCI status of PASS or NOT_APPLICABLE to be approved, unless CISO exemption is granted',
        );
      });

      it('should return valid when PCI status is FAIL with exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: true,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return valid when PCI status is UNKNOWN with exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'UNKNOWN',
          cisoExemptionGranted: true,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return valid when PCI status is null with exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: true,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('Non-PCI_SERVICE_PROVIDER types', () => {
      it('should return valid for SERVICE_PROVIDER type', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return valid for CONNECTED_ENTITY type', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'CONNECTED_ENTITY',
          pciStatus: 'UNKNOWN',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const result = validatePciApprovalRule(supplier);

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('getApprovalRequirements', () => {
    describe('CONNECTED_ENTITY requirements', () => {
      it('should include CISO approval requirement for CONNECTED_ENTITY', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'CONNECTED_ENTITY',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (Connected Entity)');
        expect(requirements.length).toBeGreaterThan(0);
      });

      it('should include CISO approval requirement for CONNECTED_ENTITY with HIGH criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'CONNECTED_ENTITY',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: 'HIGH',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (Connected Entity)');
        expect(requirements).toContain('CISO approval required (High Criticality)');
      });
    });

    describe('PCI_SERVICE_PROVIDER requirements', () => {
      it('should include CISO approval requirement for PCI_SERVICE_PROVIDER', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'PASS',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
      });

      it('should include PCI status requirement when status is invalid and no exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should include PCI status requirement when status is UNKNOWN and no exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'UNKNOWN',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should include PCI status requirement when status is null and no exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should not include PCI status requirement when status is PASS', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'PASS',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).not.toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should not include PCI status requirement when status is NOT_APPLICABLE', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'NOT_APPLICABLE',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).not.toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should not include PCI status requirement when exemption is granted', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: true,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).not.toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
      });

      it('should include both CISO and PCI requirements when status is invalid and no exemption', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'UNKNOWN',
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
        expect(requirements.length).toBe(2);
      });
    });

    describe('HIGH criticality requirements', () => {
      it('should include CISO approval requirement for HIGH criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: 'HIGH',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (High Criticality)');
      });

      it('should not include CISO approval requirement for LOW criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: 'LOW',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).not.toContain('CISO approval required (High Criticality)');
      });

      it('should not include CISO approval requirement for MEDIUM criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: 'MEDIUM',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).not.toContain('CISO approval required (High Criticality)');
      });

      it('should not include CISO approval requirement when criticality is null', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).not.toContain('CISO approval required (High Criticality)');
      });
    });

    describe('Default requirements', () => {
      it('should return Editor or Admin approval when no special requirements', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: 'LOW',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('Editor or Admin approval required');
        expect(requirements.length).toBe(1);
      });

      it('should return Editor or Admin approval when criticality is null', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: null,
          cisoExemptionGranted: false,
          criticality: null,
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('Editor or Admin approval required');
        expect(requirements.length).toBe(1);
      });
    });

    describe('Combined requirements', () => {
      it('should include all requirements for PCI_SERVICE_PROVIDER with HIGH criticality and invalid PCI status', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'FAIL',
          cisoExemptionGranted: false,
          criticality: 'HIGH',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
        expect(requirements).toContain('CISO approval required (High Criticality)');
        expect(requirements.length).toBe(3);
      });

      it('should include CISO requirements for CONNECTED_ENTITY with HIGH criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'CONNECTED_ENTITY',
          pciStatus: 'PASS',
          cisoExemptionGranted: false,
          criticality: 'HIGH',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (Connected Entity)');
        expect(requirements).toContain('CISO approval required (High Criticality)');
        expect(requirements.length).toBe(2);
      });

      it('should include only CISO requirement for PCI_SERVICE_PROVIDER with valid PCI status and HIGH criticality', () => {
        // Arrange
        const supplier: SupplierForApproval = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          pciStatus: 'PASS',
          cisoExemptionGranted: false,
          criticality: 'HIGH',
        };

        // Act
        const requirements = getApprovalRequirements(supplier);

        // Assert
        expect(requirements).toContain('CISO approval required (PCI Service Provider)');
        expect(requirements).toContain('CISO approval required (High Criticality)');
        expect(requirements).not.toContain(
          'PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)',
        );
        expect(requirements.length).toBe(2);
      });
    });
  });
});


