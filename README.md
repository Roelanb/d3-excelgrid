# D3 Excel Grid

A high-performance, feature-rich Excel-like grid component built with React, TypeScript, D3.js, and Material-UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.1.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)
![D3.js](https://img.shields.io/badge/D3.js-7.9.0-orange.svg)

## 🌟 Features

### Core Grid Functionality
- ✅ **Large Grid Support**: Handle 1000+ rows and 500+ columns efficiently
- ✅ **Virtual Scrolling**: Viewport-based rendering for optimal performance
- ✅ **Cell Editing**: Double-click to edit, supports multiple data types
- ✅ **Data Types**: Text, numbers, dates (YYYY-MM-DD), booleans
- ✅ **Cell Selection**: Single cell, range, row, and column selection
- ✅ **Multi-Selection**: Ctrl+Click and Shift+Click support
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Escape, Tab
- ✅ **Resizable Columns/Rows**: Drag to resize with visual feedback
- ✅ **Multi-Resize**: Resize multiple selected columns/rows simultaneously

### Formatting Toolbar
- ✅ **Font Formatting**: Family selection, size (8-36px), bold, italic, underline
- ✅ **Text Alignment**: Left, center, right alignment
- ✅ **Colors**: Text color and cell fill color pickers
- ✅ **Borders**: All borders, outer, individual sides, custom styles
- ✅ **Clipboard Operations**: Cut, copy, paste with formatting preservation
- ✅ **Keyboard Shortcuts**: Ctrl+C/X/V for clipboard operations
- ✅ **Collapsible Toolbar**: Save screen space when not needed

### CSV Import
- ✅ **File Import**: Browse and select CSV files
- ✅ **Auto-Detection**: Automatic delimiter detection
- ✅ **Flexible Options**: Configure delimiter, headers, position, trimming
- ✅ **Preview**: View first 5 lines before importing
- ✅ **Type Inference**: Automatic detection of numbers, dates, booleans
- ✅ **Progress Indicator**: Loading bar with status messages
- ✅ **Auto Grid Expansion**: Grid automatically resizes for large files
- ✅ **Notifications**: Success messages and expansion alerts

### Performance
- ✅ **Optimized Rendering**: Only visible cells rendered
- ✅ **Efficient Updates**: Minimal re-renders with React hooks
- ✅ **SVG Graphics**: Hardware-accelerated D3.js rendering
- ✅ **Sparse Data Structure**: Memory-efficient cell storage
- ✅ **Smooth Scrolling**: Throttled scroll events with RAF

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ or pnpm
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/Roelanb/d3-excelgrid.git
cd d3-excelgrid/excel-grid

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
pnpm build
```

## 📖 Usage

### Basic Grid

```tsx
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import { useRef } from 'react';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);

  return (
    <ExcelGrid
      ref={gridRef}
      initialRows={1000}
      initialCols={500}
      cellWidth={100}
      cellHeight={30}
    />
  );
}
```

### With Toolbar

```tsx
import { ExcelGrid, type ExcelGridHandle } from './components/ExcelGrid';
import { Toolbar } from './components/Toolbar';
import { useState, useRef } from 'react';

