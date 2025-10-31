# Dynamic Endpoint Generation

The SQL REST API now automatically discovers and generates CRUD endpoints for all tables in your database at runtime.

## How It Works

1. **Database Discovery**: At application startup, the API queries the database schema to discover all available tables
2. **Dynamic Type Generation**: For each table, the API dynamically creates endpoint types using Reflection.Emit
3. **Automatic Registration**: FastEndpoints automatically discovers and registers these dynamically created endpoints

## Configuration

Configure which schemas and tables to expose in `appsettings.json`:

```json
{
  "DynamicEndpoints": {
    "AllowedSchemas": [],
    "ExcludedSchemas": ["sys", "INFORMATION_SCHEMA"],
    "ExcludedTables": []
  }
}
```

### Configuration Options

- **AllowedSchemas**: If specified (non-empty array), ONLY these schemas will be exposed. Leave empty to allow all schemas.
- **ExcludedSchemas**: Schemas to exclude from endpoint generation. Defaults to `["sys", "INFORMATION_SCHEMA"]`
- **ExcludedTables**: Specific table names to exclude from endpoint generation

### Examples

**Expose only specific schemas:**
```json
{
  "DynamicEndpoints": {
    "AllowedSchemas": ["Production", "Person"],
    "ExcludedSchemas": [],
    "ExcludedTables": []
  }
}
```

**Exclude specific tables:**
```json
{
  "DynamicEndpoints": {
    "AllowedSchemas": [],
    "ExcludedSchemas": ["sys", "INFORMATION_SCHEMA"],
    "ExcludedTables": ["SensitiveData", "InternalLogs"]
  }
}
```

## Generated Endpoints

For each table discovered, the following endpoints are automatically created:

- `GET /api/{schema}/{table}` - Get paginated list with filtering, sorting, and search
- `GET /api/{schema}/{table}/{id}` - Get specific record by primary key
- `POST /api/{schema}/{table}` - Create new record
- `PUT /api/{schema}/{table}/{id}` - Update existing record
- `DELETE /api/{schema}/{table}/{id}` - Delete record

## Startup Output

When the application starts, you'll see console output showing which tables are being registered:

```
Discovering database tables...
Schema: Production
  - Registering endpoints for Production.Product
  - Registering endpoints for Production.ProductCategory
  - Registering endpoints for Production.ProductSubcategory
Schema: Person
  - Registering endpoints for Person.Person
  - Registering endpoints for Person.Address
Successfully registered endpoints for 5 tables
```

## Benefits

1. **Zero Boilerplate**: No need to manually create endpoint classes for each table
2. **Automatic Updates**: Adding a new table to the database automatically creates its endpoints
3. **Consistent API**: All tables get the same CRUD operations with identical behavior
4. **Easy Maintenance**: Changes to base endpoint logic apply to all tables automatically

## Technical Details

### Dynamic Type Creation

The `DynamicEndpointFactory` uses `System.Reflection.Emit` to create types at runtime:

```csharp
DynamicEndpointFactory.RegisterEndpointsForTable("Production", "Product");
```

This creates 5 endpoint types:
- `GetProduction_ProductList` (inherits from `DynamicCrudEndpointBase`)
- `GetProduction_ProductById` (inherits from `DynamicGetByIdEndpointBase`)
- `CreateProduction_Product` (inherits from `DynamicCreateEndpointBase`)
- `UpdateProduction_Product` (inherits from `DynamicUpdateEndpointBase`)
- `DeleteProduction_Product` (inherits from `DynamicDeleteEndpointBase`)

### FastEndpoints Integration

FastEndpoints automatically discovers these dynamically created types during its assembly scanning process, so they're registered just like manually created endpoints.

## Migration from Static Endpoints

If you have existing manually created endpoint files (e.g., `ProductEndpoints.cs`), you can safely delete them. The dynamic system will create equivalent endpoints automatically.

The old static endpoints in the `Endpoints/Person/` and `Endpoints/Production/` directories are no longer needed and can be removed.

## Troubleshooting

### Endpoints Not Appearing

1. Check the console output during startup to see if tables were discovered
2. Verify your connection string is correct
3. Check that the database user has permissions to query `INFORMATION_SCHEMA.TABLES`
4. Review your `AllowedSchemas` and `ExcludedSchemas` configuration

### Primary Key Required

All tables must have a primary key defined. Tables without primary keys will fail when trying to use GetById, Update, or Delete operations.

### Performance

The database discovery happens once at startup, so there's no runtime performance impact. The dynamic type creation is also a one-time cost during application initialization.
