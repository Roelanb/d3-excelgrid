# Multi-Column/Row Resize Feature

## Overview
When multiple columns or rows are selected, resizing any of the selected columns/rows will resize all of them simultaneously to the same width/height.

## How It Works

### For Columns:
1. **Select multiple columns** by:
   - Click on a column header to select it
   - Hold **Shift** and click another column header to select a range
   - Hold **Ctrl/Cmd** and click column headers to add individual columns to the selection

2. **Resize all selected columns**:
   - Hover over the right edge of any selected column header until the cursor changes to a resize cursor (↔)
   - Click and drag to resize
   - All selected columns will resize to the same width simultaneously

### For Rows:
1. **Select multiple rows** by:
   - Click on a row header to select it
   - Hold **Shift** and click another row header to select a range
   - Hold **Ctrl/Cmd** and click row headers to add individual rows to the selection

2. **Resize all selected rows**:
   - Hover over the bottom edge of any selected row header until the cursor changes to a resize cursor (↕)
   - Click and drag to resize
   - All selected rows will resize to the same height simultaneously

## Implementation Details

### State Changes
- The `resizing` state now includes an `affectedIndices` array that tracks all columns/rows that should be resized together
- When a resize handle is clicked, the code checks if:
  1. The selection type matches (column selection for column resize, row selection for row resize)
  2. The clicked column/row is within the current selection
  3. If both conditions are met, all selected columns/rows are added to `affectedIndices`

### Resize Logic
- During mouse move, the resize delta is calculated and applied to all indices in `affectedIndices`
- All affected columns/rows are set to the same width/height
- The minimum width is 30px for columns and minimum height is 20px for rows

## Example Usage
```typescript
// Select columns B, C, and D (indices 1, 2, 3)
// Click on column B header, then Shift+click on column D header
// Drag the resize handle on any of these columns
// All three columns will resize to the same width
```

## Benefits
- Consistent column/row sizing across selections
- Faster grid formatting
- Intuitive Excel-like behavior
- Works with both contiguous and non-contiguous selections
