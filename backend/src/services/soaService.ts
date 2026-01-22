import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';

/**
 * Parse control code into sortable parts
 * Handles formats like "A.5.1", "5.1", "7.10", etc.
 * Returns an array of [prefix, major, minor] for numeric comparison
 */
function parseControlCode(code: string): [string, number, number] {
  // Match patterns like "A.5.1" or "5.1" or "7.10"
  const match = code.match(/^([A-Z]\.)?(\d+)\.(\d+)$/);
  if (!match) {
    // If pattern doesn't match, return as-is for string comparison
    return [code, 0, 0];
  }
  
  const prefix = match[1] || '';
  const major = parseInt(match[2], 10);
  const minor = parseInt(match[3], 10);
  
  return [prefix, major, minor];
}

/**
 * Compare two control codes for natural/numeric sorting
 */
function compareControlCodes(a: string, b: string): number {
  const [prefixA, majorA, minorA] = parseControlCode(a);
  const [prefixB, majorB, minorB] = parseControlCode(b);
  
  // First compare prefix (alphabetically)
  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB);
  }
  
  // Then compare major number (numerically)
  if (majorA !== majorB) {
    return majorA - majorB;
  }
  
  // Finally compare minor number (numerically)
  return minorA - minorB;
}

export interface SoARow {
  controlCode: string;
  controlTitle: string;
  applicable: 'Yes' | 'No';
  implemented: 'Yes' | 'No';
  selectionReasons: string; // Comma-separated list of reasons
  justification: string;
  linkedRiskIds: string[];
  linkedRiskCount: number;
  linkedDocumentTitles: string[];
  linkedDocumentCount: number;
}

/**
 * Generate SoA data structure from controls, risks, and documents
 */
export async function generateSoAData(): Promise<SoARow[]> {
  // Get all controls (no orderBy - we'll sort in memory for natural sort)
  const controls = await prisma.control.findMany({
    include: {
      riskControls: {
        include: {
          risk: {
            select: {
              id: true,
              title: true,
              archived: true,
            },
          },
        },
      },
      documentControls: {
        include: {
          document: {
            select: {
              id: true,
              title: true,
              version: true,
            },
          },
        },
      },
    },
  });

  // Sort controls using natural/numeric sort for control codes
  controls.sort((a, b) => compareControlCodes(a.code, b.code));

  // Build SoA rows
  const soaRows: SoARow[] = controls.map((control: {
    id: string;
    code: string;
    title: string;
    implemented: boolean;
    riskControls: Array<{ risk: { id: string; archived: boolean } }>;
    documentControls: Array<{ document: { title: string; version: string } }>;
    selectedForRiskAssessment: boolean;
    selectedForContractualObligation: boolean;
    selectedForLegalRequirement: boolean;
    selectedForBusinessRequirement: boolean;
    justification: string | null;
  }) => {
    // Filter out archived risks - only include active risks
    const activeRiskControls = control.riskControls.filter(
      (rc: { risk: { id: string; archived: boolean } }) => !rc.risk.archived
    );
    const riskIds = activeRiskControls.map((rc: { risk: { id: string } }) => rc.risk.id);
    const documentTitles = control.documentControls.map(
      (dc: { document: { title: string; version: string } }) => `${dc.document.title} (v${dc.document.version})`
    );

    // Determine if control is applicable (any selection reason is true)
    const isApplicable = 
      control.selectedForRiskAssessment ||
      control.selectedForContractualObligation ||
      control.selectedForLegalRequirement ||
      control.selectedForBusinessRequirement;

    // Build list of selection reasons
    const reasons: string[] = [];
    if (control.selectedForRiskAssessment) {
      reasons.push('Risk Assessment');
    }
    if (control.selectedForContractualObligation) {
      reasons.push('Contractual Obligation');
    }
    if (control.selectedForLegalRequirement) {
      reasons.push('Legal Requirement');
    }
    if (control.selectedForBusinessRequirement) {
      reasons.push('Business Requirement/Best Practice');
    }

    const selectionReasons = reasons.length > 0 
      ? reasons.join(', ')
      : 'Not applicable';

    return {
      controlCode: control.code,
      controlTitle: control.title || '',
      applicable: isApplicable ? 'Yes' : 'No',
      implemented: control.implemented ? 'Yes' : 'No',
      selectionReasons,
      justification: control.justification || '',
      linkedRiskIds: riskIds,
      linkedRiskCount: riskIds.length,
      linkedDocumentTitles: documentTitles,
      linkedDocumentCount: documentTitles.length,
    };
  });

  return soaRows;
}

/**
 * Generate Excel file from SoA data
 */
export async function generateSoAExcel(soaData: SoARow[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Statement of Applicability');

  // Define columns
  worksheet.columns = [
    { header: 'Control Code', key: 'controlCode', width: 15 },
    { header: 'Control Title', key: 'controlTitle', width: 40 },
    { header: 'Applicable', key: 'applicable', width: 12 },
    { header: 'Implemented', key: 'implemented', width: 12 },
    { header: 'Selection Reason(s)', key: 'selectionReasons', width: 40 },
    { header: 'Justification', key: 'justification', width: 50 },
    { header: 'Linked Risks', key: 'linkedRiskCount', width: 12 },
    { header: 'Linked Documents', key: 'linkedDocumentCount', width: 15 },
    { header: 'Document Titles', key: 'linkedDocumentTitles', width: 50 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  soaData.forEach((row) => {
    worksheet.addRow({
      controlCode: row.controlCode,
      controlTitle: row.controlTitle,
      applicable: row.applicable,
      implemented: row.implemented,
      selectionReasons: row.selectionReasons,
      justification: row.justification,
      linkedRiskCount: row.linkedRiskCount,
      linkedDocumentCount: row.linkedDocumentCount,
      linkedDocumentTitles: row.linkedDocumentTitles.join('; '),
    });
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ExcelJS.Buffer;
}

