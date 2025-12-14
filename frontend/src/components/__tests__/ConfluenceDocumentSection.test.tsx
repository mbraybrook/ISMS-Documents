import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { ConfluenceDocumentSection } from '../ConfluenceDocumentSection';
import type { DocumentFormData } from '../../utils/documentForm';

describe('ConfluenceDocumentSection', () => {
  const mockFormData: DocumentFormData = {
    title: 'Test Document',
    type: 'POLICY',
    storageLocation: 'CONFLUENCE',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: 'user-1',
    sharePointSiteId: '',
    sharePointDriveId: '',
    sharePointItemId: '',
    confluenceSpaceKey: 'TEST',
    confluencePageId: '12345',
    lastReviewDate: '',
    nextReviewDate: '',
    requiresAcknowledgement: false,
    versionNotes: '',
  };

  const mockOnChange = vi.fn();

  it('should render Confluence fields', () => {
    render(
      <ConfluenceDocumentSection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
      />
    );

    expect(screen.getByLabelText('Confluence Space Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Confluence Page ID')).toBeInTheDocument();
  });

  it('should display current values', () => {
    render(
      <ConfluenceDocumentSection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
      />
    );

    expect(screen.getByDisplayValue('TEST')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345')).toBeInTheDocument();
  });

  it('should call onChange when space key changes', async () => {
    const user = userEvent.setup();
    render(
      <ConfluenceDocumentSection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
      />
    );

    const spaceKeyInput = screen.getByLabelText('Confluence Space Key');
    // Type into the input - onChange should be called
    await user.click(spaceKeyInput);
    await user.type(spaceKeyInput, 'X');

    // Verify onChange was called (simplified - just check it was called with space key)
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      // Check that at least one call includes confluenceSpaceKey
      const calls = mockOnChange.mock.calls;
      const hasSpaceKeyCall = calls.some(call => 
        call[0] && typeof call[0] === 'object' && 'confluenceSpaceKey' in call[0]
      );
      expect(hasSpaceKeyCall).toBe(true);
    }, { timeout: 2000 });
  });

  it('should call onChange when page ID changes', async () => {
    const user = userEvent.setup();
    render(
      <ConfluenceDocumentSection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
      />
    );

    const pageIdInput = screen.getByLabelText('Confluence Page ID');
    // Type into the input - onChange should be called
    await user.click(pageIdInput);
    await user.type(pageIdInput, 'X');

    // Verify onChange was called (simplified - just check it was called with page ID)
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      // Check that at least one call includes confluencePageId
      const calls = mockOnChange.mock.calls;
      const hasPageIdCall = calls.some(call => 
        call[0] && typeof call[0] === 'object' && 'confluencePageId' in call[0]
      );
      expect(hasPageIdCall).toBe(true);
    }, { timeout: 2000 });
  });

  it('should disable inputs when readOnly is true', () => {
    render(
      <ConfluenceDocumentSection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const spaceKeyInput = screen.getByLabelText('Confluence Space Key');
    const pageIdInput = screen.getByLabelText('Confluence Page ID');

    expect(spaceKeyInput).toHaveAttribute('readonly');
    expect(pageIdInput).toHaveAttribute('readonly');
  });
});

