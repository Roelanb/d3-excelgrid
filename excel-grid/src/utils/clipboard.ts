import type { Cell } from '../types/cell';

export interface ClipboardData {
  cells: Cell[];
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
  isCut: boolean;
}

export const copyCellsToClipboard = (cells: Map<string, Cell>, selectedCells: { row: number; col: number }[]): ClipboardData | null => {
  if (selectedCells.length === 0) return null;

  const cellsToCopy: Cell[] = [];
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;

  selectedCells.forEach(({ row, col }) => {
    const key = `${row}-${col}`;
    const cell = cells.get(key);
    
    if (cell) {
      cellsToCopy.push(cell);
    } else {
      // Include empty cells in selection
      cellsToCopy.push({
        row,
        col,
        value: { type: 'text', value: '', rawValue: '' },
      });
    }

    minRow = Math.min(minRow, row);
    minCol = Math.min(minCol, col);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  });

  return {
    cells: cellsToCopy,
    minRow,
    minCol,
    maxRow,
    maxCol,
    isCut: false,
  };
};

export const cutCellsToClipboard = (cells: Map<string, Cell>, selectedCells: { row: number; col: number }[]): ClipboardData | null => {
  const clipboardData = copyCellsToClipboard(cells, selectedCells);
  if (clipboardData) {
    clipboardData.isCut = true;
  }
  return clipboardData;
};

export const pasteCellsFromClipboard = (
  clipboardData: ClipboardData,
  targetRow: number,
  targetCol: number
): Cell[] => {
  const pastedCells: Cell[] = [];
  const rowOffset = targetRow - clipboardData.minRow;
  const colOffset = targetCol - clipboardData.minCol;

  clipboardData.cells.forEach((cell) => {
    const newCell: Cell = {
      row: cell.row + rowOffset,
      col: cell.col + colOffset,
      value: { ...cell.value },
      formatting: cell.formatting ? { ...cell.formatting } : undefined,
    };
    pastedCells.push(newCell);
  });

  return pastedCells;
};

export const getSelectedCellsInRange = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): { row: number; col: number }[] => {
  const cells: { row: number; col: number }[] = [];
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ row, col });
    }
  }

  return cells;
};
