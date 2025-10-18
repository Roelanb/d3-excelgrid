import type { Cell } from '../types/cell';
import { getCellKey } from '../types/cell';
import { inferCellValue } from './dataTypeInference';

export interface CSVImportOptions {
  delimiter?: string;
  hasHeader?: boolean;
  startRow?: number;
  startCol?: number;
  trimValues?: boolean;
  skipEmptyLines?: boolean;
  applyTableStyle?: boolean;
}

export interface CSVImportResult {
  cells: Map<string, Cell>;
  rowCount: number;
  colCount: number;
  headers?: string[];
  tableMetadata?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    headerRow?: number;
    hasHeader: boolean;
  };
}

/**
 * Parse CSV content and convert to cell data with optimized single-pass processing
 */
export const parseCSV = (
  csvContent: string,
  options: CSVImportOptions = {}
): CSVImportResult => {
  const {
    delimiter = ',',
    hasHeader = false,
    startRow = 0,
    startCol = 0,
    trimValues = true,
    skipEmptyLines = true,
    applyTableStyle = false,
  } = options;

  const cells = new Map<string, Cell>();
  const lines = csvContent.split(/\r?\n/);
  let headers: string[] | undefined;
  let maxColCount = 0;
  let actualRowCount = 0;

  // Pre-compute header formatting if needed
  const headerFormatting = applyTableStyle ? {
    bold: true,
    fillColor: '#e3f2fd',
    borderStyle: {
      top: { width: 1, color: '#1976d2', style: 'solid' as const },
      right: { width: 1, color: '#1976d2', style: 'solid' as const },
      bottom: { width: 2, color: '#1976d2', style: 'solid' as const },
      left: { width: 1, color: '#1976d2', style: 'solid' as const },
    },
    textAlign: 'center' as const,
  } : undefined;

  const dataFormatting = applyTableStyle ? {
    borderStyle: {
      top: { width: 1, color: '#90caf9', style: 'solid' as const },
      right: { width: 1, color: '#90caf9', style: 'solid' as const },
      bottom: { width: 1, color: '#90caf9', style: 'solid' as const },
      left: { width: 1, color: '#90caf9', style: 'solid' as const },
    },
  } : undefined;

  // Single-pass processing: parse and create cells in one iteration
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Skip empty lines if configured
    if (skipEmptyLines && line.trim() === '') {
      continue;
    }

    const values = parseCSVLine(line, delimiter);
    const isHeaderRow = hasHeader && lineIndex === 0;
    
    // Handle header row
    if (isHeaderRow) {
      headers = trimValues ? values.map(v => v.trim()) : values;
      
      // Create header cells directly if table style is enabled
      if (applyTableStyle) {
        for (let colIndex = 0; colIndex < values.length; colIndex++) {
          const value = values[colIndex];
          const processedValue = trimValues ? value.trim() : value;
          const targetCol = startCol + colIndex;
          const key = getCellKey(startRow, targetCol);

          cells.set(key, {
            row: startRow,
            col: targetCol,
            value: inferCellValue(processedValue),
            formatting: headerFormatting,
          });
        }
        maxColCount = values.length;
        actualRowCount = 1;
      }
      continue;
    }

    // Calculate target row (accounting for header and start position)
    const targetRow = startRow + actualRowCount;
    actualRowCount++;

    // Update max column count
    if (values.length > maxColCount) {
      maxColCount = values.length;
    }

    // Create cells for each value in single pass
    for (let colIndex = 0; colIndex < values.length; colIndex++) {
      const value = values[colIndex];
      const processedValue = trimValues ? value.trim() : value;
      
      // Skip empty cells if desired
      if (processedValue === '' && skipEmptyLines) {
        continue;
      }

      const targetCol = startCol + colIndex;
      const key = getCellKey(targetRow, targetCol);

      const cell: Cell = {
        row: targetRow,
        col: targetCol,
        value: inferCellValue(processedValue),
      };
      if (dataFormatting) {
        cell.formatting = dataFormatting;
      }
      cells.set(key, cell);
    }
  }

  const tableMetadata = applyTableStyle ? {
    startRow,
    startCol,
    endRow: startRow + actualRowCount - 1,
    endCol: startCol + maxColCount - 1,
    headerRow: hasHeader ? startRow : undefined,
    hasHeader,
  } : undefined;

  return {
    cells,
    rowCount: actualRowCount,
    colCount: maxColCount,
    headers,
    tableMetadata,
  };
};

/**
 * Parse a single CSV line, handling quoted values with delimiters
 * Optimized with array-based string concatenation
 */
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  const currentValueChars: string[] = [];
  let insideQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentValueChars.push('"');
        i += 2;
        continue;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (char === delimiter && !insideQuotes) {
      // End of value
      values.push(currentValueChars.join(''));
      currentValueChars.length = 0;
      i++;
      continue;
    }

    currentValueChars.push(char);
    i++;
  }

  // Add the last value
  values.push(currentValueChars.join(''));

  return values;
};

/**
 * Read a file and return its content as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Detect the delimiter used in a CSV file
 */
export const detectDelimiter = (csvContent: string): string => {
  const firstLine = csvContent.split(/\r?\n/)[0];
  const delimiters = [',', ';', '\t', '|'];
  
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  delimiters.forEach(delimiter => {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  });
  
  return detectedDelimiter;
};
