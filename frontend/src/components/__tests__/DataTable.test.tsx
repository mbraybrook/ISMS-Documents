import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { DataTable, Column, FilterConfig, ActionButton, PaginationConfig, SortConfig, CSVExportConfig } from '../DataTable';
import { generateCSV } from '../../utils/tableUtils';
import { EditIcon, DeleteIcon } from '@chakra-ui/icons';

// Mock tableUtils
vi.mock('../../utils/tableUtils', () => ({
  generateCSV: vi.fn(),
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}));

// Mock URL.createObjectURL and related DOM APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Helper to render DataTable with ChakraProvider
const renderDataTable = <T,>(props: React.ComponentProps<typeof DataTable<T>>) => {
  return render(
    <ChakraProvider>
      <DataTable {...props} />
    </ChakraProvider>
  );
};

// Test data types
interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
}

describe('DataTable', () => {
  const mockUsers: TestUser[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'ADMIN', active: true },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'USER', active: false },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'ADMIN', active: true },
  ];

  const basicColumns: Column<TestUser>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render table with data', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should render title when provided', () => {
      // Arrange
      const props = {
        title: 'Users Table',
        data: mockUsers,
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('Users Table')).toBeInTheDocument();
    });

    it('should render column headers', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
    });

    it('should render empty state when no data', () => {
      // Arrange
      const props = {
        data: [],
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        emptyMessage: 'No users found',
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('should render custom empty state when provided', () => {
      // Arrange
      const customEmptyState = () => <div>Custom Empty Message</div>;
      const props = {
        data: [],
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        renderEmptyState: customEmptyState,
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('Custom Empty Message')).toBeInTheDocument();
    });
  });

  describe('Column Rendering', () => {
    it('should render cells using accessor function', () => {
      // Arrange
      const columns: Column<TestUser>[] = [
        {
          key: 'name',
          header: 'Name',
          accessor: (row) => row.name.toUpperCase(),
        },
      ];
      const props = {
        data: [mockUsers[0]],
        columns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('JOHN DOE')).toBeInTheDocument();
    });

    it('should render cells using render function', () => {
      // Arrange
      const columns: Column<TestUser>[] = [
        {
          key: 'name',
          header: 'Name',
          render: (row) => <strong>{row.name}</strong>,
        },
      ];
      const props = {
        data: [mockUsers[0]],
        columns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const nameElement = screen.getByText('John Doe');
      expect(nameElement.tagName).toBe('STRONG');
    });

    it('should render dash for null/undefined values', () => {
      // Arrange
      const dataWithNulls: TestUser[] = [
        { id: '1', name: 'John', email: '', role: 'ADMIN' },
      ];
      const props = {
        data: dataWithNulls,
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Filtering', () => {
    it('should render search filter', () => {
      // Arrange
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search', placeholder: 'Search by name' },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByPlaceholderText('Search by name')).toBeInTheDocument();
    });

    it('should call onFilterChange when search input changes', () => {
      // Arrange
      const onFilterChange = vi.fn();
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search', placeholder: 'Search by name' },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: {},
        onFilterChange,
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const searchInput = screen.getByPlaceholderText('Search by name') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'John' } });

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith('name', 'John');
    });

    it('should render select filter', () => {
      // Arrange
      const filters: FilterConfig[] = [
        {
          key: 'role',
          type: 'select',
          options: [
            { value: 'ADMIN', label: 'Admin' },
            { value: 'USER', label: 'User' },
          ],
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should call onFilterChange when select changes', async () => {
      // Arrange
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      const filters: FilterConfig[] = [
        {
          key: 'role',
          type: 'select',
          options: [
            { value: 'ADMIN', label: 'Admin' },
            { value: 'USER', label: 'User' },
          ],
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: {},
        onFilterChange,
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'ADMIN');

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith('role', 'ADMIN');
    });

    it('should display active filter count', () => {
      // Arrange
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search' },
        { key: 'role', type: 'select', options: [{ value: 'ADMIN', label: 'Admin' }] },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: { name: 'John', role: 'ADMIN' },
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });

    it('should show filter chips for active filters', () => {
      // Arrange
      const filters: FilterConfig[] = [
        {
          key: 'role',
          type: 'select',
          label: 'Role',
          options: [
            { value: 'ADMIN', label: 'Admin' },
            { value: 'USER', label: 'User' },
          ],
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: { role: 'ADMIN' },
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText(/Role: Admin/i)).toBeInTheDocument();
    });

    it('should call onClearFilters when Clear All button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onClearFilters = vi.fn();
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search' },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: { name: 'John' },
        onFilterChange: vi.fn(),
        onClearFilters,
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const clearButton = screen.getByText('Clear All');
      await user.click(clearButton);

      // Assert
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('should clear search filter when clear icon is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search', placeholder: 'Search' },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: { name: 'John' },
        onFilterChange,
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith('name', '');
    });

    it('should not show filters heading when showFiltersHeading is false', () => {
      // Arrange
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search' },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        showFiltersHeading: false,
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('should show enhanced empty state when filters are active and no data matches', () => {
      // Arrange
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search' },
      ];
      const props = {
        data: [],
        columns: basicColumns,
        filters,
        filterValues: { name: 'NonExistent' },
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('No data matches your filters')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your filters or clear them to see all data')).toBeInTheDocument();
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should render sortable column header', () => {
      // Arrange
      const sortConfig: SortConfig = {
        field: 'name',
        direction: 'asc',
        onSort: vi.fn(),
      };
      const columns: Column<TestUser>[] = [
        { key: 'name', header: 'Name', sortable: true },
      ];
      const props = {
        data: mockUsers,
        columns,
        sortConfig,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const header = screen.getByText('Name').closest('th');
      expect(header).toHaveStyle({ cursor: 'pointer' });
    });

    it('should call onSort when sortable header is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSort = vi.fn();
      const sortConfig: SortConfig = {
        field: 'name',
        direction: 'asc',
        onSort,
      };
      const columns: Column<TestUser>[] = [
        { key: 'name', header: 'Name', sortable: true },
      ];
      const props = {
        data: mockUsers,
        columns,
        sortConfig,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const header = screen.getByText('Name').closest('th');
      if (header) {
        await user.click(header);
      }

      // Assert
      expect(onSort).toHaveBeenCalledWith('name');
    });

    it('should show ascending sort indicator', () => {
      // Arrange
      const sortConfig: SortConfig = {
        field: 'name',
        direction: 'asc',
        onSort: vi.fn(),
      };
      const columns: Column<TestUser>[] = [
        { key: 'name', header: 'Name', sortable: true },
      ];
      const props = {
        data: mockUsers,
        columns,
        sortConfig,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const header = screen.getByText('Name').closest('th');
      expect(header).toBeInTheDocument();
      // Check that sort icon is visible (ChevronUpIcon for ascending)
      const sortIcon = header?.querySelector('svg');
      expect(sortIcon).toBeInTheDocument();
    });

    it('should not be sortable when sortable is false', () => {
      // Arrange
      const columns: Column<TestUser>[] = [
        { key: 'name', header: 'Name', sortable: false },
      ];
      const props = {
        data: mockUsers,
        columns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const header = screen.getByText('Name').closest('th');
      expect(header).toHaveStyle({ cursor: 'default' });
    });
  });

  describe('Selection', () => {
    beforeEach(() => {
      // Mock HTMLElement.focus to avoid jsdom issues
      Object.defineProperty(HTMLElement.prototype, 'focus', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    });

    it('should render selection checkbox column when enableSelection is true', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set<string>(),
        onSelectRow: vi.fn(),
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should call onSelectRow when row checkbox is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectRow = vi.fn();
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set<string>(),
        onSelectRow,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First data row checkbox (index 0 is select all)

      // Assert
      expect(onSelectRow).toHaveBeenCalledWith('1', true);
    });

    it('should show checked state for selected rows', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set(['1', '3']),
        onSelectRow: vi.fn(),
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      // Checkboxes at index 1 and 3 should be checked (0 is select all)
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[3]).toBeChecked();
    });

    it('should call onSelectAll when select all checkbox is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onSelectAll = vi.fn();
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set<string>(),
        onSelectAll,
        onSelectRow: vi.fn(),
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Select all checkbox

      // Assert
      expect(onSelectAll).toHaveBeenCalledWith(true);
    });

    it('should show indeterminate state when some rows are selected', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set(['1']),
        onSelectAll: vi.fn(),
        onSelectRow: vi.fn(),
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      // Check for indeterminate state - Chakra UI uses isIndeterminate prop
      const selectAllCheckbox = checkboxes[0];
      expect(selectAllCheckbox).toBeInTheDocument();
      // The checkbox should not be fully checked when only some are selected
      expect(selectAllCheckbox).not.toBeChecked();
    });

    it('should show checked state when all rows are selected', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        enableSelection: true,
        selectedIds: new Set(['1', '2', '3']),
        onSelectAll: vi.fn(),
        onSelectRow: vi.fn(),
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
    });
  });

  describe('Pagination', () => {
    it('should render pagination controls for client-side pagination', () => {
      // Arrange
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 10,
        onPageChange: vi.fn(),
      };
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText(/Showing 1 to 10 of 50/i)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();
    });

    it('should call onPageChange when Next button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 10,
        onPageChange,
      };
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      // Assert
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when Previous button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 2,
        pageSize: 10,
        onPageChange,
      };
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const prevButton = screen.getByText('Previous');
      await user.click(prevButton);

      // Assert
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('should disable Previous button on first page', () => {
      // Arrange
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 10,
        onPageChange: vi.fn(),
      };
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const prevButton = screen.getByText('Previous');
      expect(prevButton).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      // Arrange
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 5,
        pageSize: 10,
        onPageChange: vi.fn(),
      };
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('should render pagination for server-side mode', () => {
      // Arrange
      const pagination: PaginationConfig = {
        mode: 'server',
        page: 1,
        pageSize: 20,
        total: 100,
        totalPages: 5,
        onPageChange: vi.fn(),
      };
      const props = {
        data: mockUsers,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText(/Showing 1 to 20 of 100/i)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();
    });

    it('should call onPageSizeChange when page size select changes', async () => {
      // Arrange
      const user = userEvent.setup();
      const onPageSizeChange = vi.fn();
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 10,
        onPageChange: vi.fn(),
        onPageSizeChange,
        pageSizeOptions: [10, 20, 50],
      };
      const largeDataSet = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER',
      }));
      const props = {
        data: largeDataSet,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      // Find the select element by finding the text and then the select nearby
      const itemsPerPageText = screen.getByText('Items per page:');
      const selectElement = itemsPerPageText.parentElement?.querySelector('select');
      if (selectElement) {
        await user.selectOptions(selectElement, '20');
      }

      // Assert
      expect(onPageSizeChange).toHaveBeenCalledWith(20);
    });

    it('should not render pagination when totalPages is 1', () => {
      // Arrange
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 100,
        onPageChange: vi.fn(),
      };
      const props = {
        data: mockUsers,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('should show totalWithoutFilters when filters are active', () => {
      // Arrange
      const filters: FilterConfig[] = [
        { key: 'name', type: 'search' },
      ];
      const pagination: PaginationConfig = {
        mode: 'server',
        page: 1,
        pageSize: 20,
        total: 10,
        totalPages: 2, // Need more than 1 page to show pagination
        onPageChange: vi.fn(),
      };
      const props = {
        data: mockUsers,
        columns: basicColumns,
        filters,
        filterValues: { name: 'John' },
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        pagination,
        totalWithoutFilters: 100,
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText(/100 total without filters/i)).toBeInTheDocument();
    });
  });

  describe('CSV Export', () => {
    it('should render export button when csvExport is enabled', () => {
      // Arrange
      const csvExport: CSVExportConfig = {
        enabled: true,
        filename: 'users.csv',
        headers: ['Name', 'Email', 'Role'],
        getRowData: (row: TestUser) => [row.name, row.email, row.role],
      };
      const props = {
        title: 'Users',
        data: mockUsers,
        columns: basicColumns,
        csvExport,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    it('should call generateCSV when export button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const csvExport: CSVExportConfig = {
        enabled: true,
        filename: 'users.csv',
        headers: ['Name', 'Email', 'Role'],
        getRowData: (row: TestUser) => [row.name, row.email, row.role],
      };
      const props = {
        title: 'Users',
        data: mockUsers,
        columns: basicColumns,
        csvExport,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);

      // Assert
      expect(generateCSV).toHaveBeenCalledWith(
        ['Name', 'Email', 'Role'],
        [
          ['John Doe', 'john@example.com', 'ADMIN'],
          ['Jane Smith', 'jane@example.com', 'USER'],
          ['Bob Johnson', 'bob@example.com', 'ADMIN'],
        ],
        'users.csv'
      );
    });

    it('should call onExport callback when provided', async () => {
      // Arrange
      const user = userEvent.setup();
      const onExport = vi.fn();
      const csvExport: CSVExportConfig = {
        enabled: true,
        filename: 'users.csv',
        headers: ['Name', 'Email', 'Role'],
        getRowData: (row: TestUser) => [row.name, row.email, row.role],
        onExport,
      };
      const props = {
        title: 'Users',
        data: mockUsers,
        columns: basicColumns,
        csvExport,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const exportButton = screen.getByText('Export CSV');
      await user.click(exportButton);

      // Assert
      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });

  describe('Row Actions', () => {
    it('should render action buttons', () => {
      // Arrange
      const actions: ActionButton<TestUser>[] = [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: vi.fn(),
        },
        {
          icon: <DeleteIcon />,
          label: 'Delete',
          onClick: vi.fn(),
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        actions,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('Actions')).toBeInTheDocument();
      const editButtons = screen.getAllByLabelText('Edit');
      expect(editButtons.length).toBe(3); // One per row
    });

    it('should call action onClick when action button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const actions: ActionButton<TestUser>[] = [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: onEdit,
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        actions,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const editButtons = screen.getAllByLabelText('Edit');
      await user.click(editButtons[0]);

      // Assert
      expect(onEdit).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('should hide action button when isVisible returns false', () => {
      // Arrange
      const actions: ActionButton<TestUser>[] = [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: vi.fn(),
          isVisible: (row) => row.role === 'ADMIN',
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        actions,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const editButtons = screen.getAllByLabelText('Edit');
      expect(editButtons.length).toBe(2); // Only for ADMIN users
    });

    it('should disable action button when isDisabled returns true', () => {
      // Arrange
      const actions: ActionButton<TestUser>[] = [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: vi.fn(),
          isDisabled: (row) => !row.active,
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        actions,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const editButtons = screen.getAllByLabelText('Edit');
      // Jane Smith has active: false, so her edit button should be disabled
      expect(editButtons[1]).toBeDisabled();
    });
  });

  describe('Row Click', () => {
    it('should call onRowClick when row is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      const props = {
        data: mockUsers,
        columns: basicColumns,
        onRowClick,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const row = screen.getByText('John Doe').closest('tr');
      if (row) {
        await user.click(row);
      }

      // Assert
      expect(onRowClick).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('should not call onRowClick when action button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      const actions: ActionButton<TestUser>[] = [
        {
          icon: <EditIcon />,
          label: 'Edit',
          onClick: vi.fn(),
        },
      ];
      const props = {
        data: mockUsers,
        columns: basicColumns,
        onRowClick,
        actions,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);
      const editButton = screen.getAllByLabelText('Edit')[0];
      await user.click(editButton);

      // Assert
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Custom Row Renderer', () => {
    it('should use custom renderRow when provided', () => {
      // Arrange
      const renderRow = vi.fn((row: TestUser) => (
        <tr key={row.id}>
          <td colSpan={3}>Custom: {row.name}</td>
        </tr>
      ));
      const props = {
        data: mockUsers,
        columns: basicColumns,
        renderRow,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(renderRow).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Custom: John Doe')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading spinner when loading is true', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        loading: true,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const loadingTexts = screen.getAllByText('Loading...');
      expect(loadingTexts.length).toBeGreaterThan(0);
      // Check that spinner is present
      const spinner = document.querySelector('[class*="chakra-spinner"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render table when loading is true', () => {
      // Arrange
      const props = {
        data: mockUsers,
        columns: basicColumns,
        loading: true,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('Sticky Columns', () => {
    it('should apply sticky positioning to first column when sticky is true', () => {
      // Arrange
      const columns: Column<TestUser>[] = [
        { key: 'name', header: 'Name', sticky: true },
        { key: 'email', header: 'Email' },
        { key: 'role', header: 'Role' },
      ];
      const props = {
        data: mockUsers,
        columns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader).toHaveStyle({ position: 'sticky' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data array', () => {
      // Arrange
      const props = {
        data: [],
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('No data found')).toBeInTheDocument();
    });

    it('should handle null values in data', () => {
      // Arrange
      const dataWithNulls: TestUser[] = [
        { id: '1', name: 'John', email: '', role: 'ADMIN' },
      ];
      const props = {
        data: dataWithNulls,
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should handle single item in data', () => {
      // Arrange
      const props = {
        data: [mockUsers[0]],
        columns: basicColumns,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('should handle pagination with exactly one page of data', () => {
      // Arrange
      const pagination: PaginationConfig = {
        mode: 'client',
        page: 1,
        pageSize: 3,
        onPageChange: vi.fn(),
      };
      const props = {
        data: mockUsers,
        columns: basicColumns,
        pagination,
        filterValues: {},
        onFilterChange: vi.fn(),
        onClearFilters: vi.fn(),
        getRowId: (row: TestUser) => row.id,
      };

      // Act
      renderDataTable(props);

      // Assert
      // Pagination should not be shown when totalPages is 1
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });
  });
});

