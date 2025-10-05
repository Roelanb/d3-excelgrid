import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Paper, TextField } from '@mui/material';
import type { Cell, CellValue, GridData } from '../types/cell';
import { getCellKey, getColumnLabel } from '../types/cell';

type SelectionRange = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type SelectionType = 'cell' | 'row' | 'column';

interface ExcelGridProps {
  initialRows?: number;
  initialCols?: number;
  cellWidth?: number;
  cellHeight?: number;
  headerWidth?: number;
  headerHeight?: number;
}

export interface ExcelGridHandle {
  clearGrid: () => void;
  setCellValue: (row: number, col: number, value: string) => void;
  setCellRange: (startRow: number, startCol: number, endRow: number, endCol: number, value: string) => void;
}

export const ExcelGrid = forwardRef<ExcelGridHandle, ExcelGridProps>((
  {
    initialRows = 500,
    initialCols = 260,
    cellWidth = 100,
    cellHeight = 30,
    headerWidth = 50,
    headerHeight = 30,
  },
  ref
) => {
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
    // Check multi-ranges first (for ctrl-click selections)
    if (selectionRanges.length > 0) {
      for (const range of selectionRanges) {
        if (selectionType === 'row') {
          const minRow = Math.min(range.start.row, range.end.row);
          const maxRow = Math.max(range.start.row, range.end.row);
          if (row >= minRow && row <= maxRow) return true;
        } else if (selectionType === 'column') {
          const minCol = Math.min(range.start.col, range.end.col);
          const maxCol = Math.max(range.start.col, range.end.col);
          if (col >= minCol && col <= maxCol) return true;
        } else {
          const minRow = Math.min(range.start.row, range.end.row);
          const maxRow = Math.max(range.start.row, range.end.row);
          const minCol = Math.min(range.start.col, range.end.col);
          const maxCol = Math.max(range.start.col, range.end.col);
          if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) return true;
        }
      }
      return false;
    }

    // Fallback to single range
    if (!selectionRange) return false;
    
    if (selectionType === 'row') {
      const minRow = Math.min(selectionRange.start.row, selectionRange.end.row);
      const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row);
      return row >= minRow && row <= maxRow;
    }
    
    if (selectionType === 'column') {
      const minCol = Math.min(selectionRange.start.col, selectionRange.end.col);
      const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col);
      return col >= minCol && col <= maxCol;
    }
    
    const minRow = Math.min(selectionRange.start.row, selectionRange.end.row);
    const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row);
    const minCol = Math.min(selectionRange.start.col, selectionRange.end.col);
    const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

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
      .attr('x', (d) => getColumnWidth(d) - 3)
      .attr('y', 0)
      .attr('width', 6)
      .attr('height', headerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'col-resize')
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
      .attr('y', (d) => getRowHeight(d) - 3)
      .attr('width', headerWidth)
      .attr('height', 6)
      .attr('fill', 'transparent')
      .style('cursor', 'row-resize')
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

    // Draw grid cells (only visible cells)
    const rows = g
      .selectAll('.row')
      .data(visibleRows)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (d) => `translate(${headerWidth}, ${getRowY(d)})`);

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
        const colWidth = getColumnWidth(d.col);
        const rowHeight = getRowHeight(d.row);

        cellGroup
          .append('rect')
          .attr('width', colWidth)
          .attr('height', rowHeight)
          .attr('fill', isInRange ? '#bbdefb' : (isSelected ? '#e3f2fd' : 'white'))
          .attr('stroke', '#ccc')
          .attr('stroke-width', isInRange || isSelected ? 2 : 1)
          .style('cursor', 'cell');

        // Only show cell text if not currently editing this cell
        if (cell && !isEditing) {
          cellGroup
            .append('text')
            .attr('x', 5)
            .attr('y', rowHeight / 2)
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '12px')
            .text(formatCellValue(cell.value))
            .style('pointer-events', 'none');
        }

        cellGroup.on('mousedown', (event) => handleCellMouseDown(d.row, d.col, event as MouseEvent));
        cellGroup.on('mouseenter', () => handleCellMouseEnter(d.row, d.col));
        cellGroup.on('click', () => handleCellClick(d.row, d.col));
        cellGroup.on('dblclick', () => handleCellDoubleClick(d.row, d.col));
      });

    // Draw top-left corner header
    g.append('rect')
      .attr('width', headerWidth)
      .attr('height', headerHeight)
      .attr('fill', '#e0e0e0')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);
  }, [gridData.cells, selectedCell, selectionRange, selectionRanges, selectionType, editingCell, headerWidth, headerHeight, viewport, getColumnWidth, getRowHeight, getColumnX, getRowY, totalWidth, totalHeight]);

  const formatCellValue = (value: CellValue): string => {
    if (value.value === null || value.value === undefined) return '';

    switch (value.type) {
      case 'date':
        return value.value instanceof Date
          ? value.value.toLocaleDateString()
          : String(value.value);
      case 'boolean':
        return value.value ? 'TRUE' : 'FALSE';
      case 'number':
        return typeof value.value === 'number'
          ? value.value.toString()
          : String(value.value);
      default:
        return String(value.value);
    }
  };

  const parseCellValue = (input: string): CellValue => {
    const trimmed = input.trim();

    // Boolean
    if (trimmed.toLowerCase() === 'true') {
      return { type: 'boolean', value: true, rawValue: input };
    }
    if (trimmed.toLowerCase() === 'false') {
      return { type: 'boolean', value: false, rawValue: input };
    }

    // Number
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') {
      return { type: 'number', value: num, rawValue: input };
    }

    // Date (basic ISO format detection)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (datePattern.test(trimmed)) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return { type: 'date', value: date, rawValue: input };
      }
    }

    // Default to text
    return { type: 'text', value: input, rawValue: input };
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
      const newCell: Cell = {
        row: cellToSave.row,
        col: cellToSave.col,
        value: parseCellValue(valueToSave),
      };

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
    []
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

      console.log('mousedown', row, col, 'selected:', selectedCell, 'range:', selectionRange);

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
      console.log('Starting new selection');
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
      if (isDraggingRef.current && selectionRangeRef.current && selectionType === 'row') {
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
      console.log('click', row, col);

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
    []
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
      } else if (e.key === 'Escape') {
        handleEditCancel();
      }
    },
    [handleEditSubmit, handleEditCancel]
  );

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
  }, [editingCell, selectedCell, enterEditMode]);

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
      const newCell: Cell = {
        row,
        col,
        value: parseCellValue(value),
      };
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
      setGridData((prev) => {
        const newCells = new Map(prev.cells);
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const key = getCellKey(row, col);
            const newCell: Cell = {
              row,
              col,
              value: parseCellValue(value),
            };
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
  }));

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
      </Box>
    </Paper>
  );
});

ExcelGrid.displayName = 'ExcelGrid';
