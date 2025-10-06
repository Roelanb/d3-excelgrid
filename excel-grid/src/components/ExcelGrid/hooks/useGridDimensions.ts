import { useState, useCallback } from 'react';

export const useGridDimensions = (defaultColumnWidth: number, defaultRowHeight: number) => {
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [rowHeights, setRowHeights] = useState<Map<number, number>>(new Map());

  const getColumnWidth = useCallback(
    (col: number): number => columnWidths.get(col) || defaultColumnWidth,
    [columnWidths, defaultColumnWidth]
  );

  const getRowHeight = useCallback(
    (row: number): number => rowHeights.get(row) || defaultRowHeight,
    [rowHeights, defaultRowHeight]
  );

  return {
    columnWidths,
    setColumnWidths,
    rowHeights,
    setRowHeights,
    getColumnWidth,
    getRowHeight,
  } as const;
};
