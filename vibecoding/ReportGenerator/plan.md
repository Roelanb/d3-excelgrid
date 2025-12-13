# Report Generator API Implementation Plan

## Progress Summary

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ COMPLETED | Project Setup and Structure |
| Phase 2 | ✅ COMPLETED | Model Definitions |
| Phase 3 | ✅ COMPLETED | Core Services |
| Phase 4 | ✅ COMPLETED | PDF Generation Service (Basic) |
| Phase 5 | ✅ COMPLETED | API Endpoint |
| Phase 6 | 🔄 IN PROGRESS | Testing and Integration |

**Last Updated:** 2025-12-13

### What Works
- POST `/api/generate` endpoint accepts report JSON and returns valid PDF
- Text rendering with fonts, colors, alignment
- Barcode generation (QR, Code128, PDF417, DataMatrix, etc.)
- Table rendering with headers and data rows
- Parameter substitution using `{{paramName}}` syntax
- Data binding with data regions
- Basic shapes (line, rectangle, ellipse)

### TODO (Future Enhancements)
- Rotation and opacity for objects
- Polygon and polyline shapes
- Multi-page support with page breaks
- Header/footer on every page
- Frontend integration testing

---

## Overview
Create a C# .NET 9 REST API that generates PDF reports from report definitions created by the ReportMaker frontend. The API receives a report structure (JSON), input data, and output configuration, then generates a PDF document.

## API Specification

### Endpoint
```
POST /api/generate
```

### Request Body
```json
{
    "report": {
        "reportObjects": [...],
        "canvasSettings": {...},
        "parameters": [...]
    },
    "data": {
        "dataRegionId1": [...records...],
        "dataRegionId2": [...records...]
    },
    "output": {
        "format": "pdf",
        "filename": "report.pdf"
    }
}
```

### Response
- Success: Returns PDF file as binary stream with appropriate content-type
- Error: Returns JSON with error details

---

## Phase 1: Project Setup and Structure ✅ COMPLETED

### Task 1.1: Create .NET 9 Web API Project
- [x] Create new folder `/reportgenerator`
- [x] Initialize .NET 9 Web API project
- [x] Add required NuGet packages:
  - `FastEndpoints` - For endpoint routing
  - `FastEndpoints.Swagger` - API documentation
  - `QuestPDF` - PDF generation library (open source, feature-rich)
  - `ZXing.Net` - Barcode generation
  - `SkiaSharp` - Image processing (dependency for QuestPDF)
  - `System.Text.Json` - JSON serialization

### Task 1.2: Project Structure
- [x] Created project structure:
```
reportgenerator/
├── Program.cs
├── appsettings.json
├── Models/
│   ├── GenerateRequest.cs
│   ├── ReportObject.cs
│   ├── CanvasSettings.cs
│   └── ReportParameter.cs
├── Endpoints/
│   └── GenerateEndpoint.cs
├── Services/
│   ├── PdfGeneratorService.cs
│   ├── ParameterSubstitutionService.cs
│   ├── BarcodeService.cs
│   ├── ImageService.cs
│   └── SkiaSharpHelpers.cs
├── Tests/
│   └── generate.http
└── ReportGenerator.csproj
```

---

## Phase 2: Model Definitions ✅ COMPLETED

### Task 2.1: Create Request/Response Models
- [x] `GenerateRequest.cs` - Main request wrapper with Report, Data, Output properties
- [x] `OutputOptions.cs` - Output format configuration (integrated in GenerateRequest.cs)

### Task 2.2: Create Report Definition Models
Mirror TypeScript types from reportmaker:
- [x] `ReportObjectType.cs` - Enum for object types (text, image, barcode, table, line, rectangle, ellipse, dataRegion, header, footer)
- [x] `ReportObject.cs` - Main report object with Id, Type, X, Y, Width, Height, Properties
- [x] `ReportObjectProperties.cs` - All property options (integrated in ReportObject.cs)
- [x] `DataSource.cs` - Data source configuration (integrated in ReportObject.cs)
- [x] `DataBinding.cs` - Column binding info (integrated in ReportObject.cs)

### Task 2.3: Create Canvas/Page Models
- [x] `CanvasSettings.cs` - Canvas configuration
- [x] `PageSettings.cs` - Page dimensions and margins (integrated in CanvasSettings.cs)
- [x] `PageMargins.cs` - Margin values (integrated in CanvasSettings.cs)

