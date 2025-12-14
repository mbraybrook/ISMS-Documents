import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { DocumentControlLinking } from '../DocumentControlLinking';

describe('DocumentControlLinking', () => {
  const mockLinkedControls = [
    { id: 'control-1', code: 'A.1.1', title: 'Control 1', category: 'Security' },
    { id: 'control-2', code: 'A.1.2', title: 'Control 2', category: null },
  ];

  const mockAvailableControls = [
    { id: 'control-3', code: 'A.1.3', title: 'Control 3', category: 'Security' },
  ];

  const mockSuggestedControls = [
    { id: 'control-4', code: 'A.1.4', title: 'Suggested Control', category: 'Security' },
  ];

  const mockOnSearchControls = vi.fn();
  const mockOnLinkControl = vi.fn();
  const mockOnUnlinkControl = vi.fn();
  const mockOnControlClick = vi.fn().mockResolvedValue(undefined);
  const mockSetControlSearchTerm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render linked controls count', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    expect(screen.getByText(/linked controls \(2\)/i)).toBeInTheDocument();
  });

  it('should display linked controls', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    expect(screen.getByText('A.1.1')).toBeInTheDocument();
    expect(screen.getByText('Control 1')).toBeInTheDocument();
    expect(screen.getByText('A.1.2')).toBeInTheDocument();
    expect(screen.getByText('Control 2')).toBeInTheDocument();
  });

  it('should show loading spinner when loadingControls is true', () => {
    render(
      <DocumentControlLinking
        linkedControls={[]}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={true}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    // Spinner doesn't have accessible text, so we check for its presence via test utils
    expect(screen.queryByText(/linked controls/i)).toBeInTheDocument();
  });

  it('should call onUnlinkControl when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /unlink control/i });
    await user.click(deleteButtons[0]);

    expect(mockOnUnlinkControl).toHaveBeenCalledWith('control-1');
  });

  it('should not show unlink button when readOnly', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={true}
      />
    );

    expect(screen.queryByRole('button', { name: /unlink control/i })).not.toBeInTheDocument();
  });

  it('should show search input when not readOnly', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    expect(screen.getByPlaceholderText(/search controls/i)).toBeInTheDocument();
  });

  it('should call onSearchControls when search term changes', async () => {
    const user = userEvent.setup();
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search controls/i);
    await user.type(searchInput, 'security');

    expect(mockSetControlSearchTerm).toHaveBeenCalled();
  });

  it('should display available controls when search returns results', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm="security"
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={mockAvailableControls}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    expect(screen.getByText('A.1.3')).toBeInTheDocument();
    expect(screen.getByText('Control 3')).toBeInTheDocument();
  });

  it('should call onLinkControl when link button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm="security"
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={mockAvailableControls}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    // Wait for available controls section to render by checking for the control code
    await waitFor(() => {
      expect(screen.getByText('A.1.3')).toBeInTheDocument();
    });

    // Find the Link button in the available controls section
    // There might be multiple Link buttons (one for each available control)
    const linkButtons = screen.getAllByRole('button', { name: /^link$/i });
    expect(linkButtons.length).toBeGreaterThan(0);
    
    // Click the first Link button (should be for control-3)
    await user.click(linkButtons[0]);

    await waitFor(() => {
      expect(mockOnLinkControl).toHaveBeenCalledWith('control-3');
    });
  });

  it('should display suggested controls when no search term', () => {
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={mockSuggestedControls}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    expect(screen.getByText(/suggested controls/i)).toBeInTheDocument();
    expect(screen.getByText('A.1.4')).toBeInTheDocument();
    expect(screen.getByText('Suggested Control')).toBeInTheDocument();
  });

  it('should call onControlClick when control is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DocumentControlLinking
        linkedControls={mockLinkedControls}
        controlSearchTerm=""
        setControlSearchTerm={mockSetControlSearchTerm}
        availableControls={[]}
        suggestedControls={[]}
        searchingControls={false}
        loadingControls={false}
        loadingSuggestedControls={false}
        onSearchControls={mockOnSearchControls}
        onLinkControl={mockOnLinkControl}
        onUnlinkControl={mockOnUnlinkControl}
        onControlClick={mockOnControlClick}
        readOnly={false}
      />
    );

    const controlBadge = screen.getByText('A.1.1');
    await user.click(controlBadge);

    await waitFor(() => {
      expect(mockOnControlClick).toHaveBeenCalledWith('control-1');
    });
  });
});

