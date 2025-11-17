Add the ability to connect to the sqlrest api. 
It is running at http://localhost:5000/
Use the swagger interface to explore the api. (http://localhost:5000/swagger/v1/swagger.json)

Create a connection dialog that shows to the user the available schemas and tables. 
The user can then select the schema and table they want to connect to.

Present the data in a grid.

Now make the discovery of the schema and table dynamic. The only input you have is the swagger endpoint.
So the AVAILABLE_SCHEMAS_TABLES shouuld be contructed from the swagger endpoint.

In the excel-grid project (sqlRestApi.ts), use the /api/tables endpoint to get the list of available tables.

## Implementation Complete ✅

### Changes Made to sqlRestApi.ts:

1. **Added new interfaces:**
   - `TableInfo` - Matches the API response structure
   - `TablesResponse` - Wrapper for the tables array with count

2. **Created `fetchTablesFromApi()` function:**
   - Directly calls `GET /api/tables` endpoint
   - Converts `TableInfo[]` to `SchemaTable[]` format
   - Returns sorted list of available tables

3. **Updated `discoverSchemasAndTables()` function:**
   - **Primary method**: Uses `/api/tables` endpoint for accurate results
   - **Fallback method**: Uses Swagger parsing if API endpoint fails
   - Maintains backward compatibility
   - Improved filtering to exclude `/api/tables` from Swagger parsing

### Benefits:
- **Accuracy**: Gets actual available tables from the database
- **Performance**: Direct API call is faster than parsing large Swagger specs
- **Reliability**: Fallback to Swagger parsing ensures compatibility
- **Real-time**: Reflects current database state, not just endpoint definitions

### Usage:
```typescript
// Direct API call (preferred)
const tables = await fetchTablesFromApi();

// Automatic discovery with fallback
const tables = await discoverSchemasAndTables();
```

The implementation now uses the `/api/tables` endpoint as the primary method for discovering available database tables, with Swagger parsing as a reliable fallback.

Update the database access in the excel grid with first login in and then getting the list of tables



When data is imported from a database table, add at the top,left cell a corner access to show the details of the database table connection.
This should open a new window with the database table connection details.

When doing a database crud action (like a delete record), I cann be that the rest endpoint returns an error (like on a foreign key constraint). 
In that case, add an indicator on the record (red ?), when the user clicks on the indicator, show the error message as tooltip.