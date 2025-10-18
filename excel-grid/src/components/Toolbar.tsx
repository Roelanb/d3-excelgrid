import React, { useState, useCallback, useMemo } from 'react';
import {
  AppBar,
  Toolbar as MuiToolbar,
  IconButton,
  Select,
  MenuItem,
  Divider,
  Box,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  ContentCut,
  ContentCopy,
  ContentPaste,
  ArrowDownward,
  ArrowForward,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderBottom,
  BorderLeft,
  BorderRight,
  BorderClear,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import type { CellFormatting, BorderLineStyle, CellType } from '../types/cell';
import { getCellTypeDisplayName, DATE_FORMAT_OPTIONS, NUMBER_FORMAT_OPTIONS } from '../utils/dataTypeInference';

interface ToolbarProps {
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCopyDown: () => void;
  onCopyRight: () => void;
  onFormat: (formatting: Partial<CellFormatting>) => void;
  onCellTypeChange?: (cellType: CellType) => void;
  currentFormatting?: CellFormatting;
  currentCellType?: CellType;
  disabled?: boolean;
  pasteDisabled?: boolean;
}

const FONT_FAMILIES = [
  'Arial',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Comic Sans MS',
  'Trebuchet MS',
  'Arial Black',
  'Impact',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

const CELL_TYPES: CellType[] = [
  'text',
  'number',
  'date',
  'datetime',
  'time',
  'boolean',
  'percentage',
  'currency',
  'duration',
  'email',
  'phone',
  'uri',
  'guid',
];

const ToolbarComponent: React.FC<ToolbarProps> = ({
  onCut,
  onCopy,
  onPaste,
  onCopyDown,
  onCopyRight,
  onFormat,
  onCellTypeChange,
  currentFormatting,
  currentCellType,
  disabled = false,
  pasteDisabled = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleFontFamilyChange = useCallback((event: SelectChangeEvent<string>) => {
    onFormat({ fontFamily: event.target.value });
  }, [onFormat]);

  const handleFontSizeChange = useCallback((event: SelectChangeEvent<number>) => {
    onFormat({ fontSize: event.target.value as number });
  }, [onFormat]);

  const handleCellTypeChange = useCallback((event: SelectChangeEvent<string>) => {
    if (onCellTypeChange) {
      onCellTypeChange(event.target.value as CellType);
    }
  }, [onCellTypeChange, onFormat]);

  const handleDateFormatChange = useCallback((event: SelectChangeEvent<string>) => {
    onFormat({ dateFormat: event.target.value });
  }, [onFormat]);

  const handleNumberFormatChange = useCallback((event: SelectChangeEvent<string>) => {
    onFormat({ numberFormat: event.target.value });
  }, [onFormat]);

  const handleBoldToggle = useCallback(() => {
    onFormat({ bold: !currentFormatting?.bold });
  }, [onFormat, currentFormatting?.bold]);

  const handleItalicToggle = useCallback(() => {
    onFormat({ italic: !currentFormatting?.italic });
  }, [onFormat, currentFormatting?.italic]);

  const handleUnderlineToggle = useCallback(() => {
    onFormat({ underline: !currentFormatting?.underline });
  }, [onFormat, currentFormatting?.underline]);

  const handleAlignLeft = useCallback(() => {
    onFormat({ textAlign: 'left' });
  }, [onFormat]);

  const handleAlignCenter = useCallback(() => {
    onFormat({ textAlign: 'center' });
  }, [onFormat]);

  const handleAlignRight = useCallback(() => {
    onFormat({ textAlign: 'right' });
  }, [onFormat]);

  const handleTextColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onFormat({ textColor: event.target.value });
  }, [onFormat]);

  const handleFillColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onFormat({ fillColor: event.target.value });
  }, [onFormat]);

  const handleBorderStyle = useCallback((borderType: string) => {
    const defaultBorder = { width: 1, color: '#000000', style: 'solid' as BorderLineStyle };
    
    switch (borderType) {
      case 'all':
        onFormat({
          borderStyle: {
            top: defaultBorder,
            right: defaultBorder,
            bottom: defaultBorder,
            left: defaultBorder,
          },
        });
        break;
      case 'outer':
        onFormat({
          borderStyle: {
            top: defaultBorder,
            right: defaultBorder,
            bottom: defaultBorder,
            left: defaultBorder,
          },
        });
        break;
      case 'top':
        onFormat({
          borderStyle: {
            top: defaultBorder,
          },
        });
        break;
      case 'bottom':
        onFormat({
          borderStyle: {
            bottom: defaultBorder,
          },
        });
        break;
      case 'left':
        onFormat({
          borderStyle: {
            left: defaultBorder,
          },
        });
        break;
      case 'right':
        onFormat({
          borderStyle: {
            right: defaultBorder,
          },
        });
        break;
      case 'none':
        onFormat({
          borderStyle: undefined,
        });
        break;
    }
  }, [onFormat]);

  const allOptions = useMemo(() => [...DATE_FORMAT_OPTIONS, ...NUMBER_FORMAT_OPTIONS], []);

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ mb: 2 }}>
      <MuiToolbar 
        variant="dense" 
        sx={{ 
          gap: 0.5, 
          minHeight: 40,
          py: 0.5,
          display: 'flex',
          flexWrap: 'nowrap',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            height: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 2,
          }
        }}
      >
        {/* Collapse/Expand Button */}
        <Tooltip title={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}>
          <IconButton size="small" onClick={() => setCollapsed(!collapsed)} sx={{ minWidth: 32 }}>
            {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
          </IconButton>
        </Tooltip>

        {!collapsed && (
          <>
            {/* Clipboard Operations */}
            <Tooltip title="Cut (Ctrl+X)">
              <span>
                <IconButton size="small" onClick={onCut} disabled={disabled} sx={{ minWidth: 32 }}>
                  <ContentCut fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Copy (Ctrl+C)">
              <span>
                <IconButton size="small" onClick={onCopy} disabled={disabled} sx={{ minWidth: 32 }}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Paste (Ctrl+V)">
              <span>
                <IconButton size="small" onClick={onPaste} disabled={pasteDisabled} sx={{ minWidth: 32 }}>
                  <ContentPaste fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Copy Down (Ctrl+D)">
              <span>
                <IconButton size="small" onClick={onCopyDown} disabled={disabled} sx={{ minWidth: 32 }}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Copy Right (Ctrl+R)">
              <span>
                <IconButton size="small" onClick={onCopyRight} disabled={disabled} sx={{ minWidth: 32 }}>
                  <ArrowForward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Cell Type */}
            <Select
              value={currentCellType || 'text'}
              onChange={handleCellTypeChange}
              size="small"
              disabled={disabled}
              sx={{ minWidth: 120, height: 28, fontSize: '0.875rem' }}
            >
              {CELL_TYPES.map((type) => (
                <MenuItem key={type} value={type} sx={{ fontSize: '0.875rem' }}>
                  {getCellTypeDisplayName(type)}
                </MenuItem>
              ))}
            </Select>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Unified Format Dropdown */}
            <Select
              value={
                currentCellType === 'date' || currentCellType === 'datetime'
                  ? currentFormatting?.dateFormat ?? ''
                  : currentFormatting?.numberFormat ?? ''
              }
              onChange={(event) => {
                if (currentCellType === 'date' || currentCellType === 'datetime') {
                  handleDateFormatChange(event);
                } else {
                  handleNumberFormatChange(event);
                }
              }}
              size="small"
              disabled={
                disabled ||
                !(
                  currentCellType === 'date' ||
                  currentCellType === 'datetime' ||
                  currentCellType === 'number' ||
                  currentCellType === 'percentage' ||
                  currentCellType === 'currency'
                )
              }
              displayEmpty
              renderValue={(value) => {
                if (!value) return <span style={{ color: '#999' }}>Format</span>;
                const option = allOptions.find((opt) => opt.value === value);
                return option?.label || value;
              }}
              sx={{ minWidth: 180, height: 28, fontSize: '0.875rem' }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 400,
                  },
                },
              }}
            >
              {(currentCellType === 'date' || currentCellType === 'datetime') &&
                DATE_FORMAT_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value || 'default'}
                    value={option.value}
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              {(currentCellType === 'number' ||
                currentCellType === 'percentage' ||
                currentCellType === 'currency') &&
                NUMBER_FORMAT_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value || 'general'}
                    value={option.value}
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
            </Select>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Font Family */}
            <Select
              value={currentFormatting?.fontFamily || 'Arial'}
              onChange={handleFontFamilyChange}
              size="small"
              disabled={disabled}
              sx={{ minWidth: 100, height: 28, fontSize: '0.875rem' }}
            >
              {FONT_FAMILIES.map((font) => (
                <MenuItem key={font} value={font} sx={{ fontFamily: font, fontSize: '0.875rem' }}>
                  {font}
                </MenuItem>
              ))}
            </Select>

            {/* Font Size */}
            <Select
              value={currentFormatting?.fontSize || 12}
              onChange={handleFontSizeChange}
              size="small"
              disabled={disabled}
              sx={{ minWidth: 50, height: 28, fontSize: '0.875rem' }}
            >
              {FONT_SIZES.map((size) => (
                <MenuItem key={size} value={size} sx={{ fontSize: '0.875rem' }}>
                  {size}
                </MenuItem>
              ))}
            </Select>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Text Style */}
            <ToggleButtonGroup size="small" sx={{ height: 28 }}>
              <Tooltip title="Bold">
                <ToggleButton
                  value="bold"
                  selected={currentFormatting?.bold || false}
                  onChange={handleBoldToggle}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatBold fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Italic">
                <ToggleButton
                  value="italic"
                  selected={currentFormatting?.italic || false}
                  onChange={handleItalicToggle}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatItalic fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Underline">
                <ToggleButton
                  value="underline"
                  selected={currentFormatting?.underline || false}
                  onChange={handleUnderlineToggle}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatUnderlined fontSize="small" />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Text Alignment */}
            <ToggleButtonGroup size="small" sx={{ height: 28 }} value={currentFormatting?.textAlign || 'left'} exclusive>
              <Tooltip title="Align left">
                <ToggleButton
                  value="left"
                  selected={currentFormatting?.textAlign === 'left' || !currentFormatting?.textAlign}
                  onChange={handleAlignLeft}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatAlignLeft fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Align center">
                <ToggleButton
                  value="center"
                  selected={currentFormatting?.textAlign === 'center'}
                  onChange={handleAlignCenter}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatAlignCenter fontSize="small" />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Align right">
                <ToggleButton
                  value="right"
                  selected={currentFormatting?.textAlign === 'right'}
                  onChange={handleAlignRight}
                  disabled={disabled}
                  sx={{ px: 1, py: 0.5, minWidth: 32 }}
                >
                  <FormatAlignRight fontSize="small" />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Text Color */}
            <Tooltip title="Text color">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="color"
                  value={currentFormatting?.textColor || '#000000'}
                  onChange={handleTextColorChange}
                  disabled={disabled}
                  style={{
                    width: 28,
                    height: 28,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                />
              </Box>
            </Tooltip>

            {/* Fill Color */}
            <Tooltip title="Fill color">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="color"
                  value={currentFormatting?.fillColor || '#ffffff'}
                  onChange={handleFillColorChange}
                  disabled={disabled}
                  style={{
                    width: 28,
                    height: 28,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                />
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Border Styles */}
            <Tooltip title="All borders">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('all')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderAll fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Outer borders">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('outer')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderOuter fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Top border">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('top')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderTop fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Bottom border">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('bottom')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderBottom fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Left border">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('left')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderLeft fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Right border">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('right')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderRight fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="No borders">
              <span>
                <IconButton size="small" onClick={() => handleBorderStyle('none')} disabled={disabled} sx={{ minWidth: 32 }}>
                  <BorderClear fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      </MuiToolbar>
    </AppBar>
  );
};

export const Toolbar = React.memo(ToolbarComponent);
