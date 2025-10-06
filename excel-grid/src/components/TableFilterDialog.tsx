import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  Box,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search } from '@mui/icons-material';

interface TableFilterDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (selectedValues: Set<string>) => void;
  columnName: string;
  values: string[];
  currentFilter?: Set<string>;
}

export const TableFilterDialog: React.FC<TableFilterDialogProps> = ({
  open,
  onClose,
  onApply,
  columnName,
  values,
  currentFilter,
}) => {
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set(values));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      // Initialize with current filter or all values
      setSelectedValues(currentFilter || new Set(values));
      setSearchTerm('');
    }
  }, [open, values, currentFilter]);

  const filteredValues = values.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (value: string) => {
    const newSelected = new Set(selectedValues);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelectedValues(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedValues(new Set(filteredValues));
  };

  const handleClearAll = () => {
    setSelectedValues(new Set());
  };

  const handleApply = () => {
    onApply(selectedValues);
    onClose();
  };

  const handleClear = () => {
    onApply(new Set(values)); // Reset to all values
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Filter: {columnName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {/* Select/Clear All */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="small" onClick={handleClearAll}>
              Clear All
            </Button>
          </Box>

          {/* Values List */}
          <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <List dense>
              {filteredValues.length === 0 ? (
                <ListItem>
                  <Typography variant="body2" color="text.secondary">
                    No values found
                  </Typography>
                </ListItem>
              ) : (
                filteredValues.map((value) => (
                  <ListItem key={value} sx={{ py: 0 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedValues.has(value)}
                          onChange={() => handleToggle(value)}
                          size="small"
                        />
                      }
                      label={value || '(Blank)'}
                      sx={{ width: '100%' }}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Box>

          {/* Summary */}
          <Typography variant="caption" color="text.secondary">
            {selectedValues.size} of {values.length} selected
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClear}>Clear Filter</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleApply} variant="contained">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
