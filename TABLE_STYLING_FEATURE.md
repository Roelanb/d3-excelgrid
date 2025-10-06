# CSV Table Styling Feature

## Overview
This feature adds visual table styling to CSV imports, making imported data appear as a formatted table within the Excel grid.

## Implementation Details

### 1. CSV Import Utility (`csvImport.ts`)
- Added `applyTableStyle` option to `CSVImportOptions` interface
- When enabled, applies the following styling:

#### Header Row Styling (First row when `hasHeader` is true):
- **Bold text**: Makes header text stand out
- **Fill color**: Light blue background (`#e3f2fd`)
- **Borders**: Blue borders with thicker bottom border
  - Top/Right/Left: 1px solid blue (`#1976d2`)
  - Bottom: 2px solid blue (`#1976d2`) - emphasizes header separation
- **Text alignment**: Center-aligned

#### Data Row Styling:
- **Borders**: Light blue borders on all sides
  - All sides: 1px solid light blue (`#90caf9`)

### 2. CSV Import Dialog (`CSVImportDialog.tsx`)
- Added checkbox: "Apply table styling (borders and header formatting)"
- Default state: **Enabled** (checked by default)
- State management for `applyTableStyle` option
- Passes the option to the CSV parser

### 3. How It Works
1. User opens the CSV Import dialog
2. Selects a CSV file
3. The "Apply table styling" checkbox is checked by default
4. When importing:
   - If "First row is header" is checked AND "Apply table styling" is enabled:
     - First row gets header styling (bold, blue background, borders)
   - All data rows get border styling
   - The result is a visually distinct table within the grid

### 4. Visual Design
The styling creates a clear table structure:
- **Header**: Blue theme with bold text and centered alignment
- **Data cells**: Bordered cells that clearly delineate the table structure
- **Color scheme**: Uses Material-UI blue palette for consistency

## Usage Example

1. **Select a cell** in the grid where you want the CSV data to start
2. Click "Import CSV" button
3. Select a CSV file (e.g., `sample-data.csv`)
4. The "Start Row" and "Start Column" fields will be pre-filled with your selected cell position
5. Ensure "First row is header" is checked
6. Ensure "Apply table styling" is checked (default)
7. Click "Import"
8. The CSV data will be displayed as a formatted table starting at the selected cell position

## Files Modified

1. `/excel-grid/src/utils/csvImport.ts`
   - Added `applyTableStyle` to options
   - Implemented header and data cell styling logic

2. `/excel-grid/src/components/CSVImportDialog.tsx`
   - Added UI checkbox for table styling option
   - Added state management for the option
   - Passes option to CSV parser
   - Accepts `selectedCell` prop to pre-fill start position
   - Updates start row/col when selected cell changes

3. `/excel-grid/src/components/ExcelGrid.tsx`
   - Added `getSelectedCell()` method to ExcelGridHandle interface
   - Returns currently selected cell position

4. `/excel-grid/src/App.tsx`
   - Passes selected cell to CSVImportDialog
   - Updated UI description to mention CSV import at selected position

## Benefits

- **Visual clarity**: Tables are immediately recognizable
- **Professional appearance**: Data looks organized and structured
- **Flexible**: Can be toggled on/off based on user preference
- **Consistent**: Uses existing cell formatting system
- **Precise positioning**: Import CSV data at any selected cell location
- **Smart defaults**: Automatically uses selected cell as import start position
