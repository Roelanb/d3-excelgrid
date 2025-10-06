# Toolbar Implementation Plan for Excel Grid

## Overview
Add a flexible, removable toolbar with formatting capabilities for the Excel Grid component. The toolbar will support text formatting, colors, and cell styling operations.

## Architecture

### 1. Data Model Extensions
**File: `src/types/cell.ts`**
- Extend `Cell` interface to include formatting properties:
  - `fontFamily?: string` - Font selection
  - `fontSize?: number` - Text size
  - `bold?: boolean` - Bold formatting
  - `italic?: boolean` - Italic formatting
  - `underline?: boolean` - Underline formatting
  - `textColor?: string` - Text color (hex)
  - `fillColor?: string` - Cell background color (hex)
  - `borderStyle?: BorderStyle` - Cell border configuration

- Add `BorderStyle` type:
  ```typescript
  type BorderStyle = {
    top?: { width: number; color: string; style: 'solid' | 'dashed' | 'dotted' };
    right?: { width: number; color: string; style: 'solid' | 'dashed' | 'dotted' };
    bottom?: { width: number; color: string; style: 'solid' | 'dashed' | 'dotted' };
    left?: { width: number; color: string; style: 'solid' | 'dashed' | 'dotted' };
  }
  ```

### 2. Toolbar Component
**File: `src/components/Toolbar.tsx`**

Create a new toolbar component with the following features:

#### Toolbar Structure
- Positioned above the grid
- Collapsible/removable (toggle button)
- Grouped buttons with dividers
- Disabled state when no cells are selected

#### Button Groups

**Group 1: Clipboard Operations**
- Cut button (scissors icon)
- Copy button (copy icon)
- Paste button (paste icon)

**Group 2: Font Formatting**
- Font family dropdown (common fonts: Arial, Times New Roman, Courier New, Verdana, etc.)
- Font size selector (8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36)

**Group 3: Text Style**
- Bold toggle button (B)
- Italic toggle button (I)
- Underline toggle button (U)

**Group 4: Colors**
- Text color picker (with color swatch preview)
- Fill color picker (with color swatch preview)

**Group 5: Borders**
- Border style dropdown with options:
  - All borders
  - Outer borders
  - Top border
  - Bottom border
  - Left border
  - Right border
  - No borders
- Border style selector (solid, dashed, dotted)
- Border color picker

#### Implementation Details
- Use Material-UI components: `AppBar`, `Toolbar`, `IconButton`, `Select`, `Divider`
- Use Material-UI icons from `@mui/icons-material`
- Color pickers: Use `react-color` or Material-UI's color picker
- Store toolbar visibility state in localStorage

### 3. Clipboard Manager
**File: `src/utils/clipboard.ts`**

Create utility functions for clipboard operations:
- `copyCells(cells: Cell[]): void` - Copy selected cells to clipboard
- `cutCells(cells: Cell[]): void` - Cut selected cells (copy + mark for deletion)
- `pasteCells(targetRow: number, targetCol: number, clipboardData: ClipboardData): void`
- Store clipboard data in component state with formatting

### 4. ExcelGrid Component Updates
**File: `src/components/ExcelGrid.tsx`**

#### State Management
- Add `clipboardData` state for cut/copy/paste operations
- Add `toolbarVisible` state (default: true)

#### Rendering Updates
- Apply cell formatting when rendering cells:
  - Font family and size to text elements
  - Bold/italic/underline via SVG text attributes
  - Text color via `fill` attribute
  - Fill color via rect `fill` attribute
  - Borders via additional rect elements with stroke properties

#### API Extensions
Add new methods to `ExcelGridHandle`:
- `formatCells(range: SelectionRange, formatting: CellFormatting): void`
- `copyCells(): void`
- `cutCells(): void`
- `pasteCells(): void`
- `toggleToolbar(): void`

#### Cell Rendering Enhancement
Update cell rendering logic to:
1. Check for cell formatting properties
2. Apply SVG attributes for text styling
3. Render border elements if border styles exist
4. Use formatted colors for text and background

### 5. App Component Updates
**File: `src/App.tsx`**

- Import and render `Toolbar` component above `ExcelGrid`
- Pass necessary props and callbacks to toolbar
- Handle toolbar actions (formatting, clipboard operations)

## Implementation Steps

### Phase 1: Data Model (1-2 hours)
1. ✅ Extend `Cell` interface with formatting properties
2. ✅ Add `BorderStyle` type definition
3. ✅ Update type exports

### Phase 2: Toolbar UI (2-3 hours)
1. ✅ Create `Toolbar.tsx` component skeleton
2. ✅ Implement button groups with Material-UI
3. ✅ Add icons and styling
4. ✅ Implement collapse/expand functionality
5. ✅ Add disabled states based on selection

### Phase 3: Clipboard Operations (2-3 hours)
1. ✅ Create clipboard utility functions
2. ✅ Implement copy functionality
3. ✅ Implement cut functionality
4. ✅ Implement paste functionality
5. ✅ Handle keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)

### Phase 4: Cell Formatting (3-4 hours)
1. ✅ Update cell rendering to apply font formatting
2. ✅ Implement text color and fill color rendering
3. ✅ Implement border rendering
4. ✅ Add formatting methods to ExcelGrid API
5. ✅ Connect toolbar actions to formatting methods

### Phase 5: Integration & Testing (2-3 hours)
1. ✅ Integrate toolbar with App component
2. ✅ Test all formatting operations
3. ✅ Test clipboard operations
4. ✅ Test toolbar collapse/expand
5. ✅ Test with multiple cell selections
6. ✅ Handle edge cases

### Phase 6: Polish & Optimization (1-2 hours)
1. ✅ Add tooltips to toolbar buttons
2. ✅ Improve color picker UX
3. ✅ Add keyboard shortcuts hints
4. ✅ Optimize rendering performance
5. ✅ Add localStorage persistence for toolbar state

## Technical Considerations

### Performance
- Only re-render cells when formatting changes
- Use memoization for formatted cell rendering
- Batch formatting operations for multiple cells

### Browser Compatibility
- Use standard clipboard API with fallbacks
- Test color pickers across browsers
- Ensure SVG rendering works consistently

### User Experience
- Show visual feedback for clipboard operations
- Disable unavailable operations (e.g., paste when clipboard empty)
- Preserve formatting when copying/pasting
- Support undo/redo for formatting operations (future enhancement)

## Dependencies to Add
```json
{
  "@mui/icons-material": "^5.x.x",
  "react-color": "^2.19.3" (or use native color input)
}
```

## Testing Checklist
- [ ] Font family changes apply correctly
- [ ] Font size changes apply correctly
- [ ] Bold/italic/underline toggle correctly
- [ ] Text color picker works
- [ ] Fill color picker works
- [ ] Border styles apply correctly
- [ ] Copy preserves formatting
- [ ] Cut removes cells after paste
- [ ] Paste applies formatting
- [ ] Toolbar collapse/expand works
- [ ] Multiple cell selection formatting works
- [ ] Keyboard shortcuts work
- [ ] Toolbar state persists across sessions

## Future Enhancements
- Undo/redo functionality
- Format painter tool
- Cell merge/split
- Conditional formatting
- Custom border thickness
- More font options
- Text alignment (left, center, right)
- Number formatting (currency, percentage, etc.)
