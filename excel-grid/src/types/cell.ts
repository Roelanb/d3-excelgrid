export type CellType = 'text' | 'number' | 'date' | 'boolean';

export interface CellValue {
  type: CellType;
  value: string | number | Date | boolean | null;
  rawValue?: string;
}

export type BorderLineStyle = 'solid' | 'dashed' | 'dotted';

export interface BorderLine {
  width: number;
  color: string;
  style: BorderLineStyle;
}

export interface BorderStyle {
  top?: BorderLine;
  right?: BorderLine;
  bottom?: BorderLine;
  left?: BorderLine;
}

export interface CellFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  fillColor?: string;
  borderStyle?: BorderStyle;
}

export interface Cell {
  row: number;
  col: number;
  value: CellValue;
  formatting?: CellFormatting;
}

export interface GridData {
  cells: Map<string, Cell>;
  rowCount: number;
  colCount: number;
}

export const getCellKey = (row: number, col: number): string => `${row}-${col}`;

export const getColumnLabel = (col: number): string => {
  let label = '';
  let num = col;
  while (num >= 0) {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  }
  return label;
};
