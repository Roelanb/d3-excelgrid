# CSV Import Feature Documentation

## Overview
The Excel Grid now includes a comprehensive CSV import module that allows users to import data from CSV files with various configuration options.

## Features

### 1. File Selection
- Browse and select CSV files (.csv, .txt)
- Drag-and-drop support (via browser file input)
- File name display after selection

### 2. Import Options

#### Delimiter Detection & Selection
- **Auto-detection**: Automatically detects the delimiter used in the CSV file
- **Manual selection**: Choose from common delimiters:
  - Comma (`,`)
  - Semicolon (`;`)
  - Tab (`\t`)
  - Pipe (`|`)

#### Header Row
- **First row is header**: Option to treat the first row as column headers
- Headers are parsed but not imported into the grid (reserved for future use)

#### Position Control
- **Start Row**: Specify which row in the grid to start importing (0-indexed)
- **Start Column**: Specify which column in the grid to start importing (0-indexed)

#### Data Processing
- **Trim whitespace**: Remove leading/trailing spaces from cell values
- **Skip empty lines**: Ignore empty rows in the CSV file

### 3. Data Type Inference
The import module automatically infers cell types:
- **Numbers**: Detects integers and decimals (including negative numbers)
- **Booleans**: Recognizes `true`/`false` (case-insensitive)
- **Dates**: Parses ISO format dates (YYYY-MM-DD)
- **Text**: Default type for all other values

### 4. Preview
- Shows the first 5 lines of the CSV file
- Helps verify the file content and delimiter before importing

### 5. CSV Parsing Features
- **Quoted values**: Handles values enclosed in double quotes
- **Escaped quotes**: Supports escaped quotes within quoted values (`""`)
- **Delimiters in values**: Correctly handles delimiters inside quoted values
- **Line breaks**: Handles different line break formats (CRLF, LF)

## Usage

### Basic Import
1. Click the **"Import CSV"** button
2. Select a CSV file
3. Review the auto-detected settings
4. Click **"Import"**

### Custom Import
1. Click the **"Import CSV"** button
2. Select a CSV file
3. Adjust settings:
   - Change delimiter if auto-detection is incorrect
   - Toggle "First row is header" if needed
   - Set start row/column to position data in the grid
   - Configure data processing options
4. Review the preview
5. Click **"Import"**

## API

### ExcelGrid API Method
```typescript
importCells(cells: Map<string, Cell>): void
```

### CSV Import Functions
```typescript
// Parse CSV content
parseCSV(
  csvContent: string,
  options?: CSVImportOptions
): CSVImportResult

// Read file as text
readFileAsText(file: File): Promise<string>

// Auto-detect delimiter
detectDelimiter(csvContent: string): string
```

### Types
```typescript
interface CSVImportOptions {
  delimiter?: string;          // Default: ','
  hasHeader?: boolean;         // Default: false
  startRow?: number;           // Default: 0
  startCol?: number;           // Default: 0
  trimValues?: boolean;        // Default: true
  skipEmptyLines?: boolean;    // Default: true
}

interface CSVImportResult {
  cells: Map<string, Cell>;
  rowCount: number;
  colCount: number;
  headers?: string[];
}
```

## Example CSV Files

### Simple CSV
```csv
Name,Age,City
John,30,New York
Jane,25,Los Angeles
Bob,35,Chicago
```

### CSV with Quoted Values
```csv
Name,Description,Price
"Widget A","A great product, very useful",19.99
"Widget B","Another ""amazing"" product",29.99
```

### CSV with Different Delimiter
```csv
Name;Age;City
John;30;New York
Jane;25;Los Angeles
```

## Implementation Details

### File Structure
```
src/
├── utils/
│   └── csvImport.ts          # CSV parsing utilities
├── components/
│   └── CSVImportDialog.tsx   # Import dialog component
└── App.tsx                    # Integration
```

### Key Functions

#### parseCSV
Parses CSV content and converts it to cell data:
- Splits content into lines
- Parses each line considering quotes and delimiters
- Infers data types for each value
- Returns a map of cells with their positions

#### parseCSVLine
Handles complex CSV line parsing:
- Respects quoted values
- Handles escaped quotes
- Correctly splits on delimiters outside quotes

#### inferCellValue
Determines the appropriate cell type:
- Tests for boolean values
- Tests for numeric values
- Tests for date values
- Defaults to text

## Error Handling

The import module handles various error scenarios:
- **File read errors**: Shows error message if file cannot be read
- **Invalid CSV format**: Gracefully handles malformed CSV
- **Empty files**: Handles empty or whitespace-only files
- **Large files**: Efficiently processes large CSV files

## Performance

- **Efficient parsing**: Uses optimized string parsing
- **Memory efficient**: Processes file line by line
- **Large file support**: Can handle CSV files with thousands of rows
- **Type inference**: Fast type detection without regex overhead

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Uses FileReader API for file reading
- Native file input for file selection

## Future Enhancements

Potential improvements for future versions:
- **Column mapping**: Map CSV columns to specific grid columns
- **Data validation**: Validate data before import
- **Import preview grid**: Show data in a preview grid before importing
- **Multiple file import**: Import multiple CSV files at once
- **Export to CSV**: Export grid data to CSV format
- **Advanced type detection**: More sophisticated type inference
- **Custom date formats**: Support for various date formats
- **Encoding detection**: Auto-detect file encoding
- **Progress indicator**: Show progress for large files
- **Undo import**: Ability to undo the last import

## Testing

To test the CSV import feature:
1. Create sample CSV files with various formats
2. Test with different delimiters
3. Test with quoted values and special characters
4. Test with large files (1000+ rows)
5. Test error scenarios (invalid files, empty files)
6. Verify data type inference
7. Test positioning options (start row/column)

## Example Integration

```typescript
import { CSVImportDialog } from './components/CSVImportDialog';
import type { Cell } from './types/cell';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const handleCSVImport = (
    cells: Map<string, Cell>,
    rowCount: number,
    colCount: number
  ) => {
    gridRef.current?.importCells(cells);
    console.log(`Imported ${cells.size} cells`);
  };

  return (
    <>
      <Button onClick={() => setCsvDialogOpen(true)}>
        Import CSV
      </Button>
      
      <ExcelGrid ref={gridRef} />
      
      <CSVImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleCSVImport}
      />
    </>
  );
}
```

## Dependencies

No additional dependencies required. Uses:
- React hooks (useState, useRef)
- Material-UI components
- Browser FileReader API