### Task 2.4: Create Parameter Models
- [x] `ReportParameterType.cs` - Enum for parameter types (string, integer, float, date, time, datetime, daterange, boolean, list-string, list-number, email)
- [x] `ReportParameter.cs` - Parameter definition with Id, Name, Type, Value, DefaultValue, Required
- [x] `DateRangeValue.cs` - Date range value type (integrated in ReportParameter.cs)

---

## Phase 3: Core Services ✅ COMPLETED

### Task 3.1: Parameter Substitution Service
- [x] Create `ParameterSubstitutionService.cs`
- [x] Implement `{{parameterName}}` pattern matching using Regex
- [x] Handle all parameter types:
  - String, Integer, Float
  - Date, Time, DateTime, DateRange
  - Boolean
  - List (string/number)
  - Email
- [x] Format values appropriately for display

### Task 3.2: Barcode Service
- [x] Create `BarcodeService.cs`
- [x] Support barcode types:
  - QR Code
  - Code128
  - PDF417
  - DataMatrix
  - Code39, EAN13, EAN8, UPCA
- [x] Generate barcode images as PNG byte arrays
- [x] Handle text substitution in barcode content

### Task 3.3: Image Service
- [x] Create `ImageService.cs`
- [x] Handle base64 data URLs (data:image/...)
- [x] Handle HTTP/HTTPS image URLs (fetch with HttpClient)
- [x] Convert to byte array for PDF embedding

---

## Phase 4: PDF Generation Service ✅ COMPLETED (Basic Implementation)

### Task 4.1: Create PDF Generator Service Structure
- [x] Create `PdfGeneratorService.cs`
- [x] Create `SkiaSharpHelpers.cs` for QuestPDF/SkiaSharp integration
- [x] Setup QuestPDF document configuration with SVG canvas
- [x] Handle page size and orientation
- [x] Handle page margins

### Task 4.2: Implement Text Object Rendering
- [x] Render text with font properties:
  - Font family (Arial, Courier, Times)
  - Font size
  - Bold, italic
  - Color
  - Text alignment (left, center, right)
- [x] Handle background color
- [x] Handle border
- [ ] Handle rotation (TODO)
- [ ] Handle opacity (TODO)
- [x] Apply parameter substitution
- [x] Apply data binding

### Task 4.3: Implement Image Object Rendering
- [x] Load image from data URL
- [x] Load image from HTTP URL
- [x] Render at specified position and size
- [ ] Handle rotation (TODO)
- [ ] Handle opacity (TODO)

### Task 4.4: Implement Barcode Object Rendering
- [x] Generate barcode image using ZXing.Net
- [x] Apply parameter substitution to content
- [x] Apply data binding to content
- [x] Render at specified position and size
- [x] Handle include text option

