/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { ReactNode, ReactElement } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  HStack,
  VStack,
  Badge,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Checkbox,
  Text,
  IconButton,
  Tooltip,
  Spinner,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, DownloadIcon, CloseIcon } from '@chakra-ui/icons';
import { generateCSV, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '../utils/tableUtils';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  minW?: string;
  sticky?: boolean; // Make column sticky (typically first column)
  resizable?: boolean; // Allow column resizing
}

export interface FilterConfig {
  key: string;
  type: 'search' | 'select' | 'checkbox';
  placeholder?: string;
  options?: { value: string; label: string }[];
  label?: string;
}

export interface ActionButton<T> {
  icon: ReactElement | undefined;
  label: string;
  onClick: (row: T) => void;
  colorScheme?: string;
  isDisabled?: (row: T) => boolean;
  isVisible?: (row: T) => boolean;
}

export interface PaginationConfig {
  mode: 'client' | 'server';
  page: number;
  pageSize: number;
  total?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export interface CSVExportConfig {
  enabled: boolean;
  filename: string;
  headers: string[];
  getRowData: (row: any) => (string | number | null | undefined)[];
  onExport?: () => void;
}

export interface DataTableProps<T> {
  title?: string;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;

  // Filtering
  filters?: FilterConfig[];
  filterValues: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onClearFilters: () => void;
  showFiltersHeading?: boolean;

  // Sorting
  sortConfig?: SortConfig;

  // Selection
  enableSelection?: boolean;
  selectedIds?: Set<string>;
  onSelectAll?: (checked: boolean) => void;
  onSelectRow?: (id: string, checked: boolean) => void;
  getRowId: (row: T) => string;

  // Pagination
  pagination?: PaginationConfig;

  // Actions
  actions?: ActionButton<T>[];

  // CSV Export
  csvExport?: CSVExportConfig;

  // Row interaction
  onRowClick?: (row: T) => void;

  // Custom renderers
  renderEmptyState?: () => ReactNode;
  renderRow?: (row: T, index: number) => ReactNode;

  // Pagination clarity
  totalWithoutFilters?: number; // Total count without filters for pagination display

