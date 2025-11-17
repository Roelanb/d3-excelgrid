export type CellType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'boolean' 
  | 'guid' 
  | 'uri' 
  | 'email' 
  | 'phone' 
  | 'time' 
  | 'datetime' 
  | 'duration' 
  | 'currency' 
  | 'percentage';

export interface CellValue {
  type: CellType;
  value: string | number | Date | boolean | null;
  rawValue?: string;
  detectedFormat?: string;
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

export type TextAlign = 'left' | 'center' | 'right';

export interface CellFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  fillColor?: string;
  borderStyle?: BorderStyle;
  textAlign?: TextAlign;
  dateFormat?: string;
  numberFormat?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface DatabaseMetadata {
  id: string;
  schema: string;
  table: string;
  displayName: string;
  importTime: Date;
  apiBaseUrl: string;
  isAuthenticated: boolean;
  startRow: number;
  startCol: number;
  primaryKeyColumn?: string;
  columns?: ColumnInfo[];
}

export type DatabaseChangeOperation = 'insert' | 'update' | 'delete';

export interface DatabaseChangeLogEntry {
  id: string;
  timestamp: Date;
  operation: DatabaseChangeOperation;
  primaryKey?: string | number | null;
  rowIndex?: number;
  details?: Record<string, any>;
}

export interface TableMetadata {
  id: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  headerRow: number;
  hasHeader: boolean;
  sortColumn?: number;
  sortDirection?: SortDirection;
  filters?: Map<number, Set<string>>; // column index -> set of visible values
}

export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface Cell {
  row: number;
  col: number;
  value: CellValue;
  formatting?: CellFormatting;
  // Edit mode tracking
  isDirty?: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  originalValue?: CellValue;
  databaseMetadata?: DatabaseMetadata;
}

export interface EditModeState {
  isActive: boolean;
  schema: string;
  table: string;
  databaseId: string;
  columns: ColumnInfo[];
  primaryKeyColumn: string;
  dirtyRows: Set<number>;
  newRows: Set<number>;
  deletedRows: Set<number>;
  originalData: Map<string, CellValue>;
}

export interface RowOperation {
  row: number;
  type: 'insert' | 'update' | 'delete';
  data?: Record<string, any>;
  id?: string | number;
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
