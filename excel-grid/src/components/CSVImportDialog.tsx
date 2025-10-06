import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { Upload } from '@mui/icons-material';
import { parseCSV, readFileAsText, detectDelimiter, type CSVImportOptions } from '../utils/csvImport';
import type { Cell } from '../types/cell';

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (cells: Map<string, Cell>, rowCount: number, colCount: number, tableMetadata?: any) => void;
  selectedCell?: { row: number; col: number } | null;
}

export const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  open,
  onClose,
  onImport,
  selectedCell,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [startRow, setStartRow] = useState<number>(selectedCell?.row ?? 0);
  const [startCol, setStartCol] = useState<number>(selectedCell?.col ?? 0);
  const [trimValues, setTrimValues] = useState<boolean>(true);
  const [skipEmptyLines, setSkipEmptyLines] = useState<boolean>(true);
  const [applyTableStyle, setApplyTableStyle] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update start position when selectedCell changes
  useEffect(() => {
    if (selectedCell) {
      setStartRow(selectedCell.row);
      setStartCol(selectedCell.col);
    }
  }, [selectedCell]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Reading file...');

    try {
      // Simulate progress for file reading
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const content = await readFileAsText(selectedFile);
      
      clearInterval(progressInterval);
      setLoadingProgress(95);
      setLoadingMessage('Detecting format...');
      
      // Auto-detect delimiter
      const detectedDelimiter = detectDelimiter(content);
      setDelimiter(detectedDelimiter);

      // Show preview (first 5 lines)
      const lines = content.split(/\r?\n/).slice(0, 5);
      setPreview(lines.join('\n'));
      
      setLoadingProgress(100);
      setLoadingMessage('Ready to import');
      
      // Clear loading state after a brief moment
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
        setLoadingMessage('');
      }, 500);
    } catch (err) {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
      setError('Failed to read file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Reading file...');
    setError('');

    try {
      // Simulate progress for file reading
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => Math.min(prev + 5, 50));
      }, 100);

      const content = await readFileAsText(file);
      
      clearInterval(progressInterval);
      setLoadingProgress(60);
      setLoadingMessage('Parsing CSV data...');
      
      const options: CSVImportOptions = {
        delimiter,
        hasHeader,
        startRow,
        startCol,
        trimValues,
        skipEmptyLines,
        applyTableStyle,
      };

      // Add a small delay to show parsing message
      await new Promise(resolve => setTimeout(resolve, 200));
      setLoadingProgress(80);
      
      const result = parseCSV(content, options);
      
      setLoadingProgress(90);
      setLoadingMessage('Importing to grid...');
      
      // Add a small delay before import
      await new Promise(resolve => setTimeout(resolve, 200));
      
      onImport(result.cells, result.rowCount, result.colCount, result.tableMetadata);
      
      setLoadingProgress(100);
      setLoadingMessage('Import complete!');
      
      // Brief delay before closing
      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (err) {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
      setError('Failed to import CSV: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleClose = () => {
    setFile(null);
    setDelimiter(',');
    setHasHeader(true);
    setStartRow(selectedCell?.row ?? 0);
    setStartCol(selectedCell?.col ?? 0);
    setTrimValues(true);
    setSkipEmptyLines(true);
    setApplyTableStyle(true);
    setError('');
    setPreview('');
    setLoading(false);
    setLoadingProgress(0);
    setLoadingMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import CSV File</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* File Selection */}
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={loading}
            />
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={handleBrowse}
              fullWidth
              disabled={loading}
            >
              {file ? file.name : 'Choose CSV File'}
            </Button>
          </Box>

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

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Import Options */}
          {file && !loading && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl size="small">
                  <InputLabel>Delimiter</InputLabel>
                  <Select
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    label="Delimiter"
                  >
                    <MenuItem value=",">Comma (,)</MenuItem>
                    <MenuItem value=";">Semicolon (;)</MenuItem>
                    <MenuItem value="\t">Tab</MenuItem>
                    <MenuItem value="|">Pipe (|)</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                    />
                  }
                  label="First row is header"
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Start Row"
                  type="number"
                  size="small"
                  value={startRow}
                  onChange={(e) => setStartRow(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="Start Column"
                  type="number"
                  size="small"
                  value={startCol}
                  onChange={(e) => setStartCol(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                />
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={trimValues}
                      onChange={(e) => setTrimValues(e.target.checked)}
                    />
                  }
                  label="Trim whitespace from values"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={skipEmptyLines}
                      onChange={(e) => setSkipEmptyLines(e.target.checked)}
                    />
                  }
                  label="Skip empty lines"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={applyTableStyle}
                      onChange={(e) => setApplyTableStyle(e.target.checked)}
                    />
                  }
                  label="Apply table styling (borders and header formatting)"
                />
              </Box>

              {/* Preview */}
              {preview && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview (first 5 lines):
                  </Typography>
                  <TextField
                    multiline
                    rows={5}
                    value={preview}
                    fullWidth
                    size="small"
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!file || loading}
        >
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
