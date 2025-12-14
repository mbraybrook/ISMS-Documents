import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { SharePointDocumentSection } from '../SharePointDocumentSection';
import type { DocumentFormData, Document } from '../../utils/documentForm';
import type { SharePointItem } from '../../hooks/useSharePointIntegration';

// Mock SharePointFileBrowser
vi.mock('../SharePointFileBrowser', () => ({
  SharePointFileBrowser: ({ isOpen, onClose, onSelect }: { isOpen: boolean; onClose: () => void; onSelect: (item: SharePointItem) => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="sharepoint-browser">
        <button onClick={() => onSelect({ id: 'item-1', name: 'Test File.docx', siteId: 'site-1', driveId: 'drive-1' })}>
          Select File
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
}));

describe('SharePointDocumentSection', () => {
  const mockFormData: DocumentFormData = {
    title: 'Test Document',
    type: 'POLICY',
    storageLocation: 'SHAREPOINT',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: 'user-1',
    sharePointSiteId: 'site-1',
    sharePointDriveId: 'drive-1',
    sharePointItemId: 'item-1',
    confluenceSpaceKey: '',
    confluencePageId: '',
    lastReviewDate: '',
    nextReviewDate: '',
    requiresAcknowledgement: false,
    versionNotes: '',
  };

  const mockOnFileSelect = vi.fn();
  const mockOnUrlParse = vi.fn();
  const mockSetSharePointUrl = vi.fn();
  const mockSetUrlError = vi.fn();
  const mockSetBrowserOpen = vi.fn();
  const mockOnToggleReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create mode', () => {
    it('should render URL input and browse button', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={null}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByPlaceholderText(/paste sharepoint file url/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /parse url/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse sharepoint files/i })).toBeInTheDocument();
    });

    it('should show selected file when sharePointItemId is set', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={null}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByText(/selected:/i)).toBeInTheDocument();
      expect(screen.getByText(/item id:/i)).toBeInTheDocument();
    });

    it('should call onUrlParse when parse button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={null}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl="https://sharepoint.com/file"
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      const parseButton = screen.getByRole('button', { name: /parse url/i });
      await user.click(parseButton);

      expect(mockOnUrlParse).toHaveBeenCalled();
    });

    it('should open browser when browse button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={null}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      const browseButton = screen.getByRole('button', { name: /browse sharepoint files/i });
      await user.click(browseButton);

      expect(mockSetBrowserOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('Edit mode', () => {
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
      sharePointSiteId: 'site-1',
      sharePointDriveId: 'drive-1',
      sharePointItemId: 'item-1',
      documentUrl: 'https://sharepoint.com/file',
    };

    it('should show document link when available', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={mockDocument}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl="https://sharepoint.com/file"
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByText(/open in sharepoint/i)).toBeInTheDocument();
    });

    it('should show loading message when loadingUrl is true', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={mockDocument}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={true}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByText(/loading document link/i)).toBeInTheDocument();
    });

    it('should show replace button when not readOnly', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={mockDocument}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl="https://sharepoint.com/file"
          loadingUrl={false}
          showReplaceOptions={false}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByRole('button', { name: /replace document/i })).toBeInTheDocument();
    });

    it('should show replace options when showReplaceOptions is true', () => {
      render(
        <SharePointDocumentSection
          formData={mockFormData}
          readOnly={false}
          document={mockDocument}
          onFileSelect={mockOnFileSelect}
          onUrlParse={mockOnUrlParse}
          sharePointUrl=""
          setSharePointUrl={mockSetSharePointUrl}
          parsingUrl={false}
          urlError={null}
          setUrlError={mockSetUrlError}
          documentUrl={null}
          loadingUrl={false}
          showReplaceOptions={true}
          onToggleReplace={mockOnToggleReplace}
          browserOpen={false}
          setBrowserOpen={mockSetBrowserOpen}
        />
      );

      expect(screen.getByText(/replace sharepoint document/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });
});


