import type { Cell, CellValue } from '../types/cell';
import { getCellKey } from '../types/cell';

export interface CSVImportOptions {
  delimiter?: string;
  hasHeader?: boolean;
  startRow?: number;
  startCol?: number;
  trimValues?: boolean;
  skipEmptyLines?: boolean;
}

export interface CSVImportResult {
  cells: Map<string, Cell>;
  rowCount: number;
  colCount: number;
  headers?: string[];
}

/**
 * Parse CSV content and convert to cell data
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
  } = options;

  const cells = new Map<string, Cell>();
  const lines = csvContent.split(/\r?\n/);
  let headers: string[] | undefined;
  let maxColCount = 0;
  let actualRowCount = 0;

  lines.forEach((line, lineIndex) => {
    // Skip empty lines if configured
    if (skipEmptyLines && line.trim() === '') {
      return;
    }

    const values = parseCSVLine(line, delimiter);
    
    // Handle header row
    if (hasHeader && lineIndex === 0) {
      headers = trimValues ? values.map(v => v.trim()) : values;
      return;
    }

    // Calculate target row (accounting for header and start position)
    const targetRow = startRow + actualRowCount;
    actualRowCount++;

    // Update max column count
    maxColCount = Math.max(maxColCount, values.length);

    // Create cells for each value
    values.forEach((value, colIndex) => {
      const targetCol = startCol + colIndex;
      const processedValue = trimValues ? value.trim() : value;
      
      // Skip empty cells if desired
      if (processedValue === '' && skipEmptyLines) {
        return;
      }

      const key = getCellKey(targetRow, targetCol);
      const cellValue = inferCellValue(processedValue);

      cells.set(key, {
        row: targetRow,
        col: targetCol,
        value: cellValue,
      });
    });
  });

  return {
    cells,
    rowCount: actualRowCount,
    colCount: maxColCount,
    headers,
  };
};

/**
 * Parse a single CSV line, handling quoted values with delimiters
 */
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"';
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
      values.push(currentValue);
      currentValue = '';
      i++;
      continue;
    }

    currentValue += char;
    i++;
  }

  // Add the last value
  values.push(currentValue);

  return values;
};

/**
 * Infer the cell value type from a string
 */
const inferCellValue = (value: string): CellValue => {
  const trimmed = value.trim();

  // Empty
  if (trimmed === '') {
    return { type: 'text', value: '', rawValue: value };
  }

  // Boolean
  if (trimmed.toLowerCase() === 'true') {
    return { type: 'boolean', value: true, rawValue: value };
  }
  if (trimmed.toLowerCase() === 'false') {
    return { type: 'boolean', value: false, rawValue: value };
  }

  // Number (including negative and decimal)
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return { type: 'number', value: num, rawValue: value };
  }

  // Date (ISO format YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return { type: 'date', value: date, rawValue: value };
    }
  }

  // Default to text
  return { type: 'text', value: value, rawValue: value };
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
