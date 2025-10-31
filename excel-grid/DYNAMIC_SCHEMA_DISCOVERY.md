# Dynamic Schema and Table Discovery

## Overview
The SQL connection feature now dynamically discovers available schemas and tables from the Swagger endpoint instead of using a hardcoded list.

## Implementation Details

### Changes Made

#### 1. `src/services/sqlRestApi.ts`
- **Removed**: Hardcoded `AVAILABLE_SCHEMAS_TABLES` constant
- **Added**: `discoverSchemasAndTables()` function that:
  - Fetches the Swagger JSON from `http://localhost:5000/swagger/v1/swagger.json`
  - Parses all API paths using regex pattern `/^\/api\/([^/]+)\/([^/{}]+)$/`
  - Extracts schema and table names from paths like `/api/person/address`
  - Filters out generic parameter paths (`{schema}`, `{table}`) and special endpoints (`health`, `test`)
  - Returns sorted array of `SchemaTable` objects with display names
  - Caches results to avoid repeated API calls

- **Added**: `clearSchemaCache()` function to force fresh discovery
- **Modified**: `getUniqueSchemas()` and `getTablesForSchema()` to accept schemas/tables as parameters

#### 2. `src/components/SQLConnectionDialog.tsx`
- **Added**: `discoveredSchemasTables` state to store discovered schemas/tables
- **Modified**: Connection flow to call `discoverSchemasAndTables()` after successful connection
- **Added**: Loading indicator during schema discovery
- **Added**: Error handling for empty discovery results
- **Updated**: Schema and table selection to use dynamically discovered data

## How It Works

1. User clicks "Connect to Database" button
2. Dialog tests connection to `http://localhost:5000/api/health`
3. On successful connection, dialog fetches Swagger JSON
4. Parser extracts all paths matching pattern `/api/{schema}/{table}`
5. Schemas and tables are extracted and displayed in dropdowns
6. User selects schema → tables for that schema are shown
7. User selects table → preview data is loaded
8. User clicks "Import to Grid" → data is imported

## Example Discovery

From Swagger paths like:
```
/api/person/person
/api/person/address
/api/person/stateprovince
/api/production/product
/api/production/productcategory
```

The system discovers:
- **Schemas**: person, production
- **Tables**: 
  - person: person, address, stateprovince
  - production: product, productcategory, etc.

## Benefits

1. **No Manual Updates**: New tables/schemas automatically appear
2. **Single Source of Truth**: Swagger spec drives the UI
3. **Cached Performance**: Discovery happens once per session
4. **Error Resilient**: Graceful handling of missing/invalid endpoints
5. **Flexible**: Works with any SQL REST API following the same pattern

## Configuration

The Swagger endpoint URL is defined in `sqlRestApi.ts`:
```typescript
const SWAGGER_URL = 'http://localhost:5000/swagger/v1/swagger.json';
```

To use a different endpoint, simply update this constant.
