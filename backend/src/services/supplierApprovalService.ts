import { SupplierType, PciStatus } from '../types/enums';

export interface SupplierForApproval {
  supplierType: SupplierType;
  pciStatus: PciStatus | null;
  cisoExemptionGranted: boolean;
  criticality: string | null;
}

/**
 * Validates if a supplier can be approved based on PCI policy rules
 * @param supplier Supplier data
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePciApprovalRule(supplier: SupplierForApproval): {
  isValid: boolean;
  error?: string;
} {
  // PCI validation: Supplier cannot be APPROVED if supplierType = PCI_SERVICE_PROVIDER
  // and pciStatus is not PASS or NOT_APPLICABLE, unless cisoExemptionGranted = true
  if (supplier.supplierType === 'PCI_SERVICE_PROVIDER') {
    const validPciStatuses: (PciStatus | null)[] = ['PASS', 'NOT_APPLICABLE'];
    
    if (!supplier.cisoExemptionGranted && !validPciStatuses.includes(supplier.pciStatus)) {
      return {
        isValid: false,
        error: 'PCI Service Providers must have PCI status of PASS or NOT_APPLICABLE to be approved, unless CISO exemption is granted',
      };
    }
  }

  return { isValid: true };
}

/**
 * Gets the list of approval requirements for a supplier
 * @param supplier Supplier data
 * @returns Array of requirement descriptions
 */
export function getApprovalRequirements(supplier: SupplierForApproval): string[] {
  const requirements: string[] = [];

  if (supplier.supplierType === 'CONNECTED_ENTITY') {
    requirements.push('CISO approval required (Connected Entity)');
  }

  if (supplier.supplierType === 'PCI_SERVICE_PROVIDER') {
    requirements.push('CISO approval required (PCI Service Provider)');
    
    if (!supplier.cisoExemptionGranted) {
      const validPciStatuses: (PciStatus | null)[] = ['PASS', 'NOT_APPLICABLE'];
      if (!validPciStatuses.includes(supplier.pciStatus)) {
        requirements.push('PCI status must be PASS or NOT_APPLICABLE (or CISO exemption required)');
      }
    }
  }

  if (supplier.criticality === 'HIGH') {
    requirements.push('CISO approval required (High Criticality)');
  }

  if (requirements.length === 0) {
    requirements.push('Editor or Admin approval required');
  }

  return requirements;
}


