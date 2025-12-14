import {
  validateLifecycleTransition,
  determineNextState,
  requiresCisoApproval,
  canApproveSupplier,
  SupplierWithAssessments,
} from '../supplierLifecycleService';
import { SupplierLifecycleState } from '../../types/enums';

describe('supplierLifecycleService', () => {
  describe('validateLifecycleTransition', () => {
    it('should return true for any transition from DRAFT', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'DRAFT';
      const newState: SupplierLifecycleState = 'AWAITING_APPROVAL';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for any transition from AWAITING_APPROVAL', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'AWAITING_APPROVAL';
      const newState: SupplierLifecycleState = 'APPROVED';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for any transition from APPROVED', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'APPROVED';
      const newState: SupplierLifecycleState = 'EXIT_IN_PROGRESS';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for any transition from REJECTED', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'REJECTED';
      const newState: SupplierLifecycleState = 'DRAFT';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for any transition from IN_REVIEW', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'IN_REVIEW';
      const newState: SupplierLifecycleState = 'APPROVED';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for any transition from EXIT_IN_PROGRESS', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'EXIT_IN_PROGRESS';
      const newState: SupplierLifecycleState = 'DRAFT';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when supplier parameter is provided', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'DRAFT';
      const newState: SupplierLifecycleState = 'APPROVED';
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'SERVICE_PROVIDER',
        criticality: 'LOW',
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = validateLifecycleTransition(currentState, newState, supplier);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when supplier parameter is undefined', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'DRAFT';
      const newState: SupplierLifecycleState = 'APPROVED';

      // Act
      const result = validateLifecycleTransition(currentState, newState, undefined);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for same state transition', () => {
      // Arrange
      const currentState: SupplierLifecycleState = 'DRAFT';
      const newState: SupplierLifecycleState = 'DRAFT';

      // Act
      const result = validateLifecycleTransition(currentState, newState);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('determineNextState', () => {
    it('should return null for any supplier', async () => {
      // Arrange
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'SERVICE_PROVIDER',
        criticality: 'LOW',
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = await determineNextState(supplier);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for supplier with HIGH criticality', async () => {
      // Arrange
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'SERVICE_PROVIDER',
        criticality: 'HIGH',
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = await determineNextState(supplier);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for CONNECTED_ENTITY supplier', async () => {
      // Arrange
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'CONNECTED_ENTITY',
        criticality: 'LOW',
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = await determineNextState(supplier);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for PCI_SERVICE_PROVIDER supplier', async () => {
      // Arrange
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'PCI_SERVICE_PROVIDER',
        criticality: 'LOW',
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = await determineNextState(supplier);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for supplier with null criticality', async () => {
      // Arrange
      const supplier: SupplierWithAssessments = {
        id: 'test-id',
        lifecycleState: 'DRAFT',
        supplierType: 'SERVICE_PROVIDER',
        criticality: null,
        pciStatus: null,
        cisoExemptionGranted: false,
      };

      // Act
      const result = await determineNextState(supplier);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('requiresCisoApproval', () => {
    describe('RISK assessment type', () => {
      it('should return true when supplierType is CONNECTED_ENTITY', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when supplierType is PCI_SERVICE_PROVIDER', () => {
        // Arrange
        const supplier = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when supplier criticality is HIGH', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'HIGH' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when supplierType is SERVICE_PROVIDER and criticality is LOW', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when supplierType is SERVICE_PROVIDER and criticality is MEDIUM', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'MEDIUM' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when supplierType is SERVICE_PROVIDER and criticality is null', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(false);
      });

      it('should return true when supplierType is CONNECTED_ENTITY even if criticality is LOW', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when supplierType is PCI_SERVICE_PROVIDER even if criticality is MEDIUM', () => {
        // Arrange
        const supplier = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          criticality: 'MEDIUM' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'RISK');

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('CRITICALITY assessment type', () => {
      it('should return true when supplierType is CONNECTED_ENTITY', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when supplierType is PCI_SERVICE_PROVIDER', () => {
        // Arrange
        const supplier = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when assessment criticality is HIGH', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };
        const assessmentCriticality = 'HIGH';

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when supplier criticality is HIGH and assessment criticality is null', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'HIGH' as string | null,
        };
        const assessmentCriticality = null;

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when assessment criticality is HIGH even if supplier criticality is LOW', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };
        const assessmentCriticality = 'HIGH';

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when supplierType is SERVICE_PROVIDER, supplier criticality is LOW, and assessment criticality is LOW', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };
        const assessmentCriticality = 'LOW';

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when supplierType is SERVICE_PROVIDER, supplier criticality is null, and assessment criticality is MEDIUM', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };
        const assessmentCriticality = 'MEDIUM';

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when supplierType is SERVICE_PROVIDER, supplier criticality is null, and assessment criticality is null', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };
        const assessmentCriticality = null;

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(false);
      });

      it('should use assessment criticality when provided over supplier criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };
        const assessmentCriticality = 'HIGH';

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(true);
      });

      it('should fall back to supplier criticality when assessment criticality is null', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'HIGH' as string | null,
        };
        const assessmentCriticality = null;

        // Act
        const result = requiresCisoApproval(supplier, 'CRITICALITY', assessmentCriticality);

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  describe('canApproveSupplier', () => {
    describe('when CISO approval is required', () => {
      it('should return true when approverRole is ADMIN for CONNECTED_ENTITY', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is ADMIN for PCI_SERVICE_PROVIDER', () => {
        // Arrange
        const supplier = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is ADMIN for HIGH criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'HIGH' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when approverRole is EDITOR for CONNECTED_ENTITY', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when approverRole is EDITOR for PCI_SERVICE_PROVIDER', () => {
        // Arrange
        const supplier = {
          supplierType: 'PCI_SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when approverRole is EDITOR for HIGH criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'HIGH' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(false);
      });

      it('should return false when approverRole is CONTRIBUTOR for CONNECTED_ENTITY', () => {
        // Arrange
        const supplier = {
          supplierType: 'CONNECTED_ENTITY',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'CONTRIBUTOR');

        // Assert
        expect(result).toBe(false);
      });

      it('should return true when approverRole is ADMIN for CRITICALITY assessment with HIGH assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'HIGH', 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when approverRole is EDITOR for CRITICALITY assessment with HIGH assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'HIGH', 'EDITOR');

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('when CISO approval is not required', () => {
      it('should return true when approverRole is ADMIN for SERVICE_PROVIDER with LOW criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is EDITOR for SERVICE_PROVIDER with LOW criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is ADMIN for SERVICE_PROVIDER with MEDIUM criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'MEDIUM' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is EDITOR for SERVICE_PROVIDER with MEDIUM criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'MEDIUM' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is ADMIN for SERVICE_PROVIDER with null criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is EDITOR for SERVICE_PROVIDER with null criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'EDITOR');

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when approverRole is CONTRIBUTOR for SERVICE_PROVIDER with LOW criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'RISK', null, 'CONTRIBUTOR');

        // Assert
        expect(result).toBe(false);
      });

      it('should return true when approverRole is ADMIN for CRITICALITY assessment with LOW assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'LOW', 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is EDITOR for CRITICALITY assessment with LOW assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'LOW' as string | null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'LOW', 'EDITOR');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is ADMIN for CRITICALITY assessment with MEDIUM assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'MEDIUM', 'ADMIN');

        // Assert
        expect(result).toBe(true);
      });

      it('should return true when approverRole is EDITOR for CRITICALITY assessment with MEDIUM assessment criticality', () => {
        // Arrange
        const supplier = {
          supplierType: 'SERVICE_PROVIDER',
          criticality: null,
        };

        // Act
        const result = canApproveSupplier(supplier, 'CRITICALITY', 'MEDIUM', 'EDITOR');

        // Assert
        expect(result).toBe(true);
      });
    });
  });
});