  // Layout
  maxHeight?: string; // Fixed height for vertical scrolling
}

export function DataTable<T>({
  title,
  data,
  columns,
  loading = false,
  emptyMessage = 'No data found',
  filters = [],
  filterValues,
  onFilterChange,
  onClearFilters,
  showFiltersHeading = true,
  sortConfig,
  enableSelection = false,
  selectedIds = new Set(),
  onSelectAll,
  onSelectRow,
  getRowId,
  pagination,
  actions = [],
  csvExport,
  onRowClick,
  renderEmptyState,
  renderRow,
  totalWithoutFilters,
  maxHeight,
}: DataTableProps<T>) {
  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    filters.forEach((filter) => {
      const value = filterValues[filter.key];
      if (value !== null && value !== undefined && value !== '') {
        count++;
      }
    });
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Handle CSV export
  const handleExportCSV = () => {
    if (!csvExport) return;

    // Use filtered data for export (all data, not just current page)
    const rows = data.map(csvExport.getRowData);
    generateCSV(csvExport.headers, rows, csvExport.filename);

    if (csvExport.onExport) {
      csvExport.onExport();
    }
  };

  // Get paginated data (client-side only)
  const getPaginatedData = () => {
    if (!pagination || pagination.mode === 'server') {
      return data;
    }

    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return data.slice(startIndex, endIndex);
  };

  const paginatedData = getPaginatedData();
  const totalItems = pagination?.mode === 'server' ? (pagination.total || 0) : data.length;
  const totalPages = pagination?.mode === 'server'
    ? (pagination.totalPages || 1)
    : Math.ceil(data.length / (pagination?.pageSize || DEFAULT_PAGE_SIZE));

  // Render sortable header
  const renderSortableHeader = (column: Column<T>, index: number) => {
    const isSorted = sortConfig && sortConfig.field === column.key;
    const isAsc = isSorted && sortConfig.direction === 'asc';
    const isSticky = column.sticky;
    // Calculate sticky left position: sum of widths of all non-sticky columns before this one
    let stickyLeft: string | undefined = undefined;
    if (isSticky) {
      let leftOffset = enableSelection ? 50 : 0; // Checkbox width if enabled
      for (let i = 0; i < index; i++) {
        if (!columns[i].sticky) {
          // Estimate width: use minW if available, otherwise default to 150px
          const width = columns[i].minW || columns[i].width || '150px';
          const widthNum = parseInt(width.replace('px', ''), 10);
          leftOffset += widthNum || 150;
        }
      }
      stickyLeft = `${leftOffset}px`;
    }

    return (
      <Th
        key={column.key}
        cursor={column.sortable !== false ? 'pointer' : 'default'}
        onClick={column.sortable !== false && sortConfig ? () => sortConfig.onSort(column.key) : undefined}
        _hover={column.sortable !== false ? { bg: 'gray.50' } : {}}
        bg={isSorted ? 'blue.50' : 'transparent'}
        width={column.width}
        minW={column.minW}
        px={2}
        transition="background-color 0.2s"
        userSelect="none"
        position="sticky"
        top={0}
        left={stickyLeft}
        zIndex={isSticky ? 20 : 10}
        bgColor={isSticky ? 'white' : (isSorted ? 'blue.50' : 'white')}
        boxShadow={isSticky ? '2px 0 4px rgba(0,0,0,0.1)' : '0 1px 0 rgba(0,0,0,0.1)'}
      >
        <HStack spacing={2}>
          <Box fontWeight={isSorted ? 'semibold' : 'normal'}>{column.header}</Box>
          {column.sortable !== false && (
            isSorted ? (
              isAsc ? (
                <ChevronUpIcon boxSize={4} color="blue.500" />
              ) : (
                <ChevronDownIcon boxSize={4} color="blue.500" />
              )
            ) : (
              // Show sort indicator placeholder for alignment even when not sorted
              <Box boxSize={4} opacity={0}><ChevronUpIcon boxSize={4} /></Box>
            )
          )}
        </HStack>
      </Th>
    );
  };

  // Render filter UI
  const renderFilters = () => {
    if (filters.length === 0) return null;

    return (
      <Box p={4} bg="white" borderRadius="md" boxShadow="sm" mb={4}>
        <VStack spacing={3} align="stretch">
          {showFiltersHeading && (
            <HStack justify="space-between">
              <Heading size="sm">Filters</Heading>
              {activeFilterCount > 0 && (
                <HStack spacing={2}>
                  <Badge colorScheme="blue" fontSize="sm">
                    {activeFilterCount} active
                  </Badge>
                  <Button size="xs" variant="ghost" onClick={onClearFilters}>
                    Clear All
                  </Button>
                </HStack>
              )}
            </HStack>
          )}
          <HStack spacing={4} flexWrap="wrap">
            {filters.map((filter) => {
              if (filter.type === 'search') {
                const searchValue = filterValues[filter.key] || '';
                return (
                  <InputGroup key={filter.key} maxW="300px">
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.300" />
                    </InputLeftElement>
                    <Input
                      placeholder={filter.placeholder || 'Search...'}
                      value={searchValue}
                      onChange={(e) => onFilterChange(filter.key, e.target.value)}
                    />
                    {searchValue && (
                      <InputRightElement>
                        <IconButton
                          aria-label="Clear search"
                          icon={<CloseIcon />}
                          size="xs"
                          variant="ghost"
                          onClick={() => onFilterChange(filter.key, '')}
                        />
                      </InputRightElement>
                    )}
                  </InputGroup>
                );
              }

              if (filter.type === 'select') {
                const selectValue = filterValues[filter.key];
                return (
                  <Select
                    key={filter.key}
                    placeholder={
                      filter.placeholder === '' 
                        ? undefined 
                        : (filter.placeholder !== undefined ? filter.placeholder : `Filter by ${filter.label || filter.key}`)
                    }
                    value={selectValue !== undefined && selectValue !== null && selectValue !== '' ? selectValue : ''}
                    onChange={(e) => onFilterChange(filter.key, e.target.value)}
                    maxW="200px"
                  >
                    {filter.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                );
              }

              return null;
            })}
          </HStack>

          {/* Filter chips - show active filters with remove buttons */}
          {activeFilterCount > 0 && (
            <Wrap spacing={2} mt={2}>
              {filters.map((filter) => {
                const value = filterValues[filter.key];
                // Don't show lozenge for empty values, false, or 'all' (which means show all/no filter)
                if (!value || value === '' || value === false || value === 'all') return null;

                let displayValue = String(value);
                const filterLabel = filter.label || filter.key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                if (filter.type === 'select' && filter.options) {
                  const option = filter.options.find((opt) => opt.value === value);
                  displayValue = option?.label || displayValue;
                }

                return (
                  <WrapItem key={filter.key}>
                    <Badge
                      colorScheme="blue"
                      display="flex"
                      alignItems="center"
                      gap={1}
                      px={2}
                      py={1}
                      borderRadius="md"
                    >
                      <Text fontSize="xs">{filterLabel}: {displayValue}</Text>
                      <IconButton
                        aria-label={`Remove ${filter.key} filter`}
                        icon={<CloseIcon />}
                        size="xs"
                        variant="ghost"
                        onClick={() => onFilterChange(filter.key, filter.type === 'checkbox' ? false : '')}
                        _hover={{ bg: 'blue.200' }}
                        minW="auto"
                        h="auto"
                        p={0.5}
                      />
                    </Badge>
                  </WrapItem>
                );
              })}
            </Wrap>
          )}
        </VStack>
      </Box>
    );
  };

  // Render pagination
  const renderPagination = (totalWithoutFilters?: number) => {
    if (!pagination) return null;

    const currentPage = pagination.page;
    const pageSize = pagination.pageSize;
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);

    if (totalPages <= 1) return null;

    const hasFilters = activeFilterCount > 0;
    const showTotalComparison = hasFilters && totalWithoutFilters !== undefined && totalWithoutFilters !== totalItems;

    return (
      <HStack justify="space-between" mt={4}>
        <Text fontSize="sm" color="gray.600">
          Showing {startIndex} to {endIndex} of {totalItems} item{totalItems !== 1 ? 's' : ''}
          {showTotalComparison && ` (${totalWithoutFilters} total without filters)`}
        </Text>
        <HStack spacing={2}>
          <Button
            size="sm"
            onClick={() => pagination.onPageChange(currentPage - 1)}
            isDisabled={currentPage === 1}
          >
            Previous
          </Button>
          <Text fontSize="sm">
            Page {currentPage} of {totalPages}
          </Text>
          <Button
            size="sm"
            onClick={() => pagination.onPageChange(currentPage + 1)}
            isDisabled={currentPage >= totalPages}
          >
            Next
          </Button>
          {pagination.onPageSizeChange && (
            <HStack spacing={2}>
              <Text fontSize="sm" color="gray.600">
                Items per page:
              </Text>
              <Select
                size="sm"
                value={pageSize}
                onChange={(e) => pagination.onPageSizeChange!(Number(e.target.value))}
                maxW="100px"
              >
                {(pagination.pageSizeOptions || DEFAULT_PAGE_SIZE_OPTIONS).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </HStack>
          )}
        </HStack>
      </HStack>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (renderEmptyState) {
      return renderEmptyState();
    }

    return (
      <Tr>
        <Td colSpan={columns.length + (enableSelection ? 1 : 0) + (actions.length > 0 ? 1 : 0)} textAlign="center" py={8}>
          <Text color="gray.500">{emptyMessage}</Text>
        </Td>
      </Tr>
    );
  };

  // Render default row
  const renderDefaultRow = (row: T, _index: number) => {
    const rowId = getRowId(row);
    const isSelected = selectedIds.has(rowId);

    return (
      <Tr
        key={rowId}
        _hover={onRowClick ? { bg: 'gray.50', opacity: 0.9, cursor: 'pointer' } : { bg: 'gray.50' }}
        cursor={onRowClick ? 'pointer' : 'default'}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        {enableSelection && (
          <Td onClick={(e) => e.stopPropagation()}>
            <Checkbox
              isChecked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelectRow?.(rowId, e.target.checked);
              }}
            />
          </Td>
        )}
        {columns.map((column) => {
          let cellContent: ReactNode;

          if (column.render) {
            cellContent = column.render(row);
          } else if (column.accessor) {
            const value = column.accessor(row);
            cellContent = value === null || value === undefined || value === ''
              ? <Text color="gray.400" fontSize="xs">—</Text>
              : String(value);
          } else {
            const value = (row as any)[column.key];
            cellContent = value === null || value === undefined || value === ''
              ? <Text color="gray.400" fontSize="xs">—</Text>
              : String(value);
          }

          const columnIndex = columns.indexOf(column);
          const isSticky = column.sticky;
          // Calculate sticky left position: sum of widths of all non-sticky columns before this one
          let stickyLeft: string | undefined = undefined;
          if (isSticky) {
            let leftOffset = enableSelection ? 50 : 0; // Checkbox width if enabled
            for (let i = 0; i < columnIndex; i++) {
              if (!columns[i].sticky) {
                // Estimate width: use minW if available, otherwise default to 150px
                const width = columns[i].minW || columns[i].width || '150px';
                const widthNum = parseInt(width.replace('px', ''), 10);
                leftOffset += widthNum || 150;
              }
            }
            stickyLeft = `${leftOffset}px`;
          }
          return (
            <Td
              key={column.key}
              position={isSticky ? 'sticky' : 'relative'}
              left={stickyLeft}
              zIndex={isSticky ? 5 : 1}
              bgColor={isSticky ? 'white' : undefined}
              boxShadow={isSticky ? '2px 0 4px rgba(0,0,0,0.1)' : undefined}
            >
              {cellContent}
            </Td>
          );
        })}
        {actions.length > 0 && (
          <Td onClick={(e) => e.stopPropagation()}>
            <HStack spacing={2}>
              {actions.map((action, idx) => {
                if (action.isVisible && !action.isVisible(row)) return null;
                const disabled = action.isDisabled ? action.isDisabled(row) : false;

                return (
                  <Tooltip key={idx} label={action.label}>
                    <IconButton
                      aria-label={action.label}
                      icon={action.icon || undefined}
                      size="sm"
                      colorScheme={action.colorScheme || 'blue'}
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(row);
                      }}
                      isDisabled={disabled}
                    />
                  </Tooltip>
                );
              })}
            </HStack>
          </Td>
        )}
      </Tr>
    );
  };

  return (
    <VStack spacing={6} align="stretch" height={maxHeight ? undefined : "100%"}>
      {title && (
        <HStack justify="space-between">
          <Heading size="lg">{title}</Heading>
          {csvExport?.enabled && (
            <Button
              leftIcon={<DownloadIcon />}
              colorScheme="blue"
              variant="outline"
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          )}
        </HStack>
      )}

      {renderFilters()}

      {loading ? (
        <Box p={8} textAlign="center">
          <Spinner size="xl" />
          <Text mt={4}>Loading...</Text>
        </Box>
      ) : (
        <>
          <Box
            overflowX="auto"
            overflowY="auto"
            w="100%"
            height={maxHeight || "100%"}
          >
            <Table variant="simple" size="sm" minW="max-content">
              <Thead>
                <Tr>
                  {enableSelection && (
                    <Th
                      position="sticky"
                      top={0}
                      left={0}
                      zIndex={20}
                      bgColor="white"
                      boxShadow="2px 0 4px rgba(0,0,0,0.1)"
                      minW="50px"
                      w="50px"
                    >
                      <Checkbox
                        isChecked={
                          paginatedData.length > 0 &&
                          paginatedData.every((row) => selectedIds.has(getRowId(row)))
                        }
                        isIndeterminate={
                          paginatedData.some((row) => selectedIds.has(getRowId(row))) &&
                          !paginatedData.every((row) => selectedIds.has(getRowId(row)))
                        }
                        onChange={(e) => onSelectAll?.(e.target.checked)}
                      />
                    </Th>
                  )}
                  {columns.map((column, index) => renderSortableHeader(column, index))}
                  {actions.length > 0 && (
                    <Th position="sticky" top={0} zIndex={10} bg="white" boxShadow="0 1px 0 rgba(0,0,0,0.1)">
                      Actions
                    </Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {paginatedData.length === 0 ? (
                  activeFilterCount > 0 ? (
                    // Enhanced empty state when filters are active
                    <Tr>
                      <Td colSpan={columns.length + (enableSelection ? 1 : 0) + (actions.length > 0 ? 1 : 0)}>
                        <VStack spacing={4} py={8}>
                          <Text fontSize="lg" color="gray.500" fontWeight="medium">
                            No data matches your filters
                          </Text>
                          <Text fontSize="sm" color="gray.400">
                            Try adjusting your filters or clear them to see all data
                          </Text>
                          {onClearFilters && (
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant="outline"
                              onClick={onClearFilters}
                            >
                              Clear All Filters
                            </Button>
                          )}
                        </VStack>
                      </Td>
                    </Tr>
                  ) : (
                    renderEmpty()
                  )
                ) : (
                  renderRow
                    ? paginatedData.map((row, index) => renderRow(row, index))
                    : paginatedData.map((row, index) => renderDefaultRow(row, index))
                )}
              </Tbody>
            </Table>
          </Box>
          {renderPagination(totalWithoutFilters)}
        </>
      )}
    </VStack>
  );
}

