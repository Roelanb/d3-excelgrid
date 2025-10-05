import { Container, Typography, Box, Button, Stack } from '@mui/material';
import { useRef, useState } from 'react';
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import './App.css';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [counter, setCounter] = useState(1);

  const handleClear = () => {
    gridRef.current?.clearGrid();
  };

  const handlePopulateTest = () => {
    // B2 to B15 (column B is index 1, rows 1-14 in 0-indexed)
    gridRef.current?.setCellRange(1, 1, 14, 1, 'test');
  };

  const handlePerformanceTest = () => {
     for (let j = 0; j < 20; j++) {
      for (let i = 0; i < 50; i++) {
        gridRef.current?.setCellValue(i, j, String(counter + i));
      }
      
    }
    setCounter(counter + 20);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Excel Grid Component
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click to select a cell, double-click to edit. Supports text, numbers, dates (YYYY-MM-DD), and booleans (true/false).
          <br />
          <strong>Tip:</strong> Select multiple columns by clicking column headers, then resize any selected column to resize all of them together.
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" color="primary" onClick={handlePopulateTest}>
          Populate B2:B15 with 'test'
        </Button>
        <Button variant="contained" color="success" onClick={handlePerformanceTest}>
          Performance Test (C1:C20)
        </Button>
        <Button variant="outlined" color="secondary" onClick={handleClear}>
          Clear Grid
        </Button>
      </Stack>
      <ExcelGrid
        ref={gridRef}
        initialRows={1000}
        initialCols={500}
        cellWidth={100}
        cellHeight={30}
      />
    </Container>
  );
}

export default App;
