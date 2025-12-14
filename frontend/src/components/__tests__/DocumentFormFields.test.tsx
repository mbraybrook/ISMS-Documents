import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { DocumentFormFields } from '../DocumentFormFields';
import type { DocumentFormData, Document } from '../../utils/documentForm';

describe('DocumentFormFields', () => {
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
    lastReviewDate: '',
    nextReviewDate: '',
    requiresAcknowledgement: false,
    versionNotes: '',
  };

  const mockOnChange = vi.fn();
  const mockOnVersionUpdateClick = vi.fn();

  it('should render all form fields', () => {
    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    // Chakra UI generates dynamic IDs, so we need to find by text and then get the associated input
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Storage Location')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // Also verify the inputs exist - use getByRole for selects
    expect(screen.getByDisplayValue('Test Document')).toBeInTheDocument();
    const typeSelect = screen.getAllByRole('combobox').find(select => (select as HTMLSelectElement).value === 'POLICY');
    expect(typeSelect).toBeInTheDocument();
  });

  it('should display current form values', () => {
    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    expect(screen.getByDisplayValue('Test Document')).toBeInTheDocument();
    // For selects, check the value attribute
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.some(s => s.value === 'POLICY')).toBe(true);
    expect(selects.some(s => s.value === 'SHAREPOINT')).toBe(true);
    expect(screen.getByDisplayValue('1.0')).toBeInTheDocument();
    expect(selects.some(s => s.value === 'DRAFT')).toBe(true);
  });

  it('should call onChange when title changes', async () => {
    const user = userEvent.setup();
    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    // Find input by display value since label association might not work with dynamic IDs
    const titleInput = screen.getByDisplayValue('Test Document');
    // Type into the input - onChange should be called
    await user.click(titleInput);
    await user.type(titleInput, 'X');

    // Verify onChange was called (simplified - just check it was called with title)
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      // Check that at least one call includes title
      const calls = mockOnChange.mock.calls;
      const hasTitleCall = calls.some(call => 
        call[0] && typeof call[0] === 'object' && 'title' in call[0]
      );
      expect(hasTitleCall).toBe(true);
    }, { timeout: 2000 });
  });

  it('should set requiresAcknowledgement to true when type changes to POLICY', async () => {
    const user = userEvent.setup();
    const formDataWithProcedure = { ...mockFormData, type: 'PROCEDURE', requiresAcknowledgement: false };

    render(
      <DocumentFormFields
        formData={formDataWithProcedure}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    // Find select by role and value
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const typeSelect = selects.find(s => s.value === 'PROCEDURE');
    expect(typeSelect).toBeDefined();
    if (typeSelect) {
      await user.selectOptions(typeSelect, 'POLICY');
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      type: 'POLICY',
      requiresAcknowledgement: true,
    });
  });

  it('should not change requiresAcknowledgement when changing away from POLICY', async () => {
    const user = userEvent.setup();
    const formDataWithPolicy = { ...mockFormData, type: 'POLICY', requiresAcknowledgement: true };

    render(
      <DocumentFormFields
        formData={formDataWithPolicy}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    // Find select by role and value
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const typeSelect = selects.find(s => s.value === 'POLICY');
    expect(typeSelect).toBeDefined();
    if (typeSelect) {
      await user.selectOptions(typeSelect, 'PROCEDURE');
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      type: 'PROCEDURE',
      requiresAcknowledgement: true, // Should keep existing value
    });
  });

  it('should show version update button when document exists and not readOnly', () => {
    const mockDocument: Document = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: null,
      nextReviewDate: null,
      ownerUserId: 'user-1',
    };

    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        onVersionUpdateClick={mockOnVersionUpdateClick}
        document={mockDocument}
      />
    );

    expect(screen.getByRole('button', { name: /update version/i })).toBeInTheDocument();
  });

  it('should not show version update button for new documents', () => {
    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        document={null}
      />
    );

    expect(screen.queryByRole('button', { name: /update version/i })).not.toBeInTheDocument();
  });

  it('should not show version update button when readOnly', () => {
    const mockDocument: Document = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: null,
      nextReviewDate: null,
      ownerUserId: 'user-1',
    };

    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={true}
        document={mockDocument}
      />
    );

    expect(screen.queryByRole('button', { name: /update version/i })).not.toBeInTheDocument();
  });

  it('should show version notes field when editing existing document', () => {
    const mockDocument: Document = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: null,
      nextReviewDate: null,
      ownerUserId: 'user-1',
    };

    render(
      <DocumentFormFields
        formData={{ ...mockFormData, versionNotes: 'Some notes' }}
        onChange={mockOnChange}
        readOnly={false}
        document={mockDocument}
      />
    );

    expect(screen.getByLabelText('Version Notes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Some notes')).toBeInTheDocument();
  });

  it('should disable fields when readOnly', () => {
    render(
      <DocumentFormFields
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={true}
        document={null}
      />
    );

    // Find inputs by display value since label association might not work
    const titleInput = screen.getByDisplayValue('Test Document');
    expect(titleInput).toHaveAttribute('readonly');
    
    // Find selects by role and value
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const typeSelect = selects.find(s => s.value === 'POLICY');
    expect(typeSelect).toBeDefined();
    if (typeSelect) {
      expect(typeSelect).toBeDisabled();
    }
    
    const storageSelect = selects.find(s => s.value === 'SHAREPOINT');
    expect(storageSelect).toBeDefined();
    if (storageSelect) {
      expect(storageSelect).toBeDisabled();
    }
    
    const statusSelect = selects.find(s => s.value === 'DRAFT');
    expect(statusSelect).toBeDefined();
    if (statusSelect) {
      expect(statusSelect).toBeDisabled();
    }
  });
});

