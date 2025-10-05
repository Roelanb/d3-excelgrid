# Toolbar Feature Documentation

## Overview
The Excel Grid now includes a comprehensive formatting toolbar with clipboard operations, text formatting, colors, and border styling capabilities.

## Features Implemented

### 1. Clipboard Operations
- **Cut (Ctrl+X)**: Cut selected cells to clipboard
- **Copy (Ctrl+C)**: Copy selected cells to clipboard
- **Paste (Ctrl+V)**: Paste cells from clipboard
- Preserves cell formatting when copying/pasting
- Cut operation removes cells after pasting

### 2. Font Formatting
- **Font Family**: Choose from 9 common fonts (Arial, Times New Roman, Courier New, etc.)
- **Font Size**: Select from sizes 8-36px
- **Bold**: Toggle bold text
- **Italic**: Toggle italic text
- **Underline**: Toggle underlined text

### 3. Colors
- **Text Color**: Choose text color using native color picker
- **Fill Color**: Choose cell background color using native color picker

### 4. Borders
- **All Borders**: Apply borders to all sides
- **Outer Borders**: Apply borders to outer edges only
- **Individual Borders**: Apply to top, bottom, left, or right
- **Clear Borders**: Remove all borders
- Border style: solid, dashed, or dotted (default: solid)

### 5. Toolbar Controls
- **Collapsible**: Click the expand/collapse button to hide/show toolbar
- **Disabled States**: Buttons are disabled when no cells are selected
- **Tooltips**: Hover over buttons for helpful descriptions

## Technical Implementation

### Data Model
Extended `Cell` interface with `formatting` property:
```typescript
interface CellFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  fillColor?: string;
  borderStyle?: BorderStyle;
}
```

### Components
1. **Toolbar.tsx**: Main toolbar component with all formatting controls
2. **ExcelGrid.tsx**: Updated to support formatting and clipboard operations
3. **clipboard.ts**: Utility functions for clipboard management

### API Methods
New methods added to `ExcelGridHandle`:
- `formatCells(formatting: Partial<CellFormatting>)`: Apply formatting to selected cells
- `copyCells()`: Copy selected cells to clipboard
- `cutCells()`: Cut selected cells to clipboard
- `pasteCells()`: Paste cells from clipboard
- `getSelectedFormatting()`: Get formatting of currently selected cell

### Keyboard Shortcuts
- **Ctrl+C**: Copy
- **Ctrl+X**: Cut
- **Ctrl+V**: Paste

## Usage Example

```typescript
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import { Toolbar } from './components/Toolbar';
import type { CellFormatting } from './types/cell';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentFormatting, setCurrentFormatting] = useState<CellFormatting | undefined>();
  const [hasClipboard, setHasClipboard] = useState(false);

  const handleFormat = (formatting: Partial<CellFormatting>) => {
    gridRef.current?.formatCells(formatting);
  };

  return (
    <>
      <Toolbar
        onCut={() => gridRef.current?.cutCells()}
        onCopy={() => gridRef.current?.copyCells()}
        onPaste={() => gridRef.current?.pasteCells()}
        onFormat={handleFormat}
        currentFormatting={currentFormatting}
        disabled={!hasSelection}
        pasteDisabled={!hasClipboard}
      />
      <ExcelGrid
        ref={gridRef}
        onSelectionChange={(hasSelection, formatting) => {
          setHasSelection(hasSelection);
          setCurrentFormatting(formatting);
        }}
        onClipboardChange={setHasClipboard}
      />
    </>
  );
}
```

## Cell Rendering

Cells are rendered with SVG elements that support:
- Custom font families and sizes
- Bold, italic, and underline text styling
- Text and fill colors
- Border lines with customizable width, color, and style (solid/dashed/dotted)

## Performance Considerations

- Formatting is applied only to visible cells in the viewport
- Uses memoization for efficient re-rendering
- Batch operations for multiple cell selections
- Optimized SVG rendering with D3.js

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Native HTML5 color input for color pickers
- SVG text styling for formatting
- Standard clipboard API with keyboard shortcuts

## Future Enhancements

Potential improvements for future versions:
- Undo/redo functionality
- Format painter tool
- Cell merge/split
- Conditional formatting
- Custom border thickness selector
- Text alignment (left, center, right)
- Number formatting (currency, percentage, etc.)
- Cell styles presets
- Import/export with formatting

## Testing

To test the toolbar feature:
1. Run `pnpm install` to install dependencies
2. Run `pnpm dev` to start the development server
3. Select cells and use toolbar buttons to apply formatting
4. Test keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
5. Test with single cells, ranges, rows, and columns
6. Verify formatting persists when copying/pasting

## Dependencies

- `@mui/material`: ^7.3.2
- `@mui/icons-material`: ^7.3.2
- `d3`: ^7.9.0
- `react`: ^19.1.1
