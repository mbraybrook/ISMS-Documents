import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { DocumentOwnerSelection } from '../DocumentOwnerSelection';
import type { DocumentFormData } from '../../utils/documentForm';
import type { UserForOwner } from '../../hooks/useDocumentUsers';

describe('DocumentOwnerSelection', () => {
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

  const mockUsers: UserForOwner[] = [
    { id: 'user-1', displayName: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
    { id: 'user-2', displayName: 'Editor User', email: 'editor@example.com', role: 'EDITOR' },
  ];

  const mockOnChange = vi.fn();

  it('should render owner selection dropdown', () => {
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        users={mockUsers}
        loadingUsers={false}
      />
    );

    // Chakra UI uses dynamic IDs, so find by text instead
    expect(screen.getByText('Owner')).toBeInTheDocument();
    // Verify the select exists by finding it via role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display users in dropdown', () => {
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        users={mockUsers}
        loadingUsers={false}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // Select might have a placeholder option, so check for at least 2 user options
    expect(select.options.length).toBeGreaterThanOrEqual(2);
    // Find options by their text content
    const optionTexts = Array.from(select.options).map(opt => opt.text);
    expect(optionTexts.some(text => text.includes('Admin User'))).toBe(true);
    expect(optionTexts.some(text => text.includes('Editor User'))).toBe(true);
  });

  it('should show loading placeholder when loadingUsers is true', () => {
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        users={[]}
        loadingUsers={true}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDisabled();
    // Chakra UI Select uses placeholder prop, check if it's disabled and has placeholder option
    // The placeholder shows as the first option when no value is selected
    expect(select.options.length).toBeGreaterThan(0);
    // Check that the select is disabled (which indicates loading state)
    expect(select.disabled).toBe(true);
  });

  it('should call onChange when owner changes', async () => {
    const user = userEvent.setup();
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        users={mockUsers}
        loadingUsers={false}
      />
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'user-2');

    expect(mockOnChange).toHaveBeenCalledWith({ ownerUserId: 'user-2' });
  });

  it('should disable select when readOnly is true', () => {
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={true}
        users={mockUsers}
        loadingUsers={false}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('should show helper text about owner roles', () => {
    render(
      <DocumentOwnerSelection
        formData={mockFormData}
        onChange={mockOnChange}
        readOnly={false}
        users={mockUsers}
        loadingUsers={false}
      />
    );

    expect(screen.getByText(/Only Admin and Editor roles can be assigned as document owners/i)).toBeInTheDocument();
  });
});

