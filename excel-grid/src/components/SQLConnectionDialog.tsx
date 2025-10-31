import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Storage,
  CheckCircle,
  Error as ErrorIcon,
  TableChart,
  Schema as SchemaIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import {
  testConnection,
  discoverSchemasAndTables,
  getUniqueSchemas,
  getTablesForSchema,
  fetchTableData,
  fetchTablesFromApi,
  type SchemaTable,
  type PaginatedResponse,
} from '../services/sqlRestApi';
import { useAuth } from '../services/authService';
import { LoginDialog } from './LoginDialog';
import type { Cell } from '../types/cell';

interface SQLConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (cells: Map<string, Cell>, rowCount: number, colCount: number) => void;
  selectedCell?: { row: number; col: number } | null;
}

export const SQLConnectionDialog: React.FC<SQLConnectionDialogProps> = ({
  open,
  onClose,
  onImport,
  selectedCell,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<SchemaTable | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<SchemaTable[]>([]);
  const [discoveredSchemasTables, setDiscoveredSchemasTables] = useState<SchemaTable[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [pageSize] = useState<number>(100);
  const [previewData, setPreviewData] = useState<PaginatedResponse<Record<string, any>> | null>(null);

  // Authentication state
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loginDialogOpen, setLoginDialogOpen] = useState<boolean>(false);

  // Test connection when dialog opens
  useEffect(() => {
    if (open) {
      handleTestConnection();
    }
  }, [open]);

  // Load schemas when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadSchemasAndTables();
    }
  }, [connectionStatus]);

  // Load tables when authentication status changes
  useEffect(() => {
    if (connectionStatus === 'connected' && isAuthenticated) {
      loadSchemasAndTables();
    }
  }, [isAuthenticated, connectionStatus]);

  const loadSchemasAndTables = async () => {
    setLoading(true);
    setLoadingMessage('Discovering database tables...');
    try {
      let schemasTables: SchemaTable[] = [];
      
      // Try to use the authenticated API first
      if (isAuthenticated) {
        try {
          schemasTables = await fetchTablesFromApi();
          setLoadingMessage('Loaded tables from authenticated API');
        } catch (authError) {
          console.warn('Failed to load from authenticated API, falling back to Swagger:', authError);
          setLoadingMessage('Falling back to Swagger discovery...');
          schemasTables = await discoverSchemasAndTables();
        }
      } else {
        // Use Swagger discovery when not authenticated
        schemasTables = await discoverSchemasAndTables();
      }
      
      if (schemasTables.length === 0) {
        setError('No schemas or tables found in the API. Please check the API endpoints.');
        return;
      }
      
      setDiscoveredSchemasTables(schemasTables);
      const schemas = getUniqueSchemas(schemasTables);
      setAvailableSchemas(schemas);
      
      if (schemas.length > 0) {
        setSelectedSchema(schemas[0]);
      }
      
      setLoadingProgress(100);
      setLoadingMessage(`Found ${schemasTables.length} tables across ${schemas.length} schemas`);
      
      // Switch to tables tab if authenticated and tables are loaded
      if (isAuthenticated && schemasTables.length > 0) {
        setActiveTab(0);
      }
      
    } catch (error) {
      console.error('Failed to discover schemas and tables:', error);
      setError('Failed to discover schemas and tables: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
    }
  };

  // Load tables when schema changes
  useEffect(() => {
    if (selectedSchema && discoveredSchemasTables.length > 0) {
      const tables = getTablesForSchema(selectedSchema, discoveredSchemasTables);
      setAvailableTables(tables);
      setSelectedTable(null);
      setPreviewData(null);
    }
  }, [selectedSchema, discoveredSchemasTables]);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setError('');
    
    try {
      // First check if we can reach the health endpoint (no auth required)
      const isConnected = await testConnection();
      if (!isConnected) {
        setConnectionStatus('error');
        setError('Failed to connect to SQL REST API at http://localhost:5000');
        return;
      }
      
      // If connected but not authenticated, show login tab
      if (!isAuthenticated) {
        setConnectionStatus('connected');
        setActiveTab(1); // Switch to login tab
        return;
      }
      
      // If authenticated, try to fetch tables
      try {
        const tables = await fetchTablesFromApi();
        setDiscoveredSchemasTables(tables);
        setConnectionStatus('connected');
        setActiveTab(0); // Switch to tables tab
      } catch (authError) {
        if (authError instanceof Error && authError.message.includes('Authentication')) {
          setConnectionStatus('connected');
          setActiveTab(1); // Switch to login tab
          setError('Authentication required. Please log in.');
        } else {
          throw authError;
        }
      }
    } catch (err) {
      setConnectionStatus('error');
      setError('Connection error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleLoginSuccess = async () => {
    // After successful login, the effect will automatically load tables
    // Just clear any existing errors
    setError('');
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTableSelect = async (table: SchemaTable) => {
    setSelectedTable(table);
    setError('');
    setLoading(true);
    setLoadingMessage('Loading preview...');
    
    try {
      // Fetch first page as preview
      const data = await fetchTableData(table.schema, table.table, 1, 10);
      setPreviewData(data);
    } catch (err) {
      setError('Failed to load preview: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setPreviewData(null);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleImport = async () => {
    if (!selectedTable) {
      setError('Please select a table');
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Fetching data from database...');
    setError('');

    try {
      // Fetch all data (or up to pageSize limit)
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => Math.min(prev + 5, 90));
      }, 100);

      const data = await fetchTableData(selectedTable.schema, selectedTable.table, 1, pageSize);
      
      clearInterval(progressInterval);
      setLoadingProgress(95);
      setLoadingMessage('Converting to grid format...');

      // Convert data to cells
      const cells = new Map<string, Cell>();
      const startRow = selectedCell?.row ?? 0;
      const startCol = selectedCell?.col ?? 0;

      if (data.data.length === 0) {
        throw new Error('No data found in the selected table');
      }

      // Get column names from first row
      const columns = Object.keys(data.data[0]);
      
      // Add header row
      columns.forEach((col, colIndex) => {
        const key = `${startRow}-${startCol + colIndex}`;
        cells.set(key, {
          row: startRow,
          col: startCol + colIndex,
          value: { type: 'text', value: col, rawValue: col },
          formatting: {
            bold: true,
            fillColor: '#f0f0f0',
            borderStyle: {
              bottom: { width: 2, color: '#333', style: 'solid' },
            },
          },
        });
      });

      // Add data rows
      data.data.forEach((row, rowIndex) => {
        columns.forEach((col, colIndex) => {
          const value = row[col];
          const key = `${startRow + rowIndex + 1}-${startCol + colIndex}`;
          
          // Determine cell type and value
          let cellValue: any;
          let cellType: 'text' | 'number' | 'boolean' | 'date' = 'text';
          
          if (value === null || value === undefined) {
            cellValue = '';
          } else if (typeof value === 'boolean') {
            cellType = 'boolean';
            cellValue = value;
          } else if (typeof value === 'number') {
            cellType = 'number';
            cellValue = value;
          } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            // Check if it looks like a date
            cellType = 'date';
            cellValue = value.split('T')[0]; // Extract just the date part
          } else {
            cellValue = String(value);
          }

          cells.set(key, {
            row: startRow + rowIndex + 1,
            col: startCol + colIndex,
            value: { type: cellType, value: cellValue, rawValue: cellValue },
          });
        });
      });

      setLoadingProgress(100);
      setLoadingMessage('Import complete!');

      const rowCount = data.data.length + 1; // +1 for header
      const colCount = columns.length;

      // Brief delay before closing
      setTimeout(() => {
        onImport(cells, rowCount, colCount);
        handleClose();
      }, 500);
    } catch (err) {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
      setError('Failed to import data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleClose = () => {
    setSelectedSchema('');
    setSelectedTable(null);
    setAvailableTables([]);
    setPreviewData(null);
    setError('');
    setLoading(false);
    setLoadingProgress(0);
    setLoadingMessage('');
    onClose();
  };

  return (
    <>
    <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Storage />
        Connect to SQL Database
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Connection Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Connection Status:
            </Typography>
            {connectionStatus === 'testing' && (
              <Chip
                icon={<CircularProgress size={16} />}
                label="Testing..."
                size="small"
                color="default"
              />
            )}
            {connectionStatus === 'connected' && (
              <Chip
                icon={isAuthenticated ? <CheckCircle /> : <LoginIcon />}
                label={isAuthenticated ? "Authenticated" : "Connected - Login Required"}
                size="small"
                color={isAuthenticated ? "success" : "warning"}
              />
            )}
            {connectionStatus === 'error' && (
              <Chip
                icon={<ErrorIcon />}
                label="Connection Failed"
                size="small"
                color="error"
              />
            )}
            {connectionStatus === 'idle' && (
              <Chip label="Not Connected" size="small" color="default" />
            )}
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Tabs */}
          {connectionStatus === 'connected' && (
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab 
                label="Database Tables" 
                disabled={!isAuthenticated || discoveredSchemasTables.length === 0}
              />
              <Tab 
                label="Authentication" 
                disabled={isAuthenticated}
                icon={<LoginIcon />}
                iconPosition="start"
              />
            </Tabs>
          )}

          {/* Tab Content */}
          {connectionStatus === 'connected' && activeTab === 0 && isAuthenticated && (
            <Box sx={{ mt: 2 }}>
              {/* Schema and Table Selection */}
              {discoveredSchemasTables.length > 0 && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Schema</InputLabel>
                    <Select
                      value={selectedSchema}
                      label="Schema"
                      onChange={(e) => setSelectedSchema(e.target.value)}
                    >
                      {availableSchemas.map((schema) => (
                        <MenuItem key={schema} value={schema}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SchemaIcon fontSize="small" />
                            {schema}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {availableTables.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Available Tables:
                      </Typography>
                      <List dense sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        {availableTables.map((table) => (
                          <ListItem key={`${table.schema}.${table.table}`} disablePadding>
                            <ListItemButton
                              selected={selectedTable?.schema === table.schema && selectedTable?.table === table.table}
                              onClick={() => handleTableSelect(table)}
                            >
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TableChart fontSize="small" />
                                    {table.displayName}
                                  </Box>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {selectedTable && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Preview: {selectedTable.displayName}
                      </Typography>
                      {previewData ? (
                        <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                          <Typography variant="body2" color="text.secondary">
                            Showing {previewData.data.length} of {previewData.totalCount} records
                          </Typography>
                          {previewData.data.length > 0 && (
                            <>
                              <Box sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
                                {Object.keys(previewData.data[0]).join(' | ')}
                              </Box>
                              {previewData.data.slice(0, 5).map((row, idx) => (
                                <Box key={idx} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 0.5, mt: 0.5 }}>
                                  {Object.values(row).map((val, i) => (
                                    <span key={i}>
                                      {String(val ?? '').substring(0, 20)}
                                      {i < Object.values(row).length - 1 ? ' | ' : ''}
                                    </span>
                                  ))}
                                </Box>
                              ))}
                            </>
                          )}
                        </Box>
                      ) : loading ? (
                        <LinearProgress />
                      ) : null}
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}

          {/* Authentication Tab */}
          {connectionStatus === 'connected' && activeTab === 1 && (
            <Box 
              sx={{ 
                mt: 4, 
                mb: 4,
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 300,
                textAlign: 'center',
                gap: 3
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1
                }}
              >
                <LoginIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
              
              <Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  Authentication Required
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                  Please log in with your SQL REST API credentials to access and import database tables.
                </Typography>
              </Box>

              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                onClick={() => setLoginDialogOpen(true)}
                disabled={loading}
                sx={{
                  mt: 2,
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                  }
                }}
              >
                Login to Continue
              </Button>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Default credentials: admin / admin
                </Typography>
              </Box>
            </Box>
          )}

          {/* Loading Indicator */}
          {loading && (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {loadingMessage}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={loadingProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {loadingProgress}%
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {connectionStatus === 'error' && (
          <Button onClick={handleTestConnection} variant="outlined">
            Retry Connection
          </Button>
        )}
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!selectedTable || loading || connectionStatus !== 'connected'}
          startIcon={<Storage />}
        >
          {loading ? 'Importing...' : 'Import to Grid'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Login Dialog */}
    <LoginDialog
      open={loginDialogOpen}
      onClose={() => setLoginDialogOpen(false)}
      onLoginSuccess={handleLoginSuccess}
    />
    </>
  );
};
