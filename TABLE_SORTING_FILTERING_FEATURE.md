# Table Sorting and Filtering Feature

## Overview
This feature adds sorting and filtering capabilities to CSV-imported tables. When a CSV is imported with table styling enabled, the header row becomes interactive with sorting functionality.

## Implementation Status

### ✅ Completed
1. **Table Metadata System**
   - Added `TableMetadata` type to track table regions
   - Stores start/end rows/columns, header row, sort state
   - CSV import returns table metadata when styling is applied

2. **Sorting Functionality**
   - Click table header cells to sort ascending/descending/none
   - Visual indicators (▲/▼) show current sort direction
   - Supports sorting by text, numbers, dates
   - Three-state sort: ascending → descending → no sort

3. **Visual Indicators**
   - Sort arrows appear in header cells when column is sorted
   - Pointer cursor on header cells to indicate clickability
   - Blue arrow color matches table theme

4. **Integration**
   - CSV import passes table metadata to grid
   - ExcelGrid manages table state with `tables` Map
   - Header cells detect clicks and trigger sorting

4. **Filtering Functionality** ✅
   - Right-click header cells to open filter dialog
   - Filter icon (🔽) shows when column has active filter
   - Select/deselect values to show/hide rows
   - Multiple filters can be active simultaneously
   - Rows hidden via CSS display:none for performance

## Files Modified

1. **`/excel-grid/src/types/cell.ts`**
   - Added `SortDirection` type
   - Added `TableMetadata` interface

2. **`/excel-grid/src/utils/csvImport.ts`**
   - Updated `CSVImportResult` to include `tableMetadata`
   - Returns table region info when `applyTableStyle` is true

3. **`/excel-grid/src/components/ExcelGrid.tsx`**
   - Added `tables` state to manage table metadata
   - Added `isTableHeader()` helper function
   - Added `sortTable()` function for column sorting
   - Updated cell rendering to show sort indicators
   - Modified `handleCellClick` to detect header clicks
   - Updated `importCells` to accept and store table metadata

4. **`/excel-grid/src/components/CSVImportDialog.tsx`**
   - Updated to pass `tableMetadata` to `onImport` callback

5. **`/excel-grid/src/App.tsx`**
   - Updated `handleCSVImport` to accept and pass table metadata

6. **`/excel-grid/src/components/TableFilterDialog.tsx`** (NEW)
   - Material-UI dialog for filter value selection
   - Search functionality to find values
   - Select All / Clear All buttons
   - Shows count of selected values
   - Clear Filter option to remove filter

## How It Works

### Sorting
1. User imports CSV with "Apply table styling" enabled
2. Table metadata is created and stored
3. Clicking a header cell triggers `sortTable()`
4. Data rows are sorted based on column values
5. Grid is updated with sorted data
6. Sort arrow appears in header

### Sort Algorithm
- Compares values by type (string, number, date)
- Uses `localeCompare` for strings
- Numeric comparison for numbers
- Timestamp comparison for dates
- Ascending/descending/none cycle

### Filtering
1. User right-clicks on a header cell
2. Filter dialog opens with all unique values
3. User selects/deselects values
4. Clicks "Apply"
5. Rows are hidden/shown based on filter
6. Filter icon (🔽) appears in header
7. Multiple columns can be filtered independently

### Combined Sorting & Filtering
- Filters are applied first, then sorting
- Both icons can appear in same header
- Sorting only affects visible (filtered) rows

## Usage Examples

### Sorting
1. Import CSV with table styling enabled
2. Click on "Name" header → sorts A-Z
3. Click again → sorts Z-A
4. Click again → removes sort

### Filtering
1. Right-click on "City" header
2. Uncheck "New York" and "Chicago"
3. Click "Apply"
4. Only rows with other cities are visible
5. Filter icon (🔽) appears in header

### Combined
1. Filter "City" to show only "New York"
2. Click "Salary" header to sort by salary
3. See New York employees sorted by salary