### Task 4.5: Implement Table Object Rendering
- [x] Render table header row
  - Background color (#f3f4f6)
  - Border
  - Bold text
- [x] Render data rows
  - Cell backgrounds
  - Cell borders
- [x] Handle column widths (auto-calculated)
- [x] Limit rows to fit height
- [x] Get data from parent data region

### Task 4.6: Implement Shape Object Rendering
- [x] Line
- [x] Rectangle
- [x] Ellipse (using SkiaSharp DrawOval)
- [ ] Polygon (from points) - TODO
- [ ] Polyline (from points) - TODO
- [x] Handle stroke color and width
- [x] Handle fill color
- [ ] Handle opacity - TODO

### Task 4.7: Implement Data Region Logic
- [x] Identify data regions by type
- [x] Associate data with regions by ID
- [x] Find child objects within regions (by center point)
- [x] Pass data to child objects for binding

### Task 4.8: Implement Header/Footer Rendering
- [ ] Identify header/footer objects - TODO
- [ ] Find child objects within header/footer - TODO
- [ ] Render header/footer on every page - TODO
- [ ] Calculate body content area excluding header/footer - TODO

### Task 4.9: Multi-Page Support
- [ ] Calculate page breaks based on object Y positions - TODO
- [ ] Add new pages as needed - TODO
- [ ] Render header/footer on each page - TODO
- [ ] Adjust Y coordinates for each page - TODO

---

## Phase 5: API Endpoint ✅ COMPLETED

### Task 5.1: Create Generate Endpoint
- [x] Create `GenerateEndpoint.cs`
- [x] Define POST route `/api/generate`
- [x] Validate request body (via FastEndpoints)
- [x] Call PDF generator service
- [x] Return PDF as file response with Content-Disposition header

### Task 5.2: Error Handling
- [x] Handle invalid report structure (returns 400 with error message)
- [x] Handle missing required fields
- [x] Handle image loading failures (graceful skip)
- [x] Handle barcode generation failures (returns empty array)
- [x] Return meaningful error messages as JSON

### Task 5.3: Configure Program.cs
- [x] Setup FastEndpoints with /api prefix
- [x] Setup Swagger documentation at /swagger
- [x] Configure CORS for frontend access (localhost:5173, 5174, 3000)
- [x] Register services (ParameterSubstitutionService, BarcodeService, ImageService, PdfGeneratorService)
- [x] Configure QuestPDF Community License
- [x] Configure logging

---

## Phase 6: Testing and Integration 🔄 IN PROGRESS

### Task 6.1: Create Test Endpoint
- [x] Simple endpoint to test PDF generation (POST /api/generate)
- [x] Return sample PDF with basic elements

### Task 6.2: Create HTTP Test Files
- [x] `Tests/generate.http` - Test file for API testing with two test cases:
  - Simple PDF with text, parameter substitution, and QR code
  - Sales report with table and data region
- [x] Sample report JSON for testing
- [x] Test various object types

### Task 6.3: Integration Testing
- [x] API tested with curl, generates valid PDFs:
  - Simple text: 7,736 bytes
  - Text + QR code + parameters: 16,760 bytes
  - Table with data: 23,420 bytes
- [ ] Test with ReportMaker frontend - TODO
- [ ] Verify PDF output matches canvas preview - TODO
- [x] Test all basic object types (text, barcode, table)
- [x] Test parameter substitution ({{paramName}} syntax)
- [x] Test data binding with data regions

---

## Technical Considerations

### PDF Library Choice: QuestPDF
- Open source (MIT license)
- Native .NET library
- Fluent API for document creation
- Good performance
- Active development
- Supports all required features:
  - Text with fonts and styling
  - Images
  - Shapes
  - Tables
  - Multi-page documents

### Coordinate System
- ReportMaker uses pixels from top-left
- QuestPDF uses points (similar to PDF standard)
- Conversion: 1 px ≈ 0.75 pt (or use direct pixel mapping)
- Use absolute positioning for faithful reproduction

### Font Mapping
| ReportMaker | PDF Equivalent |
|------------|----------------|
| Arial | Helvetica |
| Courier | Courier |
| Times | Times-Roman |

### Color Handling
- Parse hex colors (#RRGGBB, #RGB)
- Handle 'transparent' as no fill
- Convert to RGB for PDF

---

## Implementation Order

1. **Phase 1** - Project setup (foundation)
2. **Phase 2** - Models (data structures)
3. **Phase 3** - Services (core logic)
4. **Phase 4** - PDF generation (main feature)
5. **Phase 5** - API endpoint (integration)
6. **Phase 6** - Testing (validation)

---

## Files to Create

| File | Description |
|------|-------------|
| `reportgenerator.csproj` | Project file with dependencies |
| `Program.cs` | Application entry point |
| `appsettings.json` | Configuration |
| `Models/GenerateRequest.cs` | API request model |
| `Models/ReportObject.cs` | Report object model |
| `Models/ReportObjectProperties.cs` | Object properties |
| `Models/CanvasSettings.cs` | Canvas settings |
| `Models/PageSettings.cs` | Page settings |
| `Models/ReportParameter.cs` | Parameter model |
| `Models/OutputOptions.cs` | Output configuration |
| `Services/PdfGeneratorService.cs` | PDF generation |
| `Services/ParameterSubstitutionService.cs` | Parameter handling |
| `Services/BarcodeService.cs` | Barcode generation |
| `Services/ImageService.cs` | Image handling |
| `Endpoints/GenerateEndpoint.cs` | API endpoint |

---

## Dependencies (NuGet Packages)

```xml
<PackageReference Include="FastEndpoints" Version="5.*" />
<PackageReference Include="FastEndpoints.Swagger" Version="5.*" />
<PackageReference Include="QuestPDF" Version="2024.*" />
<PackageReference Include="ZXing.Net" Version="0.16.*" />
<PackageReference Include="SkiaSharp" Version="2.*" />
<PackageReference Include="SkiaSharp.NativeAssets.Linux" Version="2.*" />
```

---

## Success Criteria

1. API accepts report JSON and returns valid PDF
2. All object types render correctly:
   - Text with all styling options
   - Images (base64 and URL)
   - Barcodes (QR, Code128, PDF417, DataMatrix)
   - Tables with data
   - Shapes (line, rectangle, ellipse, polygon, polyline)
3. Parameter substitution works for `{{paramName}}` syntax
4. Data binding populates values from data regions
5. Multi-page reports render correctly
6. Header/footer appear on all pages
7. PDF matches ReportMaker canvas preview
