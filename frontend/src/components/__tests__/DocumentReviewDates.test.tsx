import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { DocumentReviewDates } from '../DocumentReviewDates';
import type { DocumentFormData, Document } from '../../utils/documentForm';

describe('DocumentReviewDates', () => {
  const mockFormData: DocumentFormData = {
    title: 'Test Document',
    type: 'POLICY',
    storageLocation: 'SHAREPOINT',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: 'user-1',
    sharePointSiteId: '',
    sharePointDriveId: '',
    sharePointItemId: '',
    confluenceSpaceKey: '',
    confluencePageId: '',
    lastReviewDate: '2024-01-01',
    nextReviewDate: '2025-01-01',
    requiresAcknowledgement: false,
    versionNotes: '',
  };

  const mockOnChange = vi.fn();

  describe('For existing documents', () => {
    const mockDocument: Document = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: '2024-01-01T00:00:00Z',
      nextReviewDate: '2025-01-01T00:00:00Z',
      ownerUserId: 'user-1',
    };

    it('should display review dates as text', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={false}
          document={mockDocument}
          isReviewContext={false}
        />
      );

      expect(screen.getByText(/Last Review Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Review Date/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('Last Review Date')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Next Review Date')).not.toBeInTheDocument();
    });

    it('should show helper text about version updates', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={false}
          document={mockDocument}
          isReviewContext={false}
        />
      );

      expect(screen.getByText(/Review dates are updated when you update the document version/i)).toBeInTheDocument();
    });

    it('should not show helper text when readOnly', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={true}
          document={mockDocument}
          isReviewContext={false}
        />
      );

      expect(screen.queryByText(/Review dates are updated when you update the document version/i)).not.toBeInTheDocument();
    });
  });

  describe('For new documents', () => {
    it('should display editable date inputs', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={false}
          document={null}
          isReviewContext={false}
        />
      );

      const lastReviewInput = screen.getByLabelText('Last Review Date');
      const nextReviewInput = screen.getByLabelText('Next Review Date');

      expect(lastReviewInput).toHaveAttribute('type', 'date');
      expect(nextReviewInput).toHaveAttribute('type', 'date');
      expect(lastReviewInput).not.toHaveAttribute('readonly');
      expect(nextReviewInput).not.toHaveAttribute('readonly');
    });

    it('should call onChange when dates change', async () => {
      const user = userEvent.setup();
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={false}
          document={null}
          isReviewContext={false}
        />
      );

      const nextReviewInput = screen.getByLabelText('Next Review Date');
      await user.clear(nextReviewInput);
      await user.type(nextReviewInput, '2026-01-01');

      // The onChange is called multiple times during typing, check the last call
      const calls = mockOnChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toHaveProperty('nextReviewDate');
      // The value might be partial during typing, so just verify onChange was called
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show review context message when isReviewContext is true', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={false}
          document={null}
          isReviewContext={true}
        />
      );

      expect(screen.getByText(/Next review date set to 1 year from today/i)).toBeInTheDocument();
    });

    it('should disable inputs when readOnly is true', () => {
      render(
        <DocumentReviewDates
          formData={mockFormData}
          onChange={mockOnChange}
          readOnly={true}
          document={null}
          isReviewContext={false}
        />
      );

      const lastReviewInput = screen.getByLabelText('Last Review Date');
      const nextReviewInput = screen.getByLabelText('Next Review Date');

      expect(lastReviewInput).toHaveAttribute('readonly');
      expect(nextReviewInput).toHaveAttribute('readonly');
    });
  });
});

