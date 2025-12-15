import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Typography,
  Button,
  Stack,
  Snackbar,
  Alert,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Paper,
  AppBar,
  Toolbar as MuiToolbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ArrowBack, Refresh, Brightness4, Brightness7 } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExcelGrid, type ExcelGridHandle } from './ExcelGrid';
import { fetchTableSchema, fetchTableData, discoverSchemasAndTables, type PaginatedResponse, type SchemaTable } from '../services/sqlRestApi';
import type { Cell, TableMetadata } from '../types/cell';
import { useColorMode } from '../hooks/useColorMode.tsx';

interface TablePageState {
  loading: boolean;
  error: string | null;
  schemasTables: SchemaTable[];
  selectedSchema: string;
  selectedTable: string;
  tableSchema: any;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  filters: Map<number, Set<string>>;
}

export function TablePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const gridRef = useRef<ExcelGridHandle>(null);
  const { mode, toggleMode } = useColorMode();

  // State management
  const [state, setState] = useState<TablePageState>({
    loading: false,
    error: null,
    schemasTables: [],
    selectedSchema: searchParams.get('schema') || '',
    selectedTable: searchParams.get('table') || '',
    tableSchema: null,
    currentPage: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '100'),
    totalPages: 1,
    totalCount: 0,
    sortColumn: searchParams.get('sort')?.split(':')[0] || null,
    sortDirection: searchParams.get('sort')?.split(':')[1] as 'asc' | 'desc' | null,
    filters: new Map(),
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Update URL when state changes
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (state.selectedSchema) params.set('schema', state.selectedSchema);
    if (state.selectedTable) params.set('table', state.selectedTable);
    params.set('page', state.currentPage.toString());
    params.set('pageSize', state.pageSize.toString());
    if (state.sortColumn && state.sortDirection) {
      params.set('sort', `${state.sortColumn}:${state.sortDirection}`);
    }
    setSearchParams(params);
  }, [state.selectedSchema, state.selectedTable, state.currentPage, state.pageSize, state.sortColumn, state.sortDirection, setSearchParams]);

  // Load available schemas and tables
  const loadSchemasAndTables = useCallback(async () => {
    try {
      setState((prev: TablePageState) => ({ ...prev, loading: true, error: null }));
      const schemasTables = await discoverSchemasAndTables();
      setState((prev: TablePageState) => ({ ...prev, schemasTables, loading: false }));
    } catch (error) {
      setState((prev: TablePageState) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load schemas and tables',
      }));
    }
  }, []);

  // Load table schema
  const loadTableSchema = useCallback(async (schema: string, table: string) => {
    try {
      setState((prev: TablePageState) => ({ ...prev, loading: true, error: null }));
      const schemaData = await fetchTableSchema(schema, table);
      
      // Create header row from schema
      const headerCells = new Map<string, Cell>();
      schemaData.columns.forEach((column: any, index: number) => {
        const key = `0-${index}`;
        headerCells.set(key, {
          row: 0,
          col: index,
          value: { type: 'text', value: column.name, rawValue: column.name },
        });
      });

      // Create table metadata
      const tableMetadata: TableMetadata = {
        id: `${schema}.${table}`,
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: schemaData.columns.length - 1,
        hasHeader: true,
        headerRow: 0,
        filters: new Map(),
        sortColumn: undefined,
        sortDirection: null,
      };

      // Import headers into grid
      gridRef.current?.importCells(headerCells, false, tableMetadata);
      
      setState((prev: TablePageState) => ({ ...prev, tableSchema: schemaData, loading: false }));
    } catch (error) {
      setState((prev: TablePageState) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load table schema',
      }));
    }
  }, []);

  // Load table data
  const loadTableData = useCallback(async () => {
    if (!state.selectedSchema || !state.selectedTable) return;

    try {
      setState((prev: TablePageState) => ({ ...prev, loading: true, error: null }));
      
      // Convert filters Map to API format
      const filtersArray = Array.from(state.filters.entries()).map(([_column, values]: [number, Set<string>]) => ({
        column: state.tableSchema?.columns[_column]?.name || `Column${_column}`,
        values: Array.from(values),
      }));
      
      const response: PaginatedResponse<Record<string, any>> = await fetchTableData(
        state.selectedSchema,
        state.selectedTable,
        state.currentPage,
        state.pageSize,
        state.sortColumn || undefined,
        state.sortDirection || undefined,
        filtersArray
      );

      // Create data cells
      const dataCells = new Map<string, Cell>();
      response.data.forEach((row, rowIndex) => {
        Object.entries(row).forEach(([_column, value], colIndex) => {
          const key = `${rowIndex + 1}-${colIndex}`;
          dataCells.set(key, {
            row: rowIndex + 1,
            col: colIndex,
            value: {
              type: typeof value === 'number' ? 'number' : 
                    typeof value === 'boolean' ? 'boolean' :
                    value instanceof Date ? 'date' : 'text',
              value: String(value),
              rawValue: value,
            },
          });
        });
      });

      // Import data into grid (starting from row 1, after headers)
      gridRef.current?.importCells(dataCells, false);
      
      setState((prev: TablePageState) => ({
        ...prev,
        totalPages: response.totalPages,
        totalCount: response.totalCount,
        loading: false,
      }));
    } catch (error) {
      setState((prev: TablePageState) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load table data',
      }));
    }
  }, [state.selectedSchema, state.selectedTable, state.currentPage, state.pageSize, state.sortColumn, state.sortDirection, state.filters]);

  // Handle schema selection
  const handleSchemaChange = (event: any) => {
    const schema = event.target.value;
    setState((prev: TablePageState) => ({ ...prev, selectedSchema: schema, selectedTable: '', tableSchema: null }));
  };

  // Handle table selection
  const handleTableChange = (event: any) => {
    const table = event.target.value;
    setState((prev: TablePageState) => ({ ...prev, selectedTable: table, currentPage: 1 }));
  };

  // Handle page change
  const handlePageChange = (_event: any, page: number) => {
    setState((prev: TablePageState) => ({ ...prev, currentPage: page }));
  };

  // Handle column header click for sorting
  const handleHeaderClick = useCallback((columnIndex: number) => {
    if (!state.tableSchema) return;

    const columnName = state.tableSchema.columns[columnIndex]?.name;
    if (!columnName) return;

    setState((prev: TablePageState) => {
      let newSortColumn: string | null = columnName;
      let newSortDirection: 'asc' | 'desc' | null = 'asc';

      // If clicking the same column, cycle through sort directions
      if (prev.sortColumn === columnName) {
        if (prev.sortDirection === 'asc') {
          newSortDirection = 'desc';
        } else if (prev.sortDirection === 'desc') {
          newSortColumn = null;
          newSortDirection = null;
        }
      }

      return {
        ...prev,
        sortColumn: newSortColumn,
        sortDirection: newSortDirection,
        currentPage: 1, // Reset to first page when sorting
      };
    });
  }, [state.tableSchema]);

  // Handle filter changes (prepared for future filter UI integration)
  // const handleFilterChange = useCallback((columnIndex: number, values: Set<string>) => {
  //   setState((prev: TablePageState) => {
  //     const newFilters = new Map(prev.filters);
  //     if (values.size === 0) {
  //       newFilters.delete(columnIndex);
  //     } else {
  //       newFilters.set(columnIndex, values);
  //     }
  //     return {
  //       ...prev,
  //       filters: newFilters,
  //       currentPage: 1, // Reset to first page when filtering
  //     };
  //   });
  // }, []);

  // Show snackbar message (unused for now but available for future features)
  // const showMessage = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  //   setSnackbar({ open: true, message, severity });
  // };

  // Initialize component
  useEffect(() => {
    loadSchemasAndTables();
  }, [loadSchemasAndTables]);

  // Load schema when table is selected
  useEffect(() => {
    if (state.selectedSchema && state.selectedTable) {
      loadTableSchema(state.selectedSchema, state.selectedTable);
    }
  }, [state.selectedSchema, state.selectedTable, loadTableSchema]);

  // Load data when page or pagination changes
  useEffect(() => {
    if (state.selectedSchema && state.selectedTable && state.tableSchema) {
      loadTableData();
    }
  }, [state.selectedSchema, state.selectedTable, state.currentPage, state.pageSize, state.tableSchema, state.sortColumn, state.sortDirection, state.filters, loadTableData]);

  // Update URL when state changes
  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  const uniqueSchemas = Array.from(new Set(state.schemasTables.map((st: SchemaTable) => st.schema))).sort();
  const availableTables = state.schemasTables.filter((st: SchemaTable) => st.schema === state.selectedSchema);

  return (
    <>
      <AppBar position="static" sx={{ mb: 3 }}>
        <MuiToolbar>
          <IconButton color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Fast Table Component
          </Typography>
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton color="inherit" onClick={toggleMode}>
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip>
          <IconButton color="inherit" onClick={() => loadTableData()} disabled={state.loading}>
            <Refresh />
          </IconButton>
        </MuiToolbar>
      </AppBar>

      <Container maxWidth="xl">
        {/* Connection Controls */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Database Connection
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Schema</InputLabel>
              <Select
                value={state.selectedSchema}
                label="Schema"
                onChange={handleSchemaChange}
                disabled={state.loading}
              >
                {uniqueSchemas.map((schema: string) => (
                  <MenuItem key={schema} value={schema}>
                    {schema.charAt(0).toUpperCase() + schema.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Table</InputLabel>
              <Select
                value={state.selectedTable}
                label="Table"
                onChange={handleTableChange}
                disabled={state.loading || !state.selectedSchema}
              >
                {availableTables.map((table: SchemaTable) => (
                  <MenuItem key={table.table} value={table.table}>
                    {table.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={() => loadTableData()}
              disabled={!state.selectedSchema || !state.selectedTable || state.loading}
            >
              Load Data
            </Button>
          </Stack>
        </Paper>

        {/* Status Bar */}
        {state.selectedSchema && state.selectedTable && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd' }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="body2">
                <strong>Table:</strong> {state.selectedSchema}.{state.selectedTable}
              </Typography>
              <Typography variant="body2">
                <strong>Total Records:</strong> {state.totalCount.toLocaleString()}
              </Typography>
              <Typography variant="body2">
                <strong>Current Page:</strong> {state.currentPage} of {state.totalPages}
              </Typography>
              {state.sortColumn && (
                <Typography variant="body2">
                  <strong>Sort:</strong> {state.sortColumn} ({state.sortDirection})
                </Typography>
              )}
              {state.filters.size > 0 && (
                <Typography variant="body2">
                  <strong>Filters:</strong> {state.filters.size} column(s)
                </Typography>
              )}
            </Stack>
          </Paper>
        )}

        {/* Loading Progress */}
        {state.loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Error Display */}
        {state.error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setState(prev => ({ ...prev, error: null }))}>
            {state.error}
          </Alert>
        )}

        {/* Excel Grid */}
        <Paper sx={{ p: 2, mb: 3, height: '600px', overflow: 'hidden' }}>
          <ExcelGrid
            ref={gridRef}
            initialRows={100}
            initialCols={50}
            cellWidth={120}
            cellHeight={30}
            onHeaderClick={handleHeaderClick}
          />
        </Paper>

        {/* Pagination Controls */}
        {state.totalPages > 1 && (
          <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={state.totalPages}
              page={state.currentPage}
              onChange={handlePageChange}
              disabled={state.loading}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Paper>
        )}
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
