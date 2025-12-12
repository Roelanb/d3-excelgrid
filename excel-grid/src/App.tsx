import { Container, Typography, Box, Button, Stack, Snackbar, Alert } from '@mui/material';
import { GitHub } from '@mui/icons-material';
import { Routes, Route, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import { Toolbar } from './components/Toolbar';
import { CSVImportDialog } from './components/CSVImportDialog';
import { SQLConnectionDialog } from './components/SQLConnectionDialog';
import { TablePage } from './components/TablePage';
import type { CellFormatting, Cell, CellType, DatabaseMetadata } from './types/cell';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/table" element={<TablePage />} />
    </Routes>
  );
}

function HomePage() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [counter, setCounter] = useState(1);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentFormatting, setCurrentFormatting] = useState<CellFormatting | undefined>(undefined);
  const [currentCellType, setCurrentCellType] = useState<CellType | undefined>(undefined);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasDatabase, setHasDatabase] = useState(false);
  const [currentDatabaseId, setCurrentDatabaseId] = useState<string | null>(null);

  const handleClear = () => {
    gridRef.current?.clearGrid();
  };

  const handlePopulateTest = () => {
    gridRef.current?.setCellRange(1, 1, 14, 1, 'test');
  };

  const handlePerformanceTest = () => {
    const cells = new Map<string, Cell>();
    for (let j = 0; j < 20; j++) {
      for (let i = 0; i < 50; i++) {
        const key = `${i}-${j}`;
        cells.set(key, {
          row: i,
          col: j,
          value: { type: 'text', value: String(counter + i), rawValue: String(counter + i) },
        });
      }
    }
    gridRef.current?.importCells(cells, false);
    setCounter(counter + 20);
  };

  const handleSelectionChange = (selection: boolean, formatting?: CellFormatting) => {
    setHasSelection(selection);
    setCurrentFormatting(formatting);
    if (selection && gridRef.current) {
      const cellType = gridRef.current.getSelectedCellType();
      setCurrentCellType(cellType);
    } else {
      setCurrentCellType(undefined);
    }
  };

  const handleClipboardChange = (clipboard: boolean) => {
    setHasClipboard(clipboard);
  };

  const handleCut = () => {
    gridRef.current?.cutCells();
  };

  const handleCopy = () => {
    gridRef.current?.copyCells();
  };

  const handlePaste = () => {
    gridRef.current?.pasteCells();
  };

  const handleCopyDown = () => {
    gridRef.current?.copyDown();
  };

  const handleCopyRight = () => {
    gridRef.current?.copyRight();
  };

  const handleAddRows = () => {
    gridRef.current?.addRows(10);
  };

  const handleAddColumns = () => {
    gridRef.current?.addColumns(5);
  };

  const handleFormat = (formatting: Partial<CellFormatting>) => {
    gridRef.current?.formatCells(formatting);
  };

  const handleCellTypeChange = (cellType: CellType) => {
    gridRef.current?.setCellType(cellType);
    setCurrentCellType(cellType);
  };

  const handleCSVImport = (cells: Map<string, Cell>, rowCount: number, colCount: number, tableMetadata?: any) => {
    gridRef.current?.importCells(cells, true, tableMetadata);
    
    const currentRows = 1000;
    const currentCols = 500;
    const needsExpansion = rowCount > currentRows || colCount > currentCols;
    
    if (needsExpansion) {
      const newRows = Math.max(rowCount, currentRows);
      const newCols = Math.max(colCount, currentCols);
      setSnackbarMessage(`Grid expanded to ${newRows} rows × ${newCols} columns to fit imported data`);
      setSnackbarOpen(true);
    } else {
      setSnackbarMessage(`Imported ${cells.size} cells successfully`);
      setSnackbarOpen(true);
    }
  };

  const handleSQLImport = (cells: Map<string, Cell>, _rowCount: number, _colCount: number, databaseMetadata?: DatabaseMetadata) => {
    gridRef.current?.importCells(cells, false, undefined, databaseMetadata);
    if (databaseMetadata) {
      setHasDatabase(true);
      setCurrentDatabaseId(databaseMetadata.id);
    }
    setSnackbarMessage(`Imported ${cells.size} cells from database`);
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  const handleEditModeChange = (editMode: boolean) => {
    setIsEditMode(editMode);
  };

  const handleEnterEditMode = async () => {
    if (!currentDatabaseId) {
      setSnackbarMessage('No database table loaded');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      await gridRef.current?.enterEditMode(currentDatabaseId);
      setSnackbarMessage('Edit mode activated');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(error instanceof Error ? error.message : 'Failed to enter edit mode');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const result = await gridRef.current?.saveChanges();
      if (!result) return;

      if (result.failed === 0) {
        setSnackbarMessage(`Successfully saved ${result.success} changes`);
        setSnackbarSeverity('success');
      } else {
        setSnackbarMessage(`Saved ${result.success} changes, ${result.failed} failed. Check console for details.`);
        setSnackbarSeverity('warning');
        console.error('Save errors:', result.errors);
      }
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(error instanceof Error ? error.message : 'Failed to save changes');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleExitEditMode = async (save: boolean) => {
    try {
      await gridRef.current?.exitEditMode(save);
      const message = save ? 'Edit mode exited, changes saved' : 'Edit mode exited, changes discarded';
      setSnackbarMessage(message);
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(error instanceof Error ? error.message : 'Failed to exit edit mode');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleAddNewRow = () => {
    gridRef.current?.addNewRow();
    setSnackbarMessage('New row added');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  const handleDeleteRows = () => {
    gridRef.current?.deleteSelectedRows();
    setSnackbarMessage('Selected rows marked for deletion');
    setSnackbarSeverity('warning');
    setSnackbarOpen(true);
  };

  return (
    <>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 4,
          mb: 4,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Excel Grid Component
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.95 }}>
                A high-performance, feature-rich Excel-like grid built with React, TypeScript, and D3.js
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                component={Link}
                to="/table"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  whiteSpace: 'nowrap',
                }}
              >
                Fast Table Demo
              </Button>
              <Button
                variant="contained"
                startIcon={<GitHub />}
                href="https://github.com/Roelanb/d3-excelgrid"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  whiteSpace: 'nowrap',
                }}
              >
                View on GitHub
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
      <Container maxWidth="xl" sx={{ py: 1 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Click to select a cell, double-click to edit. Supports text, numbers, dates (YYYY-MM-DD), and booleans (true/false).
            <br />
            <strong>Tip:</strong> Select multiple columns by clicking column headers, then resize any selected column to resize all of them together.
            <br />
            <strong>New:</strong> Use the toolbar to format cells with fonts, colors, and borders. Use Ctrl+C/X/V for clipboard operations.
            <br />
            <strong>CSV Import:</strong> Select a cell first, then import CSV to place data at that position with optional table styling.
          </Typography>
        </Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" color="primary" onClick={() => setCsvDialogOpen(true)}>
          Import CSV
        </Button>
        <Button variant="contained" color="primary" onClick={() => setSqlDialogOpen(true)}>
          Connect to Database
        </Button>
        <Button variant="contained" color="primary" onClick={handlePopulateTest}>
          Populate B2:B15 with 'test'
        </Button>
        <Button variant="contained" color="success" onClick={handlePerformanceTest}>
          Performance Test (C1:C20)
        </Button>
        <Button variant="outlined" color="info" onClick={handleAddRows}>
          Add 10 Rows
        </Button>
        <Button variant="outlined" color="info" onClick={handleAddColumns}>
          Add 5 Columns
        </Button>
        <Button variant="outlined" color="secondary" onClick={handleClear}>
          Clear Grid
        </Button>
      </Stack>

      {hasDatabase && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, p: 2, bgcolor: isEditMode ? '#fff3e0' : '#e3f2fd', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
            {isEditMode ? '✏️ Edit Mode Active' : '📊 Database Table Loaded'}
          </Typography>
          {!isEditMode ? (
            <Button variant="contained" color="warning" onClick={handleEnterEditMode}>
              Enter Edit Mode
            </Button>
          ) : (
            <>
              <Button variant="contained" color="success" onClick={handleSaveChanges}>
                Save Changes
              </Button>
              <Button variant="outlined" color="error" onClick={() => handleExitEditMode(false)}>
                Cancel
              </Button>
              <Button variant="outlined" color="primary" onClick={handleAddNewRow}>
                Add Row
              </Button>
              <Button variant="outlined" color="error" onClick={handleDeleteRows} disabled={!hasSelection}>
                Delete Selected Rows
              </Button>
            </>
          )}
        </Stack>
      )}
      <Toolbar
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onCopyDown={handleCopyDown}
        onCopyRight={handleCopyRight}
        onFormat={handleFormat}
        onCellTypeChange={handleCellTypeChange}
        currentFormatting={currentFormatting}
        currentCellType={currentCellType}
        disabled={!hasSelection}
        pasteDisabled={!hasClipboard}
      />
      <ExcelGrid
        ref={gridRef}
        initialRows={1000}
        initialCols={500}
        cellWidth={100}
        cellHeight={30}
        onSelectionChange={handleSelectionChange}
        onClipboardChange={handleClipboardChange}
        onEditModeChange={handleEditModeChange}
      />
      <CSVImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleCSVImport}
        selectedCell={gridRef.current?.getSelectedCell() ?? null}
      />
      <SQLConnectionDialog
        open={sqlDialogOpen}
        onClose={() => setSqlDialogOpen(false)}
        onImport={handleSQLImport}
        selectedCell={gridRef.current?.getSelectedCell() ?? null}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
    </>
  );
}

export default App;
