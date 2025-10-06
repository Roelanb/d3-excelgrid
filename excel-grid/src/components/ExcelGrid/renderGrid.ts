import * as d3 from 'd3';
import React from 'react';
import type { Cell, GridData, CellFormatting } from '../../types/cell';
import { getCellKey, getColumnLabel as defaultGetColumnLabel } from '../../types/cell';
import type { Viewport } from './hooks/useViewport';

export interface RenderGridParams {
  svgRef: React.RefObject<SVGSVGElement>;
  totalWidth: number;
  totalHeight: number;
  viewport: Viewport;
  gridData: GridData;
  headerWidth: number;
  headerHeight: number;
  getColumnX: (col: number) => number;
  getRowY: (row: number) => number;
  getColumnWidth: (col: number) => number;
  getRowHeight: (row: number) => number;
  formatCellValue: (value: Cell['value']) => string;
  getColumnLabel?: (col: number) => string;
  isCellInSelection: (row: number, col: number) => boolean;
  selectionType: 'cell' | 'row' | 'column';
  selectionRange: { start: { row: number; col: number }; end: { row: number; col: number } } | null;
  selectionRanges: { start: { row: number; col: number }; end: { row: number; col: number } }[];
  selectedCell: { row: number; col: number } | null;
  editingCell: { row: number; col: number } | null;
  handleColumnHeaderClick: (col: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
  handleColumnHeaderEnter: (col: number) => void;
  handleRowHeaderClick: (row: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
  handleRowHeaderEnter: (row: number) => void;
  handleCellMouseDown: (row: number, col: number, event?: MouseEvent) => void;
  handleCellMouseEnter: (row: number, col: number) => void;
  handleCellClick: (row: number, col: number) => void;
  handleCellDoubleClick: (row: number, col: number) => void;
  setResizing: React.Dispatch<React.SetStateAction<{ type: 'col' | 'row'; index: number; startPos: number; startSize: number; affectedIndices: number[] } | null>>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Map<number, number>>>;
}

export const renderGrid = ({
  svgRef,
  totalWidth,
  totalHeight,
  viewport,
  gridData,
  headerWidth,
  headerHeight,
  getColumnX,
  getRowY,
  getColumnWidth,
  getRowHeight,
  formatCellValue,
  isCellInSelection,
  selectionType,
  selectionRange,
  selectionRanges,
  selectedCell,
  editingCell,
  handleColumnHeaderClick,
  handleColumnHeaderEnter,
  handleRowHeaderClick,
  handleRowHeaderEnter,
  handleCellMouseDown,
  handleCellMouseEnter,
  handleCellClick,
  handleCellDoubleClick,
  setResizing,
  setColumnWidths,
  getColumnLabel,
}: RenderGridParams) => {
  if (!svgRef.current) return;

  const svg = d3.select(svgRef.current);
  svg.selectAll('*').remove();
  svg.attr('width', totalWidth).attr('height', totalHeight);

  const defs = svg.append('defs');
  const g = svg.append('g');

  const resolveColumnLabel = getColumnLabel ?? defaultGetColumnLabel;

  const visibleCols = d3.range(viewport.startCol, Math.min(viewport.endCol, gridData.colCount));
  const visibleRows = d3.range(viewport.startRow, Math.min(viewport.endRow, gridData.rowCount));

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
    .on('mousedown', function (event, d) {
      event.stopPropagation();
      handleColumnHeaderClick(d, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    })
    .on('mouseenter', function (_event, d) {
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
    .text((d) => resolveColumnLabel(d));

  // Resize handles
  colHeaders
    .append('rect')
    .attr('class', 'col-resize-handle')
    .attr('x', (d) => getColumnWidth(d) - 5)
    .attr('y', 0)
    .attr('width', 10)
    .attr('height', headerHeight)
    .attr('fill', 'transparent')
    .style('cursor', 'col-resize')
    .on('mouseenter', function () {
      d3.select(this).attr('fill', 'rgba(25, 118, 210, 0.1)');
    })
    .on('mouseleave', function () {
      d3.select(this).attr('fill', 'transparent');
    })
    .on('dblclick', function (event, d) {
      event.stopPropagation();

      let maxWidth = 50;
      const padding = 10;

      const headerText = resolveColumnLabel(d);
      const headerWidth = headerText.length * 8 + padding;
      maxWidth = Math.max(maxWidth, headerWidth);

      for (let row = 0; row < gridData.rowCount; row++) {
        const key = getCellKey(row, d);
        const cell = gridData.cells.get(key);
        if (cell) {
          const cellText = formatCellValue(cell.value);
          const fontSize = cell.formatting?.fontSize || 12;
          const isBold = cell.formatting?.bold || false;
          const charWidth = fontSize * 0.6;
          const textWidth = cellText.length * charWidth * (isBold ? 1.1 : 1) + padding;
          maxWidth = Math.max(maxWidth, textWidth);
        }
      }

      maxWidth = Math.min(maxWidth, 500);

      setColumnWidths((prev) => {
        const newWidths = new Map(prev);
        newWidths.set(d, maxWidth);
        return newWidths;
      });
    })
    .on('mousedown', function (event, d) {
      event.stopPropagation();
      setResizing({ type: 'col', index: d, startPos: event.clientX, startSize: getColumnWidth(d), affectedIndices: [d] });
    });

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
    .on('mousedown', function (event, d) {
      event.stopPropagation();
      handleRowHeaderClick(d, { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    })
    .on('mouseenter', function (_event, d) {
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
        key: `${row}-${col}`,
      }))
    )
    .enter()
    .append('g')
    .attr('class', 'cell')
    .attr('transform', (d) => `translate(${getColumnX(d.col) - headerWidth}, 0)`)
    .each(function (d) {
      const cellGroup = d3.select(this);
      const cell = gridData.cells.get(d.key);
      const isEditing = editingCell?.row === d.row && editingCell?.col === d.col;
      const isSelected = selectedCell?.row === d.row && selectedCell?.col === d.col;
      const isInRange = isCellInSelection(d.row, d.col);
      const colWidth = getColumnWidth(d.col);
      const rowHeight = getRowHeight(d.row);
      const formatting = cell?.formatting as CellFormatting | undefined;

      let fillColor = 'white';
      if (isInRange) fillColor = '#bbdefb';
      else if (isSelected) fillColor = '#e3f2fd';
      else if (formatting?.fillColor) fillColor = formatting.fillColor;

      cellGroup
        .append('rect')
        .attr('width', colWidth)
        .attr('height', rowHeight)
        .attr('fill', fillColor)
        .attr('stroke', '#ccc')
        .attr('stroke-width', isInRange || isSelected ? 2 : 1)
        .style('cursor', 'cell');

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

        const textAlign = formatting?.textAlign || 'left';
        let textX = cellPadding;
        let textAnchor: 'start' | 'middle' | 'end' = 'start';

        if (textAlign === 'center') {
          textX = colWidth / 2;
          textAnchor = 'middle';
        } else if (textAlign === 'right') {
          textX = colWidth - cellPadding;
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
          .text(formatCellValue(cell.value))
          .style('pointer-events', 'none');

        if (formatting?.underline) {
          textElement.attr('text-decoration', 'underline');
        }
      }

      cellGroup
        .on('mousedown', (event) => handleCellMouseDown(d.row, d.col, event as MouseEvent))
        .on('mouseenter', () => handleCellMouseEnter(d.row, d.col))
        .on('click', () => handleCellClick(d.row, d.col))
        .on('dblclick', () => handleCellDoubleClick(d.row, d.col));
    });

  g
    .append('rect')
    .attr('width', headerWidth)
    .attr('height', headerHeight)
    .attr('fill', '#e0e0e0')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1);
};
