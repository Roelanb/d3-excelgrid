# Cell Datatype Feature

## Overview
This feature adds automatic datatype inference and manual datatype selection for cells in the Excel grid. The system intelligently detects the datatype from cell contents and provides a toolbar dropdown to manually override the datatype.

## Supported Datatypes

### Basic Types
- **Text**: Plain text strings (default)
- **Number**: Numeric values (integers and decimals)
- **Boolean**: TRUE/FALSE values
- **Date**: ISO format dates (YYYY-MM-DD)

### Extended Types
- **DateTime**: ISO datetime format (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS)
- **Time**: Time values (HH:MM or HH:MM:SS, with optional AM/PM)
- **Duration**: Time duration (HH:MM:SS or MM:SS)
- **Percentage**: Values with % symbol (e.g., 25%)
- **Currency**: Values with currency symbols ($, €, £, ¥, ₹)
- **Email**: Email addresses (basic pattern matching)
- **Phone**: Phone numbers (various formats)
- **URI**: Web URLs (http://, https://, ftp://)
- **GUID**: UUID/GUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

## Automatic Inference

The system automatically infers the datatype when you enter data into a cell:

### Detection Patterns

1. **GUID/UUID**: `550e8400-e29b-41d4-a716-446655440000`
2. **Email**: `user@example.com`
3. **URI**: `https://example.com`
4. **Phone**: `+1-234-567-8900`, `(123) 456-7890`, `123-456-7890`
5. **Percentage**: `25%`, `0.5%`
6. **Currency**: `$100`, `€50.25`, `£75.50`
7. **Duration**: `1:30:45`, `2:15`, `00:45:30`
8. **Time**: `14:30`, `2:30 PM`, `14:30:45`
9. **DateTime**: `2024-01-15T14:30:00`, `2024-01-15 14:30:00`
10. **Date**: `2024-01-15`
11. **Boolean**: `true`, `false` (case-insensitive)
12. **Number**: Any numeric value
13. **Text**: Everything else

## Manual Datatype Override

### Using the Toolbar Dropdown

1. **Select a cell** or range of cells
2. **Click the datatype dropdown** in the toolbar (shows current datatype)
3. **Choose a new datatype** from the list
4. The cell's datatype is updated immediately

The dropdown displays user-friendly names:
- Text
- Number
- Date
- Date & Time
- Time
- Boolean
- Percentage
- Currency
- Duration
- Email
- Phone
- URI
- GUID

## Value Formatting

Each datatype has specific formatting rules for display:

- **Date**: Localized date format (e.g., "1/15/2024")
- **DateTime**: Localized datetime format (e.g., "1/15/2024, 2:30:00 PM")
- **Boolean**: "TRUE" or "FALSE"
- **Percentage**: Number with % symbol (e.g., "25%")
- **Currency**: Dollar sign with 2 decimal places (e.g., "$100.00")
- **Others**: Display as-is

## Implementation Details

### Files Created

1. **`/excel-grid/src/utils/dataTypeInference.ts`**
   - `inferCellValue()`: Automatically detects datatype from string input
   - `formatCellValue()`: Formats cell value for display based on type
   - `convertToType()`: Converts value to specific datatype
   - `getCellTypeDisplayName()`: Returns user-friendly type names

### Files Modified

2. **`/excel-grid/src/types/cell.ts`**
   - Extended `CellType` to include all new datatypes

3. **`/excel-grid/src/components/ExcelGrid.tsx`**
   - Added `getSelectedCellType()`: Returns current cell's datatype
   - Added `setCellType()`: Changes datatype of selected cells
   - Integrated new inference and formatting utilities
   - Removed old inference logic in favor of centralized utility

4. **`/excel-grid/src/components/Toolbar.tsx`**
   - Added datatype dropdown with all supported types
   - Added `onCellTypeChange` callback prop
   - Added `currentCellType` prop to display current selection
   - Positioned between clipboard operations and font controls

5. **`/excel-grid/src/App.tsx`**
   - Added state management for current cell type
   - Added `handleCellTypeChange()` to update cell datatypes
   - Updates cell type when selection changes
   - Passes cell type props to Toolbar

6. **`/excel-grid/src/utils/csvImport.ts`**
   - Updated to use centralized `inferCellValue()` utility
   - Removed duplicate inference logic

## Usage Examples

### Automatic Detection
```
Enter "john@example.com" → Detected as Email
Enter "2024-01-15" → Detected as Date
Enter "$99.99" → Detected as Currency
Enter "25%" → Detected as Percentage
Enter "https://example.com" → Detected as URI
```

### Manual Override
1. Enter "123456" (detected as Number)
2. Select the cell
3. Open datatype dropdown
4. Choose "Phone"
5. Cell is now treated as Phone datatype

### Bulk Type Change
1. Select multiple cells (e.g., a column of numbers)
2. Choose "Currency" from datatype dropdown
3. All selected cells are converted to Currency type

## Benefits

- **Smart Detection**: Automatically recognizes common data patterns
- **Flexibility**: Manual override for edge cases
- **Consistency**: Centralized inference logic used everywhere
- **Extensibility**: Easy to add new datatypes
- **User-Friendly**: Clear dropdown with readable type names
- **Real-time Updates**: Datatype shown in toolbar updates with selection
- **Bulk Operations**: Change datatype for multiple cells at once
