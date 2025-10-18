import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Paper, TextField } from '@mui/material';
import type { Cell, CellValue, GridData, CellFormatting, CellType, TableMetadata, SortDirection } from '../types/cell';
import { getCellKey, getColumnLabel } from '../types/cell';
import { copyCellsToClipboard, cutCellsToClipboard, pasteCellsFromClipboard, getSelectedCellsInRange, type ClipboardData } from '../utils/clipboard';
import { inferCellValue, formatCellValue as formatCellValueUtil } from '../utils/dataTypeInference';
import { TableFilterDialog } from './TableFilterDialog';

type SelectionRange = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type SelectionType = 'cell' | 'row' | 'column';

export interface ExcelGridHandle {
  clearGrid: () => void;
  setCellValue: (row: number, col: number, value: string) => void;
  setCellRange: (startRow: number, startCol: number, endRow: number, endCol: number, value: string) => void;
  formatCells: (formatting: Partial<CellFormatting>) => void;
  copyCells: () => void;
  cutCells: () => void;
  pasteCells: () => void;
  copyDown: () => void;
  copyRight: () => void;
  getSelectedFormatting: () => CellFormatting | undefined;
  getSelectedCell: () => { row: number; col: number } | null;
  getSelectedCellType: () => CellType | undefined;
  setCellType: (cellType: CellType) => void;
  importCells: (cells: Map<string, Cell>, autoExpand?: boolean, tableMetadata?: any) => void;
  batchUpdateCells: (updates: Array<{ row: number; col: number; value: string }>) => void;
}

interface ExcelGridProps {
  initialRows?: number;
  initialCols?: number;
  cellWidth?: number;
  cellHeight?: number;
  headerWidth?: number;
  headerHeight?: number;
  onSelectionChange?: (hasSelection: boolean, formatting?: CellFormatting) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
}

export interface ExcelGridHandle {
  clearGrid: () => void;
  setCellValue: (row: number, col: number, value: string) => void;
  setCellRange: (startRow: number, startCol: number, endRow: number, endCol: number, value: string) => void;
  formatCells: (formatting: Partial<CellFormatting>) => void;
  copyCells: () => void;
  cutCells: () => void;
  pasteCells: () => void;
  copyDown: () => void;
  copyRight: () => void;
  getSelectedFormatting: () => CellFormatting | undefined;
  getSelectedCell: () => { row: number; col: number } | null;
  getSelectedCellType: () => CellType | undefined;
  setCellType: (cellType: CellType) => void;
  importCells: (cells: Map<string, Cell>, autoExpand?: boolean, tableMetadata?: any) => void;
}