function App() {
  const gridRef = useRef<ExcelGridHandle>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentFormatting, setCurrentFormatting] = useState();
  const [hasClipboard, setHasClipboard] = useState(false);

  return (
    <>
      <Toolbar
        onCut={() => gridRef.current?.cutCells()}
        onCopy={() => gridRef.current?.copyCells()}
        onPaste={() => gridRef.current?.pasteCells()}
        onFormat={(formatting) => gridRef.current?.formatCells(formatting)}
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

### CSV Import

```tsx
import { CSVImportDialog } from './components/CSVImportDialog';

function App() {
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const handleCSVImport = (cells, rowCount, colCount) => {
    gridRef.current?.importCells(cells);
  };

  return (
    <>
      <Button onClick={() => setCsvDialogOpen(true)}>
        Import CSV
      </Button>
      <CSVImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleCSVImport}
      />
    </>
  );
}
```

## 🎨 API Reference

### ExcelGrid Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialRows` | `number` | `500` | Initial number of rows |
| `initialCols` | `number` | `260` | Initial number of columns |
| `cellWidth` | `number` | `100` | Default cell width in pixels |
| `cellHeight` | `number` | `30` | Default cell height in pixels |
| `headerWidth` | `number` | `50` | Row header width in pixels |
| `headerHeight` | `number` | `30` | Column header height in pixels |
| `onSelectionChange` | `function` | - | Callback when selection changes |
| `onClipboardChange` | `function` | - | Callback when clipboard state changes |

### ExcelGrid Methods

```typescript
interface ExcelGridHandle {
  // Data manipulation
  clearGrid(): void;
  setCellValue(row: number, col: number, value: string): void;
  setCellRange(startRow: number, startCol: number, endRow: number, endCol: number, value: string): void;
  
  // Formatting
  formatCells(formatting: Partial<CellFormatting>): void;
  getSelectedFormatting(): CellFormatting | undefined;
  
  // Clipboard
  copyCells(): void;
  cutCells(): void;
  pasteCells(): void;
  
  // Import
  importCells(cells: Map<string, Cell>, autoExpand?: boolean): void;
}
```

### Cell Formatting Options

```typescript
interface CellFormatting {
  fontFamily?: string;        // Font family name
  fontSize?: number;          // Font size in pixels
  bold?: boolean;             // Bold text
  italic?: boolean;           // Italic text
  underline?: boolean;        // Underlined text
  textAlign?: 'left' | 'center' | 'right';  // Text alignment
  textColor?: string;         // Text color (hex)
  fillColor?: string;         // Background color (hex)
  borderStyle?: BorderStyle;  // Border configuration
}
```

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy selected cells |
| `Ctrl+X` | Cut selected cells |
| `Ctrl+V` | Paste cells |
| `Enter` | Edit cell / Move down |
| `Escape` | Cancel edit |
| `Tab` | Move to next cell |
| `Arrow Keys` | Navigate cells |
| `Shift+Click` | Extend selection |
| `Ctrl+Click` | Add to selection |

## 📁 Project Structure

```
d3-excelgrid/
├── excel-grid/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ExcelGrid.tsx       # Main grid component
│   │   │   ├── Toolbar.tsx         # Formatting toolbar
│   │   │   └── CSVImportDialog.tsx # CSV import dialog
│   │   ├── types/
│   │   │   └── cell.ts             # Type definitions
│   │   ├── utils/
│   │   │   ├── clipboard.ts        # Clipboard utilities
│   │   │   └── csvImport.ts        # CSV parsing utilities
│   │   ├── App.tsx                 # Main application
│   │   └── main.tsx                # Entry point
│   ├── package.json
│   └── vite.config.ts
├── sample-data.csv                 # Sample CSV file
├── README.md                       # This file
└── .gitignore
```

## 🛠️ Technologies

- **React 19.1.1**: UI framework
- **TypeScript 5.8.3**: Type safety
- **D3.js 7.9.0**: SVG rendering and data visualization
- **Material-UI 7.3.2**: UI components and styling
- **Vite 7.1.7**: Build tool and dev server
- **pnpm**: Package manager

## 📊 Performance Metrics

- **Grid Size**: Up to 1,000,000 cells (1000×1000)
- **Rendering**: Only visible cells (~50-100 cells)
- **Memory**: Sparse storage, ~1KB per cell with data
- **Scroll Performance**: 60 FPS with throttling
- **Initial Load**: < 100ms for empty grid
- **CSV Import**: ~1-2 seconds for 1000 rows

## 🧪 Testing

### Sample Data
A sample CSV file with 10 rows is included: `sample-data.csv`

### Test Scenarios
1. Import small CSV (< 100 rows)
2. Import large CSV (1000+ rows)
3. Apply formatting to multiple cells
4. Copy/paste with formatting
5. Resize multiple columns/rows
6. Test keyboard navigation
7. Test selection modes

## 📝 Documentation

Detailed documentation is available in the repository:

- [Toolbar Feature](./TOOLBAR_FEATURE.md) - Complete toolbar documentation
- [CSV Import](./CSV_IMPORT_FEATURE.md) - CSV import guide
- [Loading Indicator](./CSV_LOADING_INDICATOR.md) - Progress indicator details
- [Auto Grid Expansion](./AUTO_GRID_EXPANSION.md) - Grid expansion feature
- [Multi-Resize Feature](./MULTI_RESIZE_FEATURE.md) - Multi-resize documentation
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Overall summary

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for type safety
- Follow React hooks best practices
- Use Material-UI components for consistency
- Write descriptive commit messages
- Add comments for complex logic

## 🐛 Known Issues

- Large files (>10MB) may take time to parse
- Very wide grids (>1000 columns) may impact performance
- Border rendering may overlap in some cases

## 🔮 Roadmap

### Planned Features
- [ ] Undo/Redo functionality
- [ ] Cell formulas and calculations
- [ ] Export to CSV/Excel
- [ ] Cell merge/split
- [ ] Conditional formatting
- [ ] Sorting and filtering
- [ ] Search and replace
- [ ] Cell comments
- [ ] Data validation
- [ ] Freeze panes
- [ ] Print support
- [ ] Themes and customization

### Performance Improvements
- [ ] Web Workers for CSV parsing
- [ ] Virtual scrolling optimization
- [ ] Lazy loading for large files
- [ ] Memory optimization
- [ ] Batch operations

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **Roelan** - Initial work - [Roelanb](https://github.com/Roelanb)

## 🙏 Acknowledgments

- D3.js team for the excellent visualization library
- Material-UI team for the component library
- React team for the framework
- All contributors and users

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review sample code in the repository

## 🔗 Links

- [GitHub Repository](https://github.com/Roelanb/d3-excelgrid)
- [Issue Tracker](https://github.com/Roelanb/d3-excelgrid/issues)
- [D3.js Documentation](https://d3js.org/)
- [Material-UI Documentation](https://mui.com/)
- [React Documentation](https://react.dev/)

---

**Built with ❤️ using React, TypeScript, and D3.js**
