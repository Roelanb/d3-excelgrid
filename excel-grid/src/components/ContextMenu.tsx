import React, { useState, useEffect } from 'react';
import { Menu, MenuItem, Divider } from '@mui/material';
import {
  ContentCut,
  ContentCopy,
  ContentPaste,
  Delete,
  AddBox,
  RemoveCircle,
  FormatColorFill,
  ArrowDownward,
  ArrowForward,
  SelectAll,
} from '@mui/icons-material';

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onInsertRowsAbove: () => void;
  onInsertRowsBelow: () => void;
  onInsertColumnsLeft: () => void;
  onInsertColumnsRight: () => void;
  onDeleteRows: () => void;
  onDeleteColumns: () => void;
  onFormatCells: () => void;
  onClearFormatting: () => void;
  onCopyDown: () => void;
  onCopyRight: () => void;
  onSelectAll: () => void;
  hasSelection: boolean;
  hasClipboard: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  open,
  x,
  y,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onInsertRowsAbove,
  onInsertRowsBelow,
  onInsertColumnsLeft,
  onInsertColumnsRight,
  onDeleteRows,
  onDeleteColumns,
  onFormatCells,
  onClearFormatting,
  onCopyDown,
  onCopyRight,
  onSelectAll,
  hasSelection,
  hasClipboard,
}) => {
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && x !== undefined && y !== undefined) {
      setAnchorPosition({ top: y, left: x });
    }
  }, [open, x, y]);

  const handleMenuItemClick = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorPosition={anchorPosition || undefined}
      anchorReference="anchorPosition"
      slotProps={{
        paper: {
          sx: {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '200px',
          },
        },
      }}
    >
      {/* Cell Operations */}
      <MenuItem
        onClick={() => handleMenuItemClick(onCut)}
        disabled={!hasSelection}
        dense
      >
        <ContentCut sx={{ mr: 1, fontSize: '1.2rem' }} />
        Cut
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onCopy)}
        disabled={!hasSelection}
        dense
      >
        <ContentCopy sx={{ mr: 1, fontSize: '1.2rem' }} />
        Copy
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onPaste)}
        disabled={!hasClipboard}
        dense
      >
        <ContentPaste sx={{ mr: 1, fontSize: '1.2rem' }} />
        Paste
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onDelete)}
        disabled={!hasSelection}
        dense
      >
        <Delete sx={{ mr: 1, fontSize: '1.2rem' }} />
        Delete
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Insert/Delete Rows & Columns */}
      <MenuItem
        onClick={() => handleMenuItemClick(onInsertRowsAbove)}
        disabled={!hasSelection}
        dense
      >
        <AddBox sx={{ mr: 1, fontSize: '1.2rem' }} />
        Insert Rows Above
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onInsertRowsBelow)}
        disabled={!hasSelection}
        dense
      >
        <AddBox sx={{ mr: 1, fontSize: '1.2rem' }} />
        Insert Rows Below
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onInsertColumnsLeft)}
        disabled={!hasSelection}
        dense
      >
        <AddBox sx={{ mr: 1, fontSize: '1.2rem' }} />
        Insert Columns Left
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onInsertColumnsRight)}
        disabled={!hasSelection}
        dense
      >
        <AddBox sx={{ mr: 1, fontSize: '1.2rem' }} />
        Insert Columns Right
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onDeleteRows)}
        disabled={!hasSelection}
        dense
      >
        <RemoveCircle sx={{ mr: 1, fontSize: '1.2rem' }} />
        Delete Rows
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onDeleteColumns)}
        disabled={!hasSelection}
        dense
      >
        <RemoveCircle sx={{ mr: 1, fontSize: '1.2rem' }} />
        Delete Columns
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Formatting */}
      <MenuItem
        onClick={() => handleMenuItemClick(onFormatCells)}
        disabled={!hasSelection}
        dense
      >
        <FormatColorFill sx={{ mr: 1, fontSize: '1.2rem' }} />
        Format Cells...
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onClearFormatting)}
        disabled={!hasSelection}
        dense
      >
        <FormatColorFill sx={{ mr: 1, fontSize: '1.2rem' }} />
        Clear Formatting
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Data Operations */}
      <MenuItem
        onClick={() => handleMenuItemClick(onCopyDown)}
        disabled={!hasSelection}
        dense
      >
        <ArrowDownward sx={{ mr: 1, fontSize: '1.2rem' }} />
        Fill Down
      </MenuItem>
      <MenuItem
        onClick={() => handleMenuItemClick(onCopyRight)}
        disabled={!hasSelection}
        dense
      >
        <ArrowForward sx={{ mr: 1, fontSize: '1.2rem' }} />
        Fill Right
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Selection */}
      <MenuItem onClick={() => handleMenuItemClick(onSelectAll)} dense>
        <SelectAll sx={{ mr: 1, fontSize: '1.2rem' }} />
        Select All
      </MenuItem>
    </Menu>
  );
};
