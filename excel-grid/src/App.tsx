import { Container, Typography, Box, Button, Stack, Snackbar, Alert } from '@mui/material';
import { useRef, useState } from 'react';
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import { Toolbar } from './components/Toolbar';
import { CSVImportDialog } from './components/CSVImportDialog';
import type { CellFormatting, Cell, CellType } from './types/cell';
import './App.css';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [counter, setCounter] = useState(1);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentFormatting, setCurrentFormatting] = useState<CellFormatting | undefined>(undefined);
  const [currentCellType, setCurrentCellType] = useState<CellType | undefined>(undefined);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleClear = () => {
    gridRef.current?.clearGrid();
  };

  const handlePopulateTest = () => {
    // B2 to B15 (column B is index 1, rows 1-14 in 0-indexed)
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
    // Update cell type when selection changes
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
    
    // Show notification if grid was expanded
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

  return (
    <Container maxWidth="xl" sx={{ py: 1 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Excel Grid Component
        </Typography>
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
      />
      <CSVImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleCSVImport}
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
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
