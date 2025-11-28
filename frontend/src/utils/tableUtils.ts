/**
 * Utility functions for table operations
 */

/**
 * Formats a boolean value as "Yes" or "No"
 */
export const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return 'No';
  return value ? 'Yes' : 'No';
};

/**
 * Formats an empty/null value for display
 */
export const formatEmptyValue = (value: any): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
};

/**
 * Generates CSV content from data
 */
export const generateCSV = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string
): void => {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const cellValue = cell === null || cell === undefined ? '' : String(cell);
          return `"${cellValue.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Default page size
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Default page size options
 */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