function ExcelGridComponent(
  props: ExcelGridProps,
  ref: React.ForwardedRef<ExcelGridHandle>,
): React.ReactElement {
  const {
    initialRows = 500,
    initialCols = 260,
    cellWidth = 100,
    cellHeight = 30,
    headerWidth = 50,
    headerHeight = 30,
    onSelectionChange,
    onClipboardChange,
  } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridData, setGridData] = useState<GridData>({
    cells: new Map(),
    rowCount: initialRows,
    colCount: initialCols,
  });
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [selectionRanges, setSelectionRanges] = useState<SelectionRange[]>([]);
  const [selectionType, setSelectionType] = useState<SelectionType>('cell');
  const [isDragging, setIsDragging] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [rowHeights, setRowHeights] = useState<Map<number, number>>(new Map());
  const [resizing, setResizing] = useState<{ type: 'col' | 'row'; index: number; startPos: number; startSize: number; affectedIndices: number[] } | null>(null);
  const [viewport, setViewport] = useState({ startRow: 0, endRow: 50, startCol: 0, endCol: 20 });
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);
  const [tables, setTables] = useState<Map<string, TableMetadata>>(new Map());
  const [filterDialog, setFilterDialog] = useState<{ open: boolean; tableId: string; column: number; columnName: string } | null>(null);
  const [tableHeaderCellKeys, setTableHeaderCellKeys] = useState<Map<string, string>>(new Map());
  const [selectionCellKeys, setSelectionCellKeys] = useState<Set<string>>(new Set());
  const [visibleRowsCache, setVisibleRowsCache] = useState<Map<string, Set<number>>>(new Map());

  const selectionRangeRef = useRef<SelectionRange | null>(selectionRange);
  const selectionRangesRef = useRef<SelectionRange[]>(selectionRanges);
  const isDraggingRef = useRef(isDragging);
  const editValueRef = useRef<string>('');
  const renderRequestRef = useRef<number | null>(null);

  useEffect(() => {
    selectionRangeRef.current = selectionRange;
  }, [selectionRange]);

  useEffect(() => {
    selectionRangesRef.current = selectionRanges;
  }, [selectionRanges]);

  // Update selection cell keys cache when selection changes
  useEffect(() => {
    const cellKeys = new Set<string>();
    
    if (selectionType === 'row' && selectionRanges.length > 0) {
      // Multi-range row selection
      for (const range of selectionRanges) {
        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = 0; col < gridData.colCount; col++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      }
    } else if (selectionType === 'column' && selectionRanges.length > 0) {
      // Multi-range column selection
      for (const range of selectionRanges) {
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);
        for (let col = minCol; col <= maxCol; col++) {
          for (let row = 0; row < gridData.rowCount; row++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      }
    } else if (selectionRanges.length > 0) {
      // Multi-range cell selection
      for (const range of selectionRanges) {
        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      }
    } else if (selectionRange) {
      // Single range selection
      if (selectionType === 'row') {
        const minRow = Math.min(selectionRange.start.row, selectionRange.end.row);
        const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row);
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = 0; col < gridData.colCount; col++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      } else if (selectionType === 'column') {
        const minCol = Math.min(selectionRange.start.col, selectionRange.end.col);
        const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col);
        for (let col = minCol; col <= maxCol; col++) {
          for (let row = 0; row < gridData.rowCount; row++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      } else {
        // Cell selection
        const minRow = Math.min(selectionRange.start.row, selectionRange.end.row);
        const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row);
        const minCol = Math.min(selectionRange.start.col, selectionRange.end.col);
        const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col);
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            cellKeys.add(getCellKey(row, col));
          }
        }
      }
    }
    
    setSelectionCellKeys(cellKeys);
  }, [selectionRange, selectionRanges, selectionType, gridData.rowCount, gridData.colCount]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Helper functions to get column width and row height
  const getColumnWidth = useCallback((col: number): number => columnWidths.get(col) || cellWidth, [columnWidths, cellWidth]);
  const getRowHeight = useCallback((row: number): number => rowHeights.get(row) || cellHeight, [rowHeights, cellHeight]);

  // Memoized position caches for efficient lookups
  const columnPositions = useMemo(() => {
    const positions = new Map<number, number>();
    let x = headerWidth;
    for (let i = 0; i < gridData.colCount; i++) {
      positions.set(i, x);
      x += (columnWidths.get(i) || cellWidth);
    }
    return positions;
  }, [gridData.colCount, columnWidths, cellWidth, headerWidth]);

  const rowPositions = useMemo(() => {
    const positions = new Map<number, number>();
    let y = headerHeight;
    for (let i = 0; i < gridData.rowCount; i++) {
      positions.set(i, y);
      y += (rowHeights.get(i) || cellHeight);
    }
    return positions;
  }, [gridData.rowCount, rowHeights, cellHeight, headerHeight]);

  const getColumnX = useCallback((col: number): number => {
    return columnPositions.get(col) || headerWidth;
  }, [columnPositions, headerWidth]);

  const getRowY = useCallback((row: number): number => {
    return rowPositions.get(row) || headerHeight;
  }, [rowPositions, headerHeight]);

  // Check if a cell is in the selection range
  const isCellInSelection = (row: number, col: number): boolean => {
    const key = getCellKey(row, col);
    return selectionCellKeys.has(key);
  };

  // Check if a cell is in the clipboard
  const isCellInClipboard = (row: number, col: number): boolean => {
    if (!clipboardData) return false;
    const key = getCellKey(row, col);
    return clipboardData.cellKeys.has(key);
  };

  // Check if a cell is a table header
  const isTableHeader = (row: number, col: number): TableMetadata | null => {
    const key = getCellKey(row, col);
    const tableId = tableHeaderCellKeys.get(key);
    if (tableId) {
      return tables.get(tableId) || null;
    }
    return null;
  };

  // Update table header cell keys cache when tables change
  useEffect(() => {
    const newHeaderKeys = new Map<string, string>();
    for (const [tableId, table] of tables.entries()) {
      if (table.hasHeader && table.headerRow !== undefined) {
        for (let col = table.startCol; col <= table.endCol; col++) {
          const key = getCellKey(table.headerRow, col);
          newHeaderKeys.set(key, tableId);
        }
      }
    }
    setTableHeaderCellKeys(newHeaderKeys);
  }, [tables]);

  // Update visible rows cache when tables or cells change
  useEffect(() => {
    const newVisibleRowsCache = new Map<string, Set<number>>();
    
    for (const [tableId, table] of tables.entries()) {
      const visibleRows = new Set<number>();
      
      // If no filters, all rows are visible
      if (!table.filters || table.filters.size === 0) {
        for (let row = (table.headerRow ?? -1) + 1; row <= table.endRow; row++) {
          visibleRows.add(row);
        }
      } else {
        // Check each row against all filters
        for (let row = (table.headerRow ?? -1) + 1; row <= table.endRow; row++) {
          let isVisible = true;
          
          // Check all active filters for this row
          for (const [col, allowedValues] of table.filters.entries()) {
            const key = getCellKey(row, col);
            const cell = gridData.cells.get(key);
            const cellValue = cell ? formatCellValueUtil(cell.value) : '';
            
            if (!allowedValues.has(cellValue)) {
              isVisible = false;
              break;
            }
          }
          
          if (isVisible) {
            visibleRows.add(row);
          }
        }
      }
      
      newVisibleRowsCache.set(tableId, visibleRows);
    }
    
    setVisibleRowsCache(newVisibleRowsCache);
  }, [tables, gridData.cells]);

  // Open filter dialog for column
  const openFilterDialog = useCallback((tableId: string, column: number) => {
    const table = tables.get(tableId);
    if (!table || !table.hasHeader) return;

    // Get column name from header
    const headerKey = getCellKey(table.headerRow!, column);
    const headerCell = gridData.cells.get(headerKey);
    const columnName = headerCell ? formatCellValueUtil(headerCell.value) : `Column ${column}`;

    setFilterDialog({
      open: true,
      tableId,
      column,
      columnName,
    });
  }, [tables, gridData.cells]);

  // Apply filter to table column
  const handleApplyFilter = useCallback(
    (tableId: string, column: number, values: Set<string>) => {
      const table = tables.get(tableId);
      if (!table) return;

      const updatedTable = { ...table };
      if (values.size === 0) {
        updatedTable.filters = new Map(table.filters);
        updatedTable.filters.delete(column);
      } else {
        updatedTable.filters = new Map(table.filters);
        updatedTable.filters.set(column, values);
      }

      const updatedTables = new Map(tables);
      updatedTables.set(tableId, updatedTable);
      setTables(updatedTables);
      // visibleRowsCache will be automatically updated by the useEffect
    },
    [tables]
  );

  // Check if row should be visible based on filters
  const isRowVisible = useCallback((tableId: string, row: number): boolean => {
    const visibleRows = visibleRowsCache.get(tableId);
    if (!visibleRows) return true;
    return visibleRows.has(row);
  }, [visibleRowsCache]);

  // Sort table by column
  const sortTable = useCallback((tableId: string, column: number) => {
    const table = tables.get(tableId);
    if (!table || !table.hasHeader) return;

    // Determine new sort direction
    let newDirection: SortDirection = 'asc';
    if (table.sortColumn === column) {
      if (table.sortDirection === 'asc') newDirection = 'desc';
      else if (table.sortDirection === 'desc') newDirection = null;
    }

    // Update table metadata
    setTables(prev => {
      const newTables = new Map(prev);
      newTables.set(tableId, {
        ...table,
        sortColumn: newDirection ? column : undefined,
        sortDirection: newDirection,
      });
      return newTables;
    });

    // If no sort, restore original order (would need to store original)
    if (!newDirection) return;

    // Single-pass sort: collect rows with sort key in one pass
    const rowsWithKeys: { row: number; sortKey: any; cells: Map<number, Cell> }[] = [];
    
    for (let r = table.headerRow! + 1; r <= table.endRow; r++) {
      const cellMap = new Map<number, Cell>();
      let sortKey: any = null;
      
      for (let c = table.startCol; c <= table.endCol; c++) {
        const key = getCellKey(r, c);
        const cell = gridData.cells.get(key);
        if (cell) {
          cellMap.set(c, cell);
          // Extract sort key on first pass
          if (c === column) {
            sortKey = cell.value.value;
          }
        }
      }
      
      if (cellMap.size > 0) {
        rowsWithKeys.push({ row: r, sortKey, cells: cellMap });
      }
    }

    // Sort with optimized comparison
    rowsWithKeys.sort((a, b) => {
      const valueA = a.sortKey;
      const valueB = b.sortKey;
      
      let comparison = 0;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        comparison = valueA.localeCompare(valueB);
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      
      return newDirection === 'desc' ? -comparison : comparison;
    });

    // Update grid with sorted data in single pass
    setGridData(prev => {
      const newCells = new Map(prev.cells);
      
      // Update all cells directly without clearing first
      rowsWithKeys.forEach((rowData, index) => {
        const targetRow = table.headerRow! + 1 + index;
        rowData.cells.forEach((cell, col) => {
          const key = getCellKey(targetRow, col);
          newCells.set(key, {
            ...cell,
            row: targetRow,
          });
        });
      });
      
      return { ...prev, cells: newCells };
    });
  }, [tables, gridData.cells]);

  // Mouse event handlers for cell selection dragging
  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Mouse event handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      if (resizing.type === 'col') {
        const delta = e.clientX - resizing.startPos;
        const newWidth = Math.max(30, resizing.startSize + delta);
        // Apply the new width to all affected columns
        setColumnWidths((prev) => {
          const newWidths = new Map(prev);
          resizing.affectedIndices.forEach(colIndex => {
            newWidths.set(colIndex, newWidth);
          });
          return newWidths;
        });
      } else {
        const delta = e.clientY - resizing.startPos;
        const newHeight = Math.max(20, resizing.startSize + delta);
        // Apply the new height to all affected rows
        setRowHeights((prev) => {
          const newHeights = new Map(prev);
          resizing.affectedIndices.forEach(rowIndex => {
            newHeights.set(rowIndex, newHeight);
          });
          return newHeights;
        });
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing]);

  // Optimized viewport calculation using binary search on position caches
  const calculateViewport = useCallback((scrollLeft: number, scrollTop: number, viewportWidth: number, viewportHeight: number) => {
    // Binary search for start column
    let startCol = 0;
    let left = 0, right = gridData.colCount - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const x = columnPositions.get(mid) || 0;
      if (x < scrollLeft) {
        startCol = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    startCol = Math.max(0, startCol - 1); // Add buffer before

    // Find end column
    let endCol = startCol;
    const scrollRight = scrollLeft + viewportWidth;
    while (endCol < gridData.colCount) {
      const x = columnPositions.get(endCol) || 0;
      if (x > scrollRight) break;
      endCol++;
    }
    endCol = Math.min(endCol + 5, gridData.colCount); // Add buffer after

    // Binary search for start row
    let startRow = 0;
    left = 0;
    right = gridData.rowCount - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const y = rowPositions.get(mid) || 0;
      if (y < scrollTop) {
        startRow = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    startRow = Math.max(0, startRow - 1); // Add buffer before

    // Find end row
    let endRow = startRow;
    const scrollBottom = scrollTop + viewportHeight;
    while (endRow < gridData.rowCount) {
      const y = rowPositions.get(endRow) || 0;
      if (y > scrollBottom) break;
      endRow++;
    }
    endRow = Math.min(endRow + 10, gridData.rowCount); // Add buffer after

    return { startRow, endRow, startCol, endCol };
  }, [gridData.colCount, gridData.rowCount, columnPositions, rowPositions]);

  // Handle scroll to update viewport with throttling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (renderRequestRef.current !== null) {
        cancelAnimationFrame(renderRequestRef.current);
      }

      renderRequestRef.current = requestAnimationFrame(() => {
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const viewportWidth = container.clientWidth;
        const viewportHeight = container.clientHeight;

        const newViewport = calculateViewport(scrollLeft, scrollTop, viewportWidth, viewportHeight);
        
        setViewport(prev => {
          // Only update if viewport actually changed
          if (prev.startRow !== newViewport.startRow || prev.endRow !== newViewport.endRow ||
              prev.startCol !== newViewport.startCol || prev.endCol !== newViewport.endCol) {
            return newViewport;
          }
          return prev;
        });
        renderRequestRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Initial calculation
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (renderRequestRef.current !== null) {
        cancelAnimationFrame(renderRequestRef.current);
      }
    };
  }, [calculateViewport]);

  // Calculate total dimensions
  const totalWidth = useMemo(() => {
    let width = headerWidth;
    for (let i = 0; i < gridData.colCount; i++) {
      width += (columnWidths.get(i) || cellWidth);
    }
    return width;
  }, [gridData.colCount, columnWidths, cellWidth, headerWidth]);

  const totalHeight = useMemo(() => {
    let height = headerHeight;
    for (let i = 0; i < gridData.rowCount; i++) {
      height += (rowHeights.get(i) || cellHeight);
    }
    return height;
  }, [gridData.rowCount, rowHeights, cellHeight, headerHeight]);

  // Initialize and render grid
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', totalWidth).attr('height', totalHeight);

    // Create defs for clip paths
    const defs = svg.append('defs');

    // Create main group
    const g = svg.append('g');

    // Draw column headers (only visible columns)
    const visibleCols = d3.range(viewport.startCol, Math.min(viewport.endCol, gridData.colCount));
    const colHeaders = g
      .selectAll('.col-header')
      .data(visibleCols)
      .enter()
      .append('g')
      .attr('class', 'col-header')
      .attr('transform', (d) => `translate(${getColumnX(d)}, 0)`);

    colHeaders
      .append('rect')
      .attr('width', (d) => getColumnWidth(d))
      .attr('height', headerHeight)
      .attr('fill', (d) => {
        if (selectionType === 'column') {
          // Check multi-ranges first
          if (selectionRanges.length > 0) {
            for (const range of selectionRanges) {
              const minCol = Math.min(range.start.col, range.end.col);
              const maxCol = Math.max(range.start.col, range.end.col);
              if (d >= minCol && d <= maxCol) return '#bbdefb';
            }
          } else if (selectionRange) {
            const minCol = Math.min(selectionRange.start.col, selectionRange.end.col);
            const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col);
            if (d >= minCol && d <= maxCol) return '#bbdefb';
          }
        }
        return '#f0f0f0';
      })
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mousedown', function(event, d) {
        event.stopPropagation();
        handleColumnHeaderClick(d, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
      })
      .on('mouseenter', function(_event, d) {
        handleColumnHeaderEnter(d);
      });

    colHeaders
      .append('text')
      .attr('x', (d) => getColumnWidth(d) / 2)
      .attr('y', headerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text((d) => getColumnLabel(d));

    // Add column resize handles
    colHeaders
      .append('rect')
      .attr('class', 'col-resize-handle')
      .attr('x', (d) => getColumnWidth(d) - 5)
      .attr('y', 0)
      .attr('width', 10)
      .attr('height', headerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'col-resize')
      .on('mouseenter', function() {
        d3.select(this).attr('fill', 'rgba(25, 118, 210, 0.1)');
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', 'transparent');
      })
      .on('dblclick', function(event, d) {
        event.stopPropagation();
        
        // Calculate the maximum content width for this column
        let maxWidth = 50; // Minimum width
        const padding = 10; // Extra padding for content
        
        // Check header text width
        const headerText = getColumnLabel(d);
        const headerWidth = headerText.length * 8 + padding; // Approximate width
        maxWidth = Math.max(maxWidth, headerWidth);
        
        // Check all cells in this column
        const charWidth = 7;
        for (let row = 0; row < gridData.rowCount; row++) {
          const key = getCellKey(row, d);
          const cell = gridData.cells.get(key);
          if (cell) {
            const cellText = formatCellValueUtil(cell.value);
            const isBold = cell.formatting?.bold;
            const textWidth = cellText.length * charWidth * (isBold ? 1.1 : 1) + padding;
            maxWidth = Math.max(maxWidth, textWidth);
          }
        }

        // Cap maximum width to reasonable size
        maxWidth = Math.min(maxWidth, 500);

        // Determine which columns to resize
        let affectedColumns = [d];
        if (selectionType === 'column' && (selectionRange || selectionRanges.length > 0)) {
          const ranges = selectionRanges.length > 0 ? selectionRanges : (selectionRange ? [selectionRange] : []);
          let isInSelection = false;
          const selectedCols = new Set<number>();

          for (const range of ranges) {
            const minCol = Math.min(range.start.col, range.end.col);
            const maxCol = Math.max(range.start.col, range.end.col);
            if (d >= minCol && d <= maxCol) {
              isInSelection = true;
            }
            for (let col = minCol; col <= maxCol; col++) {
              selectedCols.add(col);
            }
          }

          if (isInSelection && selectedCols.size > 0) {
            affectedColumns = Array.from(selectedCols);
          }
        }

        // Apply the calculated width to affected columns
        setColumnWidths((prev) => {
          const newWidths = new Map(prev);
          affectedColumns.forEach((colIndex) => {
            newWidths.set(colIndex, maxWidth);
          });
          return newWidths;
        });
      })
      .on('mousedown', function (event, d) {
        event.stopPropagation();
        
        // Determine which columns should be resized
        let affectedColumns = [d];
        if (selectionType === 'column' && (selectionRange || selectionRanges.length > 0)) {
          // Check if the clicked column is in the selection
          const ranges = selectionRanges.length > 0 ? selectionRanges : (selectionRange ? [selectionRange] : []);
          let isInSelection = false;
          const selectedCols = new Set<number>();
          
          for (const range of ranges) {
            const minCol = Math.min(range.start.col, range.end.col);
            const maxCol = Math.max(range.start.col, range.end.col);
            if (d >= minCol && d <= maxCol) {
              isInSelection = true;
            }
            for (let col = minCol; col <= maxCol; col++) {
              selectedCols.add(col);
            }
          }
          
          if (isInSelection && selectedCols.size > 0) {
            affectedColumns = Array.from(selectedCols);
          }
        }
        
        setResizing({
          type: 'col',
          index: d,
          startPos: event.clientX,
          startSize: getColumnWidth(d),
          affectedIndices: affectedColumns,
        });
      });

    // Draw row headers (only visible rows)
    const visibleRows = d3.range(viewport.startRow, Math.min(viewport.endRow, gridData.rowCount));
    const rowHeaders = g
      .selectAll('.row-header')
      .data(visibleRows)
      .enter()
      .append('g')
      .attr('class', 'row-header')
      .attr('transform', (d) => `translate(0, ${getRowY(d)})`);

    rowHeaders
      .append('rect')
      .attr('width', headerWidth)
      .attr('height', (d) => getRowHeight(d))
      .attr('fill', (d) => {
        if (selectionType === 'row') {
          // Check multi-ranges first
          if (selectionRanges.length > 0) {
            for (const range of selectionRanges) {
              const minRow = Math.min(range.start.row, range.end.row);
              const maxRow = Math.max(range.start.row, range.end.row);
              if (d >= minRow && d <= maxRow) return '#bbdefb';
            }
          } else if (selectionRange) {
            const minRow = Math.min(selectionRange.start.row, selectionRange.end.row);
            const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row);
            if (d >= minRow && d <= maxRow) return '#bbdefb';
          }
        }
        return '#f0f0f0';
      })
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mousedown', function(event, d) {
        event.stopPropagation();
        handleRowHeaderClick(d, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
      })
      .on('mouseenter', function(_event, d) {
        handleRowHeaderEnter(d);
      });

    rowHeaders
      .append('text')
      .attr('x', headerWidth / 2)
      .attr('y', (d) => getRowHeight(d) / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text((d) => d + 1);

    // Add row resize handles
    rowHeaders
      .append('rect')
      .attr('class', 'row-resize-handle')
      .attr('x', 0)
      .attr('y', (d) => getRowHeight(d) - 5)
      .attr('width', headerWidth)
      .attr('height', 10)
      .attr('fill', 'transparent')
      .style('cursor', 'row-resize')
      .on('mouseenter', function() {
        d3.select(this).attr('fill', 'rgba(25, 118, 210, 0.1)');
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', 'transparent');
      })
      .on('mousedown', function (event, d) {
        event.stopPropagation();
        
        // Determine which rows should be resized
        let affectedRows = [d];
        if (selectionType === 'row' && (selectionRange || selectionRanges.length > 0)) {
          // Check if the clicked row is in the selection
          const ranges = selectionRanges.length > 0 ? selectionRanges : (selectionRange ? [selectionRange] : []);
          let isInSelection = false;
          const selectedRows = new Set<number>();
          
          for (const range of ranges) {
            const minRow = Math.min(range.start.row, range.end.row);
            const maxRow = Math.max(range.start.row, range.end.row);
            if (d >= minRow && d <= maxRow) {
              isInSelection = true;
            }
            for (let row = minRow; row <= maxRow; row++) {
              selectedRows.add(row);
            }
          }
          
          if (isInSelection && selectedRows.size > 0) {
            affectedRows = Array.from(selectedRows);
          }
        }
        
        setResizing({
          type: 'row',
          index: d,
          startPos: event.clientY,
          startSize: getRowHeight(d),
          affectedIndices: affectedRows,
        });
      });

    // Draw grid cells (only visible cells, considering filters)
    const rows = g
      .selectAll('.row')
      .data(visibleRows)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (d) => `translate(${headerWidth}, ${getRowY(d)})`)
      .style('display', (d) => {
        // Check if row is in a filtered table
        for (const table of tables.values()) {
          if (d >= (table.headerRow ?? -1) + 1 && d <= table.endRow) {
            return isRowVisible(table.id, d) ? null : 'none';
          }
        }
        return null;
      });

    rows
      .selectAll('.cell')
      .data((row) =>
        visibleCols.map((col) => ({
          row,
          col,
          key: getCellKey(row, col),
        }))
      )
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', (d) => `translate(${getColumnX(d.col) - headerWidth}, 0)`)
      .each(function (d) {
        const cellGroup = d3.select(this);
        const cell = gridData.cells.get(d.key);
        const isSelected = selectedCell?.row === d.row && selectedCell?.col === d.col;
        const isInRange = isCellInSelection(d.row, d.col);
        const isEditing = editingCell?.row === d.row && editingCell?.col === d.col;
        const isInClipboard = isCellInClipboard(d.row, d.col);
        const colWidth = getColumnWidth(d.col);
        const rowHeight = getRowHeight(d.row);
        const formatting = cell?.formatting;

        // Determine fill color
        let fillColor = 'white';
        if (isInRange) {
          fillColor = '#bbdefb';
        } else if (isSelected) {
          fillColor = '#e3f2fd';
        } else if (formatting?.fillColor) {
          fillColor = formatting.fillColor;
        }

        cellGroup
          .append('rect')
          .attr('width', colWidth)
          .attr('height', rowHeight)
          .attr('fill', fillColor)
          .attr('stroke', '#ccc')
          .attr('stroke-width', isInRange || isSelected ? 2 : 1)
          .style('cursor', 'cell');

        // Add animated dashed border for copied/cut cells
        if (isInClipboard) {
          const clipboardRect = cellGroup
            .append('rect')
            .attr('width', colWidth)
            .attr('height', rowHeight)
            .attr('fill', 'none')
            .attr('stroke', clipboardData?.isCut ? '#ff6b6b' : '#2196f3')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6,4')
            .style('pointer-events', 'none');

          // Animate the dashed border
          clipboardRect
            .append('animate')
            .attr('attributeName', 'stroke-dashoffset')
            .attr('from', '0')
            .attr('to', '20')
            .attr('dur', '1s')
            .attr('repeatCount', 'indefinite');
        }

        // Draw borders if specified
        if (formatting?.borderStyle) {
          const borders = formatting.borderStyle;
          if (borders.top) {
            cellGroup
              .append('line')
              .attr('x1', 0)
              .attr('y1', 0)
              .attr('x2', colWidth)
              .attr('y2', 0)
              .attr('stroke', borders.top.color)
              .attr('stroke-width', borders.top.width)
              .attr('stroke-dasharray', borders.top.style === 'dashed' ? '5,5' : borders.top.style === 'dotted' ? '2,2' : 'none')
              .style('pointer-events', 'none');
          }
          if (borders.right) {
            cellGroup
              .append('line')
              .attr('x1', colWidth)
              .attr('y1', 0)
              .attr('x2', colWidth)
              .attr('y2', rowHeight)
              .attr('stroke', borders.right.color)
              .attr('stroke-width', borders.right.width)
              .attr('stroke-dasharray', borders.right.style === 'dashed' ? '5,5' : borders.right.style === 'dotted' ? '2,2' : 'none')
              .style('pointer-events', 'none');
          }
          if (borders.bottom) {
            cellGroup
              .append('line')
              .attr('x1', 0)
              .attr('y1', rowHeight)
              .attr('x2', colWidth)
              .attr('y2', rowHeight)
              .attr('stroke', borders.bottom.color)
              .attr('stroke-width', borders.bottom.width)
              .attr('stroke-dasharray', borders.bottom.style === 'dashed' ? '5,5' : borders.bottom.style === 'dotted' ? '2,2' : 'none')
              .style('pointer-events', 'none');
          }
          if (borders.left) {
            cellGroup
              .append('line')
              .attr('x1', 0)
              .attr('y1', 0)
              .attr('x2', 0)
              .attr('y2', rowHeight)
              .attr('stroke', borders.left.color)
              .attr('stroke-width', borders.left.width)
              .attr('stroke-dasharray', borders.left.style === 'dashed' ? '5,5' : borders.left.style === 'dotted' ? '2,2' : 'none')
              .style('pointer-events', 'none');
          }
        }

        // Only show cell text if not currently editing this cell
        if (cell && !isEditing) {
          const cellPadding = 5;
          const clipPathId = `cell-clip-${d.row}-${d.col}`;

          // Define clip path in defs with local coordinates (0,0 relative to cell group)
          defs
            .append('clipPath')
            .attr('id', clipPathId)
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', colWidth)
            .attr('height', rowHeight);

          // Calculate text position based on alignment
          const textAlign = formatting?.textAlign || 'left';
          let textX = cellPadding; // Default left alignment with padding
          let textAnchor: 'start' | 'middle' | 'end' = 'start';
          
          if (textAlign === 'center') {
            textX = colWidth / 2;
            textAnchor = 'middle';
          } else if (textAlign === 'right') {
            textX = colWidth - cellPadding; // Right alignment with padding
            textAnchor = 'end';
          }

          // Create a wrapper group with clip-path applied to it
          const textGroup = cellGroup
            .append('g')
            .attr('clip-path', `url(#${clipPathId})`);
          
          const textElement = textGroup
            .append('text')
            .attr('x', textX)
            .attr('y', rowHeight / 2)
            .attr('text-anchor', textAnchor)
            .attr('dominant-baseline', 'middle')
            .attr('font-size', formatting?.fontSize ? `${formatting.fontSize}px` : '12px')
            .attr('font-family', formatting?.fontFamily || 'Arial')
            .attr('font-weight', formatting?.bold ? 'bold' : 'normal')
            .attr('font-style', formatting?.italic ? 'italic' : 'normal')
            .attr('fill', formatting?.textColor || '#000000')
            .text(formatCellValue(cell.value, formatting))
            .style('pointer-events', 'none');

          // Add underline if specified
          if (formatting?.underline) {
            textElement.attr('text-decoration', 'underline');
          }

          // Add sort indicator if this is a table header
          const tableHeader = isTableHeader(d.row, d.col);
          if (tableHeader) {
            const isSortedColumn = tableHeader.sortColumn === d.col;
            const sortDirection = tableHeader.sortDirection;
            const hasFilter = tableHeader.filters?.has(d.col);
            
            let iconX = colWidth - 15;
            
            // Add filter icon if column has filter
            if (hasFilter) {
              textGroup
                .append('text')
                .attr('x', iconX)
                .attr('y', rowHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '10px')
                .attr('fill', '#1976d2')
                .attr('font-weight', 'bold')
                .text('🔽')
                .style('pointer-events', 'none');
              iconX -= 15;
            }
            
            if (isSortedColumn && sortDirection) {
              // Add sort arrow
              textGroup
                .append('text')
                .attr('x', iconX)
                .attr('y', rowHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '10px')
                .attr('fill', '#1976d2')
                .text(sortDirection === 'asc' ? '▲' : '▼')
                .style('pointer-events', 'none');
            }
            
            // Add hover effect for table headers
            cellGroup.style('cursor', 'pointer');
          }
        }

        // Store row/col as data attributes for event delegation
        cellGroup.attr('data-row', d.row).attr('data-col', d.col);
      });

    // Event delegation: attach handlers to parent group instead of individual cells
    g.on('mousedown', function(event) {
      const target = (event.target as SVGElement).closest('[data-row]');
      if (target) {
        const row = parseInt(target.getAttribute('data-row') || '0', 10);
        const col = parseInt(target.getAttribute('data-col') || '0', 10);
        handleCellMouseDown(row, col, event as MouseEvent);
      }
    });

    g.on('mouseenter', function(event) {
      const target = (event.target as SVGElement).closest('[data-row]');
      if (target) {
        const row = parseInt(target.getAttribute('data-row') || '0', 10);
        const col = parseInt(target.getAttribute('data-col') || '0', 10);
        handleCellMouseEnter(row, col);
      }
    }, true);

    g.on('click', function(event) {
      const target = (event.target as SVGElement).closest('[data-row]');
      if (target) {
        const row = parseInt(target.getAttribute('data-row') || '0', 10);
        const col = parseInt(target.getAttribute('data-col') || '0', 10);
        handleCellClick(row, col);
      }
    });

    g.on('dblclick', function(event) {
      const target = (event.target as SVGElement).closest('[data-row]');
      if (target) {
        const row = parseInt(target.getAttribute('data-row') || '0', 10);
        const col = parseInt(target.getAttribute('data-col') || '0', 10);
        handleCellDoubleClick(row, col);
      }
    });

    g.on('contextmenu', function(event) {
      const target = (event.target as SVGElement).closest('[data-row]');
      if (target) {
        event.preventDefault();
        const row = parseInt(target.getAttribute('data-row') || '0', 10);
        const col = parseInt(target.getAttribute('data-col') || '0', 10);
        const tableHeader = isTableHeader(row, col);
        if (tableHeader) {
          openFilterDialog(tableHeader.id, col);
        }
      }
    });

    // Draw top-left corner header
    g.append('rect')
      .attr('width', headerWidth)
      .attr('height', headerHeight)
      .attr('fill', '#e0e0e0')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);
  }, [gridData.cells, selectedCell, selectionRange, selectionRanges, selectionType, editingCell, headerWidth, headerHeight, viewport, getColumnWidth, getRowHeight, getColumnX, getRowY, totalWidth, totalHeight, tables, tableHeaderCellKeys, selectionCellKeys, visibleRowsCache, isTableHeader, isRowVisible, openFilterDialog]);

  const formatCellValue = (value: CellValue, formatting?: CellFormatting): string => {
    return formatCellValueUtil(value, formatting);
  };

  const parseCellValue = (input: string): CellValue => {
    return inferCellValue(input);
  };

  const enterEditMode = useCallback(
    (row: number, col: number, initialValue?: string) => {
      const key = getCellKey(row, col);
      const cell = gridData.cells.get(key);
      const nextValue = initialValue !== undefined ? initialValue : cell?.value.rawValue || '';
      setSelectedCell({ row, col });
      selectionRangeRef.current = null;
      setSelectionRange(null);
      setEditingCell({ row, col });
      setEditValue(nextValue);
      editValueRef.current = nextValue;
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [gridData]
  );

  const saveEditingCell = useCallback(
    (cellToSave: { row: number; col: number } | null, nextSelection?: { row: number; col: number } | null) => {
      if (!cellToSave) return;

      const key = getCellKey(cellToSave.row, cellToSave.col);
      const valueToSave = editValueRef.current;
      const parsedValue = parseCellValue(valueToSave);
      
      // Get existing cell to preserve formatting
      const existingCell = gridData.cells.get(key);
      
      const newCell: Cell = {
        row: cellToSave.row,
        col: cellToSave.col,
        value: parsedValue,
        formatting: existingCell?.formatting,
      };

      // Auto-apply detected date format if this is a date/datetime and has a detected format
      if ((parsedValue.type === 'date' || parsedValue.type === 'datetime') && parsedValue.detectedFormat) {
        newCell.formatting = {
          ...newCell.formatting,
          dateFormat: parsedValue.detectedFormat,
        };
      }

      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        if (valueToSave.trim() === '') {
          newCells.delete(key);
        } else {
          newCells.set(key, newCell);
        }
        return { ...prev, cells: newCells };
      });

      const selectionTarget = nextSelection ?? cellToSave;
      selectionRangeRef.current = { start: selectionTarget, end: selectionTarget };
      setSelectionRange({ start: selectionTarget, end: selectionTarget });
      setSelectedCell(selectionTarget);
      setEditingCell(null);
      setEditValue('');
      editValueRef.current = '';
    },
    [gridData.cells]
  );

  const handleRowHeaderClick = useCallback(
    (row: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
      if (editingCell) {
        saveEditingCell(editingCell, null);
      }

      const isShift = event?.shiftKey || false;
      const isCtrlOrMeta = event?.ctrlKey || event?.metaKey || false;

      if (isShift && selectionType === 'row') {
        // Extend selection from anchor to current row
        const anchor = selectionRanges.length > 0 ? selectionRanges[0] : selectionRange;
        if (anchor) {
          const anchorRow = anchor.start.row;
          const newRange: SelectionRange = {
            start: { row: Math.min(anchorRow, row), col: 0 },
            end: { row: Math.max(anchorRow, row), col: gridData.colCount - 1 },
          };
          setSelectionRange(newRange);
          setSelectionRanges([newRange]);
          selectionRangeRef.current = newRange;
          selectionRangesRef.current = [newRange];
          return;
        }
      }

      if (isCtrlOrMeta && selectionType === 'row') {
        // Add row to multi-selection
        const newRange: SelectionRange = {
          start: { row, col: 0 },
          end: { row, col: gridData.colCount - 1 },
        };
        const updatedRanges = [...selectionRanges, newRange];
        setSelectionRanges(updatedRanges);
        setSelectedCell({ row, col: 0 });
        selectionRangesRef.current = updatedRanges;
        return;
      }

      // Normal click: select single row and enable dragging
      const newRange: SelectionRange = {
        start: { row, col: 0 },
        end: { row, col: gridData.colCount - 1 },
      };
      setSelectionType('row');
      setSelectionRange(newRange);
      setSelectionRanges([newRange]);
      setSelectedCell({ row, col: 0 });
      selectionRangeRef.current = newRange;
      selectionRangesRef.current = [newRange];
      isDraggingRef.current = true;
      setIsDragging(true);
    },
    [editingCell, saveEditingCell, gridData.colCount, selectionRange, selectionRanges, selectionType]
  );

  const handleColumnHeaderClick = useCallback(
    (col: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
      if (editingCell) {
        saveEditingCell(editingCell, null);
      }

      const isShift = event?.shiftKey || false;
      const isCtrlOrMeta = event?.ctrlKey || event?.metaKey || false;

      if (isShift && selectionType === 'column') {
        // Extend selection from anchor to current column
        const anchor = selectionRanges.length > 0 ? selectionRanges[0] : selectionRange;
        if (anchor) {
          const anchorCol = anchor.start.col;
          const newRange: SelectionRange = {
            start: { row: 0, col: Math.min(anchorCol, col) },
            end: { row: gridData.rowCount - 1, col: Math.max(anchorCol, col) },
          };
          setSelectionRange(newRange);
          setSelectionRanges([newRange]);
          selectionRangeRef.current = newRange;
          selectionRangesRef.current = [newRange];
          return;
        }
      }

      if (isCtrlOrMeta && selectionType === 'column') {
        // Add column to multi-selection
        const newRange: SelectionRange = {
          start: { row: 0, col },
          end: { row: gridData.rowCount - 1, col },
        };
        const updatedRanges = [...selectionRanges, newRange];
        setSelectionRanges(updatedRanges);
        setSelectedCell({ row: 0, col });
        selectionRangesRef.current = updatedRanges;
        return;
      }

      // Normal click: select single column and enable dragging
      const newRange: SelectionRange = {
        start: { row: 0, col },
        end: { row: gridData.rowCount - 1, col },
      };
      setSelectionType('column');
      setSelectionRange(newRange);
      setSelectionRanges([newRange]);
      setSelectedCell({ row: 0, col });
      selectionRangeRef.current = newRange;
      selectionRangesRef.current = [newRange];
      isDraggingRef.current = true;
      setIsDragging(true);
    },
    [editingCell, saveEditingCell, gridData.rowCount, selectionRange, selectionRanges, selectionType]
  );

  const handleCellMouseDown = useCallback(
    (row: number, col: number, event?: MouseEvent) => {
      if (event && event.detail > 1) {
        // Double-click in progress; let dblclick handler manage edit mode
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (editingCell && (editingCell.row !== row || editingCell.col !== col)) {
        saveEditingCell(editingCell, { row, col });
        return;
      }

      const isShift = event?.shiftKey || false;
      const isCtrlOrMeta = event?.ctrlKey || event?.metaKey || false;

      // Shift-click: extend selection from anchor
      if (isShift && selectionType === 'cell') {
        const anchor = selectionRanges.length > 0 ? selectionRanges[0] : selectionRange;
        if (anchor) {
          const newRange: SelectionRange = {
            start: anchor.start,
            end: { row, col },
          };
          setSelectionRange(newRange);
          setSelectionRanges([newRange]);
          selectionRangeRef.current = newRange;
          selectionRangesRef.current = [newRange];
          setSelectedCell({ row, col });
          return;
        }
      }

      // Ctrl-click: add cell/range to multi-selection
      if (isCtrlOrMeta && selectionType === 'cell') {
        const newRange: SelectionRange = {
          start: { row, col },
          end: { row, col },
        };
        const updatedRanges = [...selectionRanges, newRange];
        setSelectionRanges(updatedRanges);
        setSelectedCell({ row, col });
        selectionRangesRef.current = updatedRanges;
        return;
      }

      // Start new selection/drag
      const newRange: SelectionRange = { start: { row, col }, end: { row, col } };
      selectionRangeRef.current = newRange;
      isDraggingRef.current = true;
      setSelectedCell({ row, col });
      setSelectionRange(newRange);
      setSelectionRanges([newRange]);
      setSelectionType('cell');
      setIsDragging(true);
    },
    [selectedCell, selectionRange, selectionRanges, selectionType, editingCell, saveEditingCell]
  );

  const handleRowHeaderEnter = useCallback(
    (row: number) => {
      if (isDraggingRef.current && selectionRangeRef.current && selectionType === 'row' && gridData.colCount > 0) {
        const anchorRow = selectionRangeRef.current.start.row;
        const updatedRange: SelectionRange = {
          start: { row: Math.min(anchorRow, row), col: 0 },
          end: { row: Math.max(anchorRow, row), col: gridData.colCount - 1 },
        };
        selectionRangeRef.current = updatedRange;
        setSelectionRange(updatedRange);
        setSelectionRanges([updatedRange]);
        selectionRangesRef.current = [updatedRange];
      }
    },
    [selectionType, gridData.colCount]
  );

  const handleColumnHeaderEnter = useCallback(
    (col: number) => {
      if (isDraggingRef.current && selectionRangeRef.current && selectionType === 'column') {
        const anchorCol = selectionRangeRef.current.start.col;
        const updatedRange: SelectionRange = {
          start: { row: 0, col: Math.min(anchorCol, col) },
          end: { row: gridData.rowCount - 1, col: Math.max(anchorCol, col) },
        };
        selectionRangeRef.current = updatedRange;
        setSelectionRange(updatedRange);
        setSelectionRanges([updatedRange]);
        selectionRangesRef.current = [updatedRange];
      }
    },
    [selectionType, gridData.rowCount]
  );

  const handleCellMouseEnter = useCallback(
    (row: number, col: number) => {
      if (isDraggingRef.current && selectionRangeRef.current) {
        const updatedRange: SelectionRange = {
          start: selectionRangeRef.current.start,
          end: { row, col },
        };
        selectionRangeRef.current = updatedRange;
        setSelectionRange(updatedRange);
        setSelectionRanges([updatedRange]);
        selectionRangesRef.current = [updatedRange];
      }
    },
    []
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {

      // Check if this is a table header cell
      const tableHeader = isTableHeader(row, col);
      if (tableHeader) {
        // Trigger sort on this column
        sortTable(tableHeader.id, col);
        return;
      }

      const currentRange = selectionRangeRef.current;
      if (
        currentRange &&
        currentRange.start.row === row &&
        currentRange.start.col === col &&
        currentRange.end.row === row &&
        currentRange.end.col === col
      ) {
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      if (currentRange) {
        console.log('Multi-cell selection completed');
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    },
    [isTableHeader, sortTable]
  );

  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      console.log('dblclick', row, col);
      enterEditMode(row, col);
    },
    [enterEditMode]
  );

  const handleEditSubmit = useCallback(() => {
    if (!editingCell) return;
    const nextRow = Math.min(editingCell.row + 1, gridData.rowCount - 1);
    const nextSelection = { row: nextRow, col: editingCell.col };
    saveEditingCell(editingCell, nextSelection);
  }, [editingCell, gridData.rowCount, saveEditingCell]);

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    editValueRef.current = '';
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleEditSubmit();
        return;
      }

      if (e.key === 'Escape') {
        handleEditCancel();
        return;
      }

      if (!editingCell) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();

        let nextRow = editingCell.row;
        let nextCol = editingCell.col;

        if (e.key === 'ArrowUp' && editingCell.row > 0) {
          nextRow = editingCell.row - 1;
        } else if (e.key === 'ArrowDown' && editingCell.row < gridData.rowCount - 1) {
          nextRow = editingCell.row + 1;
        } else if (e.key === 'ArrowLeft' && editingCell.col > 0) {
          nextCol = editingCell.col - 1;
        } else if (e.key === 'ArrowRight' && editingCell.col < gridData.colCount - 1) {
          nextCol = editingCell.col + 1;
        }

        if (nextRow !== editingCell.row || nextCol !== editingCell.col) {
          saveEditingCell(editingCell, { row: nextRow, col: nextCol });
        }
      }
    },
    [editingCell, gridData.colCount, gridData.rowCount, handleEditCancel, handleEditSubmit, saveEditingCell]
  );

  // Helper to get selected cells
  const getSelectedCells = useCallback((): { row: number; col: number }[] => {
    if (!selectionRange) return [];
    
    if (selectionType === 'row') {
      const ranges = selectionRanges.length > 0 ? selectionRanges : [selectionRange];
      const cells: { row: number; col: number }[] = [];
      ranges.forEach(range => {
        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = 0; col < gridData.colCount; col++) {
            cells.push({ row, col });
          }
        }
      });
      return cells;
    }
    
    if (selectionType === 'column') {
      const ranges = selectionRanges.length > 0 ? selectionRanges : [selectionRange];
      const cells: { row: number; col: number }[] = [];
      ranges.forEach(range => {
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);
        for (let col = minCol; col <= maxCol; col++) {
          for (let row = 0; row < gridData.rowCount; row++) {
            cells.push({ row, col });
          }
        }
      });
      return cells;
    }
    
    // Cell selection
    const ranges = selectionRanges.length > 0 ? selectionRanges : [selectionRange];
    const cells: { row: number; col: number }[] = [];
    ranges.forEach(range => {
      const selectedCells = getSelectedCellsInRange(
        range.start.row,
        range.start.col,
        range.end.row,
        range.end.col
      );
      cells.push(...selectedCells);
    });
    return cells;
  }, [selectionRange, selectionRanges, selectionType, gridData.colCount, gridData.rowCount]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (editingCell) return;
      if (!selectedCell) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        event.preventDefault();

        let nextRow = selectedCell.row;
        let nextCol = selectedCell.col;

        if (event.key === 'ArrowUp' && selectedCell.row > 0) {
          nextRow = selectedCell.row - 1;
        } else if (event.key === 'ArrowDown' && selectedCell.row < gridData.rowCount - 1) {
          nextRow = selectedCell.row + 1;
        } else if (event.key === 'ArrowLeft' && selectedCell.col > 0) {
          nextCol = selectedCell.col - 1;
        } else if (event.key === 'ArrowRight' && selectedCell.col < gridData.colCount - 1) {
          nextCol = selectedCell.col + 1;
        }

        if (nextRow !== selectedCell.row || nextCol !== selectedCell.col) {
          const nextSelection = { row: nextRow, col: nextCol };
          const range: SelectionRange = { start: nextSelection, end: nextSelection };
          selectionRangeRef.current = range;
          selectionRangesRef.current = [range];
          setSelectionRange(range);
          setSelectionRanges([range]);
          setSelectedCell(nextSelection);
        }
        return;
      }

      // Handle clipboard shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        const selectedCells = getSelectedCells();
        const data = copyCellsToClipboard(gridData.cells, selectedCells);
        setClipboardData(data);
        if (onClipboardChange) {
          onClipboardChange(data !== null);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
        event.preventDefault();
        const selectedCells = getSelectedCells();
        const data = cutCellsToClipboard(gridData.cells, selectedCells);
        setClipboardData(data);
        if (onClipboardChange) {
          onClipboardChange(data !== null);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        if (!clipboardData || !selectedCell) return;

        const pastedCells = pasteCellsFromClipboard(clipboardData, selectedCell.row, selectedCell.col);
        
        setGridData((prev) => {
          const newCells = new Map(prev.cells);
          
          if (clipboardData.isCut) {
            clipboardData.cells.forEach((cell) => {
              const key = getCellKey(cell.row, cell.col);
              newCells.delete(key);
            });
          }
          
          pastedCells.forEach((cell) => {
            const key = getCellKey(cell.row, cell.col);
            newCells.set(key, cell);
          });
          
          return { ...prev, cells: newCells };
        });

        // Always clear clipboard data after paste
        setClipboardData(null);
        if (onClipboardChange) {
          onClipboardChange(false);
        }
        return;
      }

      // Handle ESC key to clear clipboard
      if (event.key === 'Escape') {
        if (clipboardData) {
          event.preventDefault();
          setClipboardData(null);
          if (onClipboardChange) {
            onClipboardChange(false);
          }
        }
        return;
      }

      // Handle copy down (Ctrl+D)
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        
        // Get the selection range
        const range = selectionRange || (selectedCell ? { start: selectedCell, end: selectedCell } : null);
        if (!range) return;

        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);

        // If only one row selected, nothing to copy down
        if (minRow === maxRow) return;

        setGridData((prev) => {
          const newCells = new Map(prev.cells);

          // For each column in the selection
          for (let col = minCol; col <= maxCol; col++) {
            // Get the source cell (first row)
            const sourceKey = getCellKey(minRow, col);
            const sourceCell = prev.cells.get(sourceKey);

            // Copy to all rows below in the selection
            for (let row = minRow + 1; row <= maxRow; row++) {
              const targetKey = getCellKey(row, col);
              if (sourceCell) {
                // Clone the source cell to the target row
                newCells.set(targetKey, {
                  ...sourceCell,
                  row,
                  col,
                });
              } else {
                // If source is empty, clear the target
                newCells.delete(targetKey);
              }
            }
          }

          return { ...prev, cells: newCells };
        });
        return;
      }

      // Handle copy right (Ctrl+R)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        
        // Get the selection range
        const range = selectionRange || (selectedCell ? { start: selectedCell, end: selectedCell } : null);
        if (!range) return;

        const minRow = Math.min(range.start.row, range.end.row);
        const maxRow = Math.max(range.start.row, range.end.row);
        const minCol = Math.min(range.start.col, range.end.col);
        const maxCol = Math.max(range.start.col, range.end.col);

        // If only one column selected, nothing to copy right
        if (minCol === maxCol) return;

        setGridData((prev) => {
          const newCells = new Map(prev.cells);

          // For each row in the selection
          for (let row = minRow; row <= maxRow; row++) {
            // Get the source cell (first column)
            const sourceKey = getCellKey(row, minCol);
            const sourceCell = prev.cells.get(sourceKey);

            // Copy to all columns to the right in the selection
            for (let col = minCol + 1; col <= maxCol; col++) {
              const targetKey = getCellKey(row, col);
              if (sourceCell) {
                // Clone the source cell to the target column
                newCells.set(targetKey, {
                  ...sourceCell,
                  row,
                  col,
                });
              } else {
                // If source is empty, clear the target
                newCells.delete(targetKey);
              }
            }
          }

          return { ...prev, cells: newCells };
        });
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const isCharacterKey = event.key.length === 1;
      const isBackspace = event.key === 'Backspace';
      const isDelete = event.key === 'Delete';
      if (!isCharacterKey && !isBackspace && !isDelete) return;

      event.preventDefault();
      const initialValue = isCharacterKey ? event.key : '';
      enterEditMode(selectedCell.row, selectedCell.col, initialValue);
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [editingCell, selectedCell, enterEditMode, getSelectedCells, gridData.cells, clipboardData, onClipboardChange]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const hasSelection = selectedCell !== null;
      const formatting = selectedCell ? gridData.cells.get(getCellKey(selectedCell.row, selectedCell.col))?.formatting : undefined;
      onSelectionChange(hasSelection, formatting);
    }
  }, [selectedCell, gridData.cells, onSelectionChange]);

  // Calculate edit field position
  const getEditFieldPosition = () => {
    if (!editingCell) return { top: 0, left: 0, width: cellWidth, height: cellHeight };
    return {
      top: getRowY(editingCell.row),
      left: getColumnX(editingCell.col),
      width: getColumnWidth(editingCell.col),
      height: getRowHeight(editingCell.row),
    };
  };

  // Expose API methods via ref
  useImperativeHandle(ref, () => ({
    clearGrid: () => {
      setGridData((prev) => ({
        ...prev,
        cells: new Map(),
      }));
      setEditingCell(null);
      setEditValue('');
      editValueRef.current = '';
    },
    setCellValue: (row: number, col: number, value: string) => {
      const key = getCellKey(row, col);
      const parsedValue = parseCellValue(value);
      const newCell: Cell = {
        row,
        col,
        value: parsedValue,
      };
      
      // Auto-apply detected date format
      if ((parsedValue.type === 'date' || parsedValue.type === 'datetime') && parsedValue.detectedFormat) {
        newCell.formatting = {
          dateFormat: parsedValue.detectedFormat,
        };
      }
      
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        if (value.trim() === '') {
          newCells.delete(key);
        } else {
          newCells.set(key, newCell);
        }
        return { ...prev, cells: newCells };
      });
    },
    setCellRange: (startRow: number, startCol: number, endRow: number, endCol: number, value: string) => {
      const parsedValue = parseCellValue(value);
      
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const key = getCellKey(row, col);
            const newCell: Cell = {
              row,
              col,
              value: parsedValue,
            };
            
            // Auto-apply detected date format
            if ((parsedValue.type === 'date' || parsedValue.type === 'datetime') && parsedValue.detectedFormat) {
              newCell.formatting = {
                dateFormat: parsedValue.detectedFormat,
              };
            }
            
            if (value.trim() === '') {
              newCells.delete(key);
            } else {
              newCells.set(key, newCell);
            }
          }
        }
        return { ...prev, cells: newCells };
      });
    },
    formatCells: (formatting: Partial<CellFormatting>) => {
      const selectedCells = getSelectedCells();
      if (selectedCells.length === 0) return;

      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        selectedCells.forEach(({ row, col }) => {
          const key = getCellKey(row, col);
          const existingCell = newCells.get(key);
          
          if (existingCell) {
            // Update existing cell
            newCells.set(key, {
              ...existingCell,
              formatting: {
                ...existingCell.formatting,
                ...formatting,
              },
            });
          } else {
            // Create new cell with formatting only
            newCells.set(key, {
              row,
              col,
              value: { type: 'text', value: '', rawValue: '' },
              formatting: { ...formatting },
            });
          }
        });
        return { ...prev, cells: newCells };
      });
    },
    copyCells: () => {
      const selectedCells = getSelectedCells();
      const data = copyCellsToClipboard(gridData.cells, selectedCells);
      setClipboardData(data);
      if (onClipboardChange) {
        onClipboardChange(data !== null);
      }
    },
    cutCells: () => {
      const selectedCells = getSelectedCells();
      const data = cutCellsToClipboard(gridData.cells, selectedCells);
      setClipboardData(data);
      if (onClipboardChange) {
        onClipboardChange(data !== null);
      }
    },
    pasteCells: () => {
      if (!clipboardData || !selectedCell) return;

      const pastedCells = pasteCellsFromClipboard(clipboardData, selectedCell.row, selectedCell.col);
      
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        
        // If it was a cut operation, delete the original cells
        if (clipboardData.isCut) {
          clipboardData.cells.forEach((cell) => {
            const key = getCellKey(cell.row, cell.col);
            newCells.delete(key);
          });
        }
        
        // Add pasted cells
        pastedCells.forEach((cell) => {
          const key = getCellKey(cell.row, cell.col);
          newCells.set(key, cell);
        });
        
        return { ...prev, cells: newCells };
      });

      // Always clear clipboard data after paste
      setClipboardData(null);
      if (onClipboardChange) {
        onClipboardChange(false);
      }
    },
    copyDown: () => {
      const range = selectionRange || (selectedCell ? { start: selectedCell, end: selectedCell } : null);
      if (!range) return;

      const minRow = Math.min(range.start.row, range.end.row);
      const maxRow = Math.max(range.start.row, range.end.row);
      const minCol = Math.min(range.start.col, range.end.col);
      const maxCol = Math.max(range.start.col, range.end.col);

      // If only one row selected, nothing to copy down
      if (minRow === maxRow) return;

      setGridData((prev) => {
        const newCells = new Map(prev.cells);

        // For each column in the selection
        for (let col = minCol; col <= maxCol; col++) {
          // Get the source cell (first row)
          const sourceKey = getCellKey(minRow, col);
          const sourceCell = prev.cells.get(sourceKey);

          // Copy to all rows below in the selection
          for (let row = minRow + 1; row <= maxRow; row++) {
            const targetKey = getCellKey(row, col);
            if (sourceCell) {
              // Clone the source cell to the target row
              newCells.set(targetKey, {
                ...sourceCell,
                row,
                col,
              });
            } else {
              // If source is empty, clear the target
              newCells.delete(targetKey);
            }
          }
        }

        return { ...prev, cells: newCells };
      });
    },
    copyRight: () => {
      const range = selectionRange || (selectedCell ? { start: selectedCell, end: selectedCell } : null);
      if (!range) return;

      const minRow = Math.min(range.start.row, range.end.row);
      const maxRow = Math.max(range.start.row, range.end.row);
      const minCol = Math.min(range.start.col, range.end.col);
      const maxCol = Math.max(range.start.col, range.end.col);

      // If only one column selected, nothing to copy right
      if (minCol === maxCol) return;

      setGridData((prev) => {
        const newCells = new Map(prev.cells);

        // For each row in the selection
        for (let row = minRow; row <= maxRow; row++) {
          // Get the source cell (first column)
          const sourceKey = getCellKey(row, minCol);
          const sourceCell = prev.cells.get(sourceKey);

          // Copy to all columns to the right in the selection
          for (let col = minCol + 1; col <= maxCol; col++) {
            const targetKey = getCellKey(row, col);
            if (sourceCell) {
              // Clone the source cell to the target column
              newCells.set(targetKey, {
                ...sourceCell,
                row,
                col,
              });
            } else {
              // If source is empty, clear the target
              newCells.delete(targetKey);
            }
          }
        }

        return { ...prev, cells: newCells };
      });
    },
    getSelectedFormatting: () => {
      if (!selectedCell) return undefined;
      const key = getCellKey(selectedCell.row, selectedCell.col);
      const cell = gridData.cells.get(key);
      return cell?.formatting;
    },
    getSelectedCell: () => {
      return selectedCell;
    },
    getSelectedCellType: () => {
      if (!selectedCell) return undefined;
      const key = getCellKey(selectedCell.row, selectedCell.col);
      const cell = gridData.cells.get(key);
      return cell?.value.type;
    },
    setCellType: (cellType: CellType) => {
      const selectedCells = getSelectedCells();
      if (selectedCells.length === 0) return;

      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        selectedCells.forEach(({ row, col }) => {
          const key = getCellKey(row, col);
          const existingCell = newCells.get(key);
          
          if (existingCell) {
            // Force the type to the selected one
            newCells.set(key, {
              ...existingCell,
              value: {
                ...existingCell.value,
                type: cellType,
              },
            });
          }
        });
        return { ...prev, cells: newCells };
      });
    },
    importCells: (cells: Map<string, Cell>, autoExpand = true, tableMetadata?: any) => {
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        let maxRow = prev.rowCount;
        let maxCol = prev.colCount;
        
        // Find the maximum row and column in the imported cells
        if (autoExpand) {
          cells.forEach((cell) => {
            maxRow = Math.max(maxRow, cell.row + 1);
            maxCol = Math.max(maxCol, cell.col + 1);
          });
        }
        
        // Add imported cells to the grid
        cells.forEach((cell, key) => {
          newCells.set(key, cell);
        });
        
        return {
          cells: newCells,
          rowCount: maxRow,
          colCount: maxCol,
        };
      });

      // Add table metadata if provided
      if (tableMetadata) {
        const tableId = `table-${Date.now()}`;
        setTables(prev => {
          const newTables = new Map(prev);
          newTables.set(tableId, {
            id: tableId,
            startRow: tableMetadata.startRow,
            startCol: tableMetadata.startCol,
            endRow: tableMetadata.endRow,
            endCol: tableMetadata.endCol,
            headerRow: tableMetadata.headerRow,
            hasHeader: tableMetadata.hasHeader,
          });
          return newTables;
        });
      }
    },
    batchUpdateCells: (updates: Array<{ row: number; col: number; value: string }>) => {
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        let maxRow = prev.rowCount;
        let maxCol = prev.colCount;
        
        // Process all updates in a single pass
        updates.forEach(({ row, col, value }) => {
          const key = getCellKey(row, col);
          const parsedValue = parseCellValue(value);
          
          // Track grid dimensions
          maxRow = Math.max(maxRow, row + 1);
          maxCol = Math.max(maxCol, col + 1);
          
          if (value.trim() === '') {
            newCells.delete(key);
          } else {
            const newCell: Cell = {
              row,
              col,
              value: parsedValue,
            };
            
            // Auto-apply detected date format
            if ((parsedValue.type === 'date' || parsedValue.type === 'datetime') && parsedValue.detectedFormat) {
              newCell.formatting = {
                dateFormat: parsedValue.detectedFormat,
              };
            }
            
            newCells.set(key, newCell);
          }
        });
        
        return {
          cells: newCells,
          rowCount: maxRow,
          colCount: maxCol,
        };
      });
    },
  }), [getSelectedCells, gridData.cells, clipboardData, selectedCell, onClipboardChange, gridData.colCount, gridData.rowCount, parseCellValue]);

  return (
    <Paper elevation={3} sx={{ p: 2, position: 'relative', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <Box ref={containerRef} sx={{ position: 'relative', userSelect: 'none', overflow: 'auto', flex: 1 }}>
        <svg ref={svgRef} />
        {editingCell && (
          <TextField
            autoFocus
            value={editValue}
            onChange={(e) => {
              const next = e.target.value;
              setEditValue(next);
              editValueRef.current = next;
            }}
            onBlur={() => saveEditingCell(editingCell, null)}
            onKeyDown={handleKeyDown}
            size="small"
            sx={{
              position: 'absolute',
              top: getEditFieldPosition().top,
              left: getEditFieldPosition().left,
              width: getEditFieldPosition().width,
              height: getEditFieldPosition().height,
              userSelect: 'text',
              '& .MuiInputBase-root': {
                height: getEditFieldPosition().height,
                fontSize: '12px',
                backgroundColor: 'white',
                padding: 0,
              },
              '& .MuiInputBase-input': {
                padding: '0 5px',
                height: '100%',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                border: '2px solid #1976d2',
              },
            }}
          />
        )}
        {filterDialog && (() => {
          const table = tables.get(filterDialog.tableId);
          if (!table) return null;
          
          // Get all unique values in the column
          const values: string[] = [];
          for (let r = table.headerRow! + 1; r <= table.endRow; r++) {
            const key = getCellKey(r, filterDialog.column);
            const cell = gridData.cells.get(key);
            if (cell) {
              const value = formatCellValueUtil(cell.value);
              if (!values.includes(value)) {
                values.push(value);
              }
            }
          }
          
          return (
            <TableFilterDialog
              open={filterDialog.open}
              onClose={() => setFilterDialog(null)}
              onApply={(selectedValues) => handleApplyFilter(filterDialog.tableId, filterDialog.column, selectedValues)}
              columnName={filterDialog.columnName}
              values={values}
              currentFilter={table.filters?.get(filterDialog.column)}
            />
          );
        })()}
      </Box>
    </Paper>
  );
}

export const ExcelGrid = forwardRef<ExcelGridHandle, ExcelGridProps>(ExcelGridComponent);

ExcelGrid.displayName = 'ExcelGrid';
