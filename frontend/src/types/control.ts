
import { Risk } from './risk';
import { Supplier } from './supplier';

export interface Control {
    id: string;
    code: string;
    title: string;
    description?: string;
    selectedForRiskAssessment: boolean;
    selectedForContractualObligation: boolean;
    selectedForLegalRequirement: boolean;
    selectedForBusinessRequirement: boolean;
    justification?: string;
    controlText?: string;
    purpose?: string;
    guidance?: string;
    otherInformation?: string;
    category?: string;
    isStandardControl: boolean;
    implemented: boolean;
    createdAt: string;
    updatedAt: string;
    // Relations (optional/partial depending on query)
    riskControls?: Array<{
        riskId: string;
        controlId: string;
        risk: Risk;
    }>;
    supplierControls?: Array<{
        supplierId: string;
        controlId: string;
        supplier: Supplier;
    }>;
}

export type ControlCategory = 'ORGANIZATIONAL' | 'PEOPLE' | 'PHYSICAL' | 'TECHNOLOGICAL';
