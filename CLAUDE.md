# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D3 Excel Grid is a high-performance, Excel-like grid component built with React, TypeScript, D3.js, and Material-UI. The project consists of two main parts:

1. **excel-grid**: Frontend React application with a virtual scrolling grid component
2. **sqlrest**: Backend ASP.NET Core REST API for database connectivity with JWT authentication

## Development Commands

### Frontend (excel-grid/)

```bash
# Development server (runs on http://localhost:5173)
cd excel-grid && pnpm dev

# Build for production
pnpm build

# Lint code
pnpm lint

# Preview production build
pnpm preview

# Deploy to Cloudflare Pages
pnpm deploy
```

### Backend (sqlrest/)

```bash
# Development server (runs on http://localhost:3200)
cd sqlrest && dotnet run

# Build project
dotnet build

# Watch mode (auto-restart on changes)
dotnet watch run

# Restore dependencies
dotnet restore
```

### Environment Setup

**Frontend**: Copy `excel-grid/.env.example` to `excel-grid/.env` and configure:
- `VITE_API_URL`: Backend API URL (default: http://localhost:3200)

**Backend**: Copy `sqlrest/.env.example` to `sqlrest/.env` and configure:
- Database connection (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- JWT settings (`JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRY_MINUTES`)
- Authentication credentials (`AUTH_USERNAME`, `AUTH_PASSWORD`)
- CORS origins (`CORS_ALLOWED_ORIGINS`)

## Architecture

### Frontend Architecture (excel-grid/)

**Core Grid System**:
- `ExcelGrid.tsx`: Main grid component (~1000+ lines) implementing virtual scrolling with D3.js SVG rendering
  - Uses viewport-based rendering (only visible cells are rendered)
  - Sparse data structure (`Map<string, Cell>`) with cells keyed as `"row-col"`
  - Cell selection system supporting single, range, row, and column selection
  - D3.js handles all SVG rendering (cells, headers, borders, selection overlay)

**Data Flow**:
1. User interactions (clicks, keyboard) → Event handlers in ExcelGrid
2. State updates (cells, selection) → D3.js renders SVG elements
3. Toolbar actions → Grid methods via `ExcelGridHandle` ref
4. Database operations → `sqlRestApi.ts` → Backend API → Grid import

**Key Components**:
- `ExcelGrid.tsx`: Virtual scrolling grid with D3.js rendering
- `Toolbar.tsx`: Formatting toolbar with font, alignment, color, border controls
- `CSVImportDialog.tsx`: CSV file import with delimiter detection and type inference
- `SQLConnectionDialog.tsx`: Two-step database connection (login → table selection)
- `DatabaseDetailsModal.tsx`: Shows database table connection metadata
- `ContextMenu.tsx`: Right-click menu for cell operations

**Services Layer**:
- `authService.ts`: JWT authentication for backend API
- `sqlRestApi.ts`: Database table discovery and CRUD operations
  - Primary: Uses `/api/tables` endpoint for table discovery
  - Fallback: Parses Swagger JSON if endpoint fails

**Type System** (`types/cell.ts`):
- `Cell`: Core cell structure with value, formatting, and metadata
- `CellValue`: Union type supporting text, number, date, boolean
- `CellFormatting`: Font, alignment, colors, borders
- `DatabaseMetadata`: Tracks database table connection for cells
- `Selection`: Manages selected cell ranges

### Backend Architecture (sqlrest/)

**Framework**: ASP.NET Core 9.0 with FastEndpoints

**Key Components**:
- `Program.cs`: Application startup, JWT configuration, CORS, middleware pipeline
- `Services/DatabaseService.cs`: SQL Server database operations with parameterized queries
- `Endpoints/AuthEndpoint.cs`: JWT token generation for login
- `Endpoints/DynamicCrudEndpoints.cs`: Auto-generated CRUD endpoints for discovered tables

**Dynamic CRUD System**:
- Discovers all tables from connected SQL Server database
- Generates REST endpoints dynamically: `GET/POST/PUT/DELETE /api/{schema}/{table}`
- Supports pagination (`?page=1&pageSize=100`) and search (`?search=query`)
- Special endpoint `/api/tables` returns list of all available tables with row counts

**Security**:
- JWT Bearer authentication on all endpoints (except health and login)
- Parameterized queries prevent SQL injection
- CORS configuration for cross-origin requests
- Credentials stored in environment variables

## Important Implementation Details

### Virtual Scrolling

The grid uses viewport-based rendering where only visible cells are rendered. Scroll events are throttled using `requestAnimationFrame`. Cell positions are calculated dynamically based on scroll offset and cell dimensions.

### Cell Key Format

Cells are stored in a Map with keys in the format `"row-col"` (e.g., `"5-10"`). This format is used consistently throughout the codebase for cell lookups and must be maintained when adding features.

### Database Integration Flow

1. User clicks "Connect to Database" → Opens `SQLConnectionDialog`
2. User enters credentials → `authService.login()` gets JWT token
3. Dialog fetches tables → `sqlRestApi.fetchTablesFromApi()` gets table list
4. User selects table → `sqlRestApi.fetchTableData()` loads data into grid
5. Grid stores `DatabaseMetadata` in cell (0,0) with green triangle indicator
6. Click triangle → Opens `DatabaseDetailsModal` showing connection info

### Edit Mode for Database Tables

When data is loaded from a database, cells can be edited and changes tracked. The system distinguishes between:
- **Primary key columns**: Not editable (identified from table metadata)
- **Dirty cells**: Modified cells marked for save
- **New rows**: Added rows to be inserted
- **Deleted rows**: Rows marked for deletion

CRUD operations flow through `sqlRestApi.ts` to backend endpoints.

### Cell Type System

Each cell can have a type (`text`, `number`, `date`, `boolean`) that affects:
- Input validation during editing
- Display formatting (date format: YYYY-MM-DD)
- CSV import type inference
- Formula calculations (planned feature)

### Performance Considerations

- Only render ~50-100 cells in viewport at any time
- Use sparse Map storage (not 2D arrays) to minimize memory
- Throttle scroll events with RAF
- CSV import processes in chunks with loading indicator
- Grid auto-expands when importing large files (notifies user)

## Testing Database Connectivity

1. Ensure SQL Server is running and accessible
2. Configure `sqlrest/.env` with valid database credentials
3. Start backend: `cd sqlrest && dotnet run`
4. Test API: `curl http://localhost:3200/api/health`
5. Login: Use credentials from `.env` (default: admin/admin)
6. Test endpoints in `sqlrest/test.http` using REST Client extension

## Common Pitfalls

- **D3.js selections**: Always use `.data()` and `.join()` pattern for enter/update/exit
- **Cell keys**: Must use "row-col" format everywhere
- **Type safety**: Cell values must match CellValue union type
- **Authentication**: Backend requires JWT token in Authorization header (except health/login)
- **CORS**: Ensure frontend origin is in backend CORS_ALLOWED_ORIGINS
- **Environment variables**: Both frontend (.env) and backend (.env) need separate configuration

## Documentation Files

The `vibecoding/` directory contains implementation notes:
- `database-access.md`: Database connection feature implementation
- `table-crud-operations.md`: CRUD operations for database tables

Feature documentation files (`*_FEATURE.md`, `*_SUMMARY.md`) describe historical implementation details for major features.
