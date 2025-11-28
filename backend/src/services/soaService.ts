import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';

export interface SoARow {
  controlCode: string;
  controlTitle: string;
  applicable: 'Yes' | 'No';
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
  // Get all controls
  const controls = await prisma.control.findMany({
    include: {
      riskControls: {
        include: {
          risk: {
            select: {
              id: true,
              externalId: true,
              title: true,
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
    orderBy: {
      code: 'asc',
    },
  });

  // Build SoA rows
  const soaRows: SoARow[] = controls.map((control) => {
    const riskIds = control.riskControls.map((rc) => rc.risk.id);
    const documentTitles = control.documentControls.map(
      (dc) => `${dc.document.title} (v${dc.document.version})`
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
    { header: 'Selection Reason(s)', key: 'selectionReasons', width: 40 },
    { header: 'Justification', key: 'justification', width: 50 },
    { header: 'Linked Risks', key: 'linkedRiskCount', width: 12 },
    { header: 'Risk IDs', key: 'linkedRiskIds', width: 30 },
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
      selectionReasons: row.selectionReasons,
      justification: row.justification,
      linkedRiskCount: row.linkedRiskCount,
      linkedRiskIds: row.linkedRiskIds.join(', '),
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

