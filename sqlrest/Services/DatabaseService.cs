using Microsoft.Data.SqlClient;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Text.Json;

namespace SqlRest.Services;

public class DatabaseService
{
    private readonly string _connectionString;
    private readonly ILogger<DatabaseService> _logger;

    public DatabaseService(IConfiguration configuration, ILogger<DatabaseService> logger)
    {
        var server = configuration["DB_SERVER"] ?? throw new InvalidOperationException("DB_SERVER not configured");
        var database = configuration["DB_NAME"] ?? throw new InvalidOperationException("DB_NAME not configured");
        var user = configuration["DB_USER"] ?? throw new InvalidOperationException("DB_USER not configured");
        var password = configuration["DB_PASSWORD"] ?? throw new InvalidOperationException("DB_PASSWORD not configured");
        var trustCert = configuration["DB_TRUST_CERT"] ?? "true";

        _connectionString = $"Server={server};Database={database};User Id={user};Password={password};TrustServerCertificate={trustCert};";
        _logger = logger;
        
        _logger.LogInformation("DatabaseService initialized with Server={Server}, Database={Database}", server, database);
    }

    public async Task<SqlConnection> GetConnectionAsync()
    {
        try
        {
            _logger.LogInformation("Attempting to open database connection");
            var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            _logger.LogInformation("Database connection opened successfully");
            return connection;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open database connection. Connection string (sanitized): Server={Server}", 
                new SqlConnectionStringBuilder(_connectionString).DataSource);
            throw;
        }
    }

    public async Task<List<StoredProcedureParameterInfo>> GetStoredProcedureParametersAsync(string schema, string procedure)
    {
        try
        {
            _logger.LogInformation("Getting stored procedure parameters for {Schema}.{Procedure}", schema, procedure);
            var parameters = new List<StoredProcedureParameterInfo>();

            using var connection = await GetConnectionAsync();
            using var command = new SqlCommand(@"
            SELECT
                p.name AS ParameterName,
                CASE
                    WHEN t.is_user_defined = 1 THEN CONCAT(ts.name, '.', t.name)
                    ELSE t.name
                END AS TypeName,
                p.max_length,
                p.precision,
                p.scale,
                p.is_output,
                p.is_readonly,
                p.is_nullable,
                p.has_default_value,
                p.parameter_id
            FROM sys.parameters p
            INNER JOIN sys.objects o ON p.object_id = o.object_id
            INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
            INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
            LEFT JOIN sys.schemas ts ON t.schema_id = ts.schema_id
            WHERE o.type = 'P'
              AND s.name = @Schema
              AND o.name = @Procedure
            ORDER BY p.parameter_id;", connection);

            command.Parameters.AddWithValue("@Schema", schema);
            command.Parameters.AddWithValue("@Procedure", procedure);

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                parameters.Add(new StoredProcedureParameterInfo
                {
                    Name = reader.GetString(0),
                    Type = reader.GetString(1),
                    MaxLength = reader.IsDBNull(2) ? null : reader.GetInt16(2),
                    Precision = reader.IsDBNull(3) ? null : reader.GetByte(3),
                    Scale = reader.IsDBNull(4) ? null : reader.GetByte(4),
                    IsOutput = !reader.IsDBNull(5) && reader.GetBoolean(5),
                    IsReadOnly = !reader.IsDBNull(6) && reader.GetBoolean(6),
                    IsNullable = !reader.IsDBNull(7) && reader.GetBoolean(7),
                    HasDefaultValue = !reader.IsDBNull(8) && reader.GetBoolean(8),
                    Ordinal = reader.GetInt32(9)
                });
            }

            _logger.LogInformation("Returning {Count} stored procedure parameters for {Schema}.{Procedure}", parameters.Count, schema, procedure);
            return parameters;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stored procedure parameters for {Schema}.{Procedure}", schema, procedure);
            throw;
        }
    }

    public async Task<List<TableInfo>> GetAllTablesAsync()
    {
        try
        {
            _logger.LogInformation("Getting all tables from database");
            var tables = new List<TableInfo>();
            
            using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(@"
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME", connection);

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                tables.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    FullName = $"{reader.GetString(0)}.{reader.GetString(1)}"
                });
            }

            _logger.LogInformation("Successfully retrieved {TableCount} tables from database", tables.Count);
            return tables;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tables from database");
            throw;
        }
    }

    public async Task<List<TableInfo>> GetAllViewsAsync()
    {
        try
        {
            _logger.LogInformation("Getting all views from database");
            var views = new List<TableInfo>();

            using var connection = await GetConnectionAsync();
            using var command = new SqlCommand(@"
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME
            FROM INFORMATION_SCHEMA.VIEWS
            ORDER BY TABLE_SCHEMA, TABLE_NAME", connection);

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                views.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    FullName = $"{reader.GetString(0)}.{reader.GetString(1)}"
                });
            }

            _logger.LogInformation("Successfully retrieved {ViewCount} views from database", views.Count);
            return views;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving views from database");
            throw;
        }
    }

    public async Task<List<StoredProcedureInfo>> GetAllStoredProceduresAsync()
    {
        try
        {
            _logger.LogInformation("Getting all stored procedures from database");
            var sprocs = new List<StoredProcedureInfo>();

            using var connection = await GetConnectionAsync();
            using var command = new SqlCommand(@"
            SELECT
                s.name AS SchemaName,
                p.name AS ProcedureName
            FROM sys.procedures p
            INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
            ORDER BY s.name, p.name", connection);

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var schema = reader.GetString(0);
                var name = reader.GetString(1);
                sprocs.Add(new StoredProcedureInfo
                {
                    Schema = schema,
                    Name = name,
                    FullName = $"{schema}.{name}"
                });
            }

            _logger.LogInformation("Successfully retrieved {ProcedureCount} stored procedures from database", sprocs.Count);
            return sprocs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stored procedures from database");
            throw;
        }
    }

    public async Task<List<List<Dictionary<string, object?>>>> ExecuteStoredProcedureAsync(
        string schema,
        string procedure,
        Dictionary<string, string?> parameters)
    {
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"[{schema}].[{procedure}]", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        foreach (var kvp in parameters)
        {
            var rawName = kvp.Key;
            var name = rawName.StartsWith('@') ? rawName : "@" + rawName;
            var value = kvp.Value;
            command.Parameters.AddWithValue(name, ParseStringParameter(value) ?? DBNull.Value);
        }

        var resultSets = new List<List<Dictionary<string, object?>>>();
        using var reader = await command.ExecuteReaderAsync();

        do
        {
            var rows = new List<Dictionary<string, object?>>();
            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    row[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
                }
                rows.Add(row);
            }
            resultSets.Add(rows);
        }
        while (await reader.NextResultAsync());

        return resultSets;
    }

    public async Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(string sql)
    {
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 60
        };

        var rows = new List<Dictionary<string, object?>>();
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
            }
            rows.Add(row);
        }

        return rows;
    }

    public async Task<List<StoredProcedureResultColumnInfo>> GetQueryResultSchemaAsync(string sql)
    {
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(sql, connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 60
        };

        using var reader = await command.ExecuteReaderAsync(CommandBehavior.SchemaOnly);
        var schemaColumns = reader.GetColumnSchema();
        return schemaColumns.Select(MapDbColumn).ToList();
    }

    public async Task<List<List<StoredProcedureResultColumnInfo>>> GetStoredProcedureResultSchemaAsync(
        string schema,
        string procedure,
        Dictionary<string, string?> parameters)
    {
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"[{schema}].[{procedure}]", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        foreach (var kvp in parameters)
        {
            var rawName = kvp.Key;
            var name = rawName.StartsWith('@') ? rawName : "@" + rawName;
            var value = kvp.Value;
            command.Parameters.AddWithValue(name, ParseStringParameter(value) ?? DBNull.Value);
        }

        var resultSets = new List<List<StoredProcedureResultColumnInfo>>();
        using var reader = await command.ExecuteReaderAsync(CommandBehavior.SchemaOnly);

        do
        {
            var schemaColumns = reader.GetColumnSchema();
            var columns = schemaColumns
                .Select(MapDbColumn)
                .ToList();
            resultSets.Add(columns);
        }
        while (await reader.NextResultAsync());

        return resultSets;
    }

    private static StoredProcedureResultColumnInfo MapDbColumn(DbColumn column)
    {
        return new StoredProcedureResultColumnInfo
        {
            Name = column.ColumnName ?? string.Empty,
            DataTypeName = column.DataTypeName,
            AllowDBNull = column.AllowDBNull,
            ColumnOrdinal = column.ColumnOrdinal,
            ColumnSize = column.ColumnSize,
            NumericPrecision = column.NumericPrecision.HasValue ? (byte?)column.NumericPrecision.Value : null,
            NumericScale = column.NumericScale
        };
    }

    public async Task<List<ColumnInfo>> GetTableColumnsAsync(string schema, string table)
    {
        return await GetColumnsInternalAsync(schema, table);
    }

    public async Task<PaginatedResponse<Dictionary<string, object?>>> GetRecordsAsync(
        string schema, string table, int page = 1, int pageSize = 100, string? search = null)
    {
        pageSize = Math.Min(pageSize, 1000);
        var offset = (page - 1) * pageSize;

        using var connection = await GetConnectionAsync();

        // Get total count
        var countQuery = $"SELECT COUNT(*) FROM [{schema}].[{table}]";
        if (!string.IsNullOrEmpty(search))
        {
            countQuery += " WHERE CAST([Id] AS NVARCHAR) LIKE @Search";
        }

        int totalCount;
        using (var countCommand = new SqlCommand(countQuery, connection))
        {
            if (!string.IsNullOrEmpty(search))
            {
                countCommand.Parameters.AddWithValue("@Search", $"%{search}%");
            }
            var scalar = await countCommand.ExecuteScalarAsync();
            totalCount = scalar is null || scalar is DBNull
                ? 0
                : Convert.ToInt32(scalar, CultureInfo.InvariantCulture);
        }

        // Get data
        var dataQuery = $"SELECT * FROM [{schema}].[{table}]";
        if (!string.IsNullOrEmpty(search))
        {
            dataQuery += " WHERE CAST([Id] AS NVARCHAR) LIKE @Search";
        }
        dataQuery += $" ORDER BY (SELECT NULL) OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        var records = new List<Dictionary<string, object?>>();
        using (var dataCommand = new SqlCommand(dataQuery, connection))
        {
            if (!string.IsNullOrEmpty(search))
            {
                dataCommand.Parameters.AddWithValue("@Search", $"%{search}%");
            }
            dataCommand.Parameters.AddWithValue("@Offset", offset);
            dataCommand.Parameters.AddWithValue("@PageSize", pageSize);

            using var reader = await dataCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var record = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    record[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
                }
                records.Add(record);
            }
        }

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PaginatedResponse<Dictionary<string, object?>>
        {
            Data = records,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages,
            HasPrevious = page > 1,
            HasNext = page < totalPages
        };
    }

    public async Task<Dictionary<string, object?>?> GetRecordByIdAsync(string schema, string table, string id)
    {
        // Get table schema to find primary key column
        var tableSchema = await GetTableSchemaAsync(schema, table);
        var pkColumn = tableSchema.Columns.FirstOrDefault(c => c.IsPrimaryKey);
        if (pkColumn == null)
        {
            throw new InvalidOperationException($"Table [{schema}].[{table}] does not have a primary key");
        }

        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"SELECT * FROM [{schema}].[{table}] WHERE [{pkColumn.Name}] = @Id", connection);
        command.Parameters.AddWithValue("@Id", id);

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var record = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
            }
            return record;
        }

        return null;
    }

    public async Task<Dictionary<string, object?>> CreateRecordAsync(string schema, string table, Dictionary<string, object?> data)
    {
        var columns = string.Join(", ", data.Keys.Select(k => $"[{k}]"));
        var parameters = string.Join(", ", data.Keys.Select(k => $"@{k}"));

        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(
            $"INSERT INTO [{schema}].[{table}] ({columns}) OUTPUT INSERTED.* VALUES ({parameters})", 
            connection);

        foreach (var kvp in data)
        {
            var normalizedValue = NormalizeParameterValue(kvp.Value);
            command.Parameters.AddWithValue($"@{kvp.Key}", normalizedValue ?? DBNull.Value);
        }

        // catch the exception
        try
        {
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var record = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
            }
            return record;
        }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to create record", ex);
        }

        throw new InvalidOperationException("Failed to create record");
    }

    public async Task<Dictionary<string, object?>> UpdateRecordAsync(string schema, string table, string id, Dictionary<string, object?> data)
    {
        // Get table schema to find primary key column
        var tableSchema = await GetTableSchemaAsync(schema, table);
        var pkColumn = tableSchema.Columns.FirstOrDefault(c => c.IsPrimaryKey);
        if (pkColumn == null)
        {
            throw new InvalidOperationException($"Table [{schema}].[{table}] does not have a primary key");
        }

        var setClause = string.Join(", ", data.Keys.Select(k => $"[{k}] = @{k}"));

        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(
            $"UPDATE [{schema}].[{table}] SET {setClause} OUTPUT INSERTED.* WHERE [{pkColumn.Name}] = @Id", 
            connection);

        command.Parameters.AddWithValue("@Id", id);
        foreach (var kvp in data)
        {
            var normalizedValue = NormalizeParameterValue(kvp.Value);
            command.Parameters.AddWithValue($"@{kvp.Key}", normalizedValue ?? DBNull.Value);
        }

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var record = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : NormalizeParameterValue(reader.GetValue(i));
            }
            return record;
        }

        throw new InvalidOperationException("Failed to update record or record not found");
    }

    public async Task DeleteRecordAsync(string schema, string table, string id)
    {
        // Get table schema to find primary key column
        var tableSchema = await GetTableSchemaAsync(schema, table);
        var pkColumn = tableSchema.Columns.FirstOrDefault(c => c.IsPrimaryKey);
        if (pkColumn == null)
        {
            throw new InvalidOperationException($"Table [{schema}].[{table}] does not have a primary key");
        }

        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"DELETE FROM [{schema}].[{table}] WHERE [{pkColumn.Name}] = @Id", connection);
        command.Parameters.AddWithValue("@Id", id);

        var rowsAffected = await command.ExecuteNonQueryAsync();
        if (rowsAffected == 0)
        {
            throw new InvalidOperationException("Record not found");
        }
    }

    private static object? NormalizeParameterValue(object? value)
    {
        if (value is null)
        {
            return null;
        }

        // Handle SQL Server spatial types (SqlGeography, SqlGeometry) and other SQL types that can be null
        var valueType = value.GetType();
        if (valueType.Namespace == "Microsoft.SqlServer.Types")
        {
            // Check if the spatial type has an IsNull property
            var isNullProperty = valueType.GetProperty("IsNull");
            if (isNullProperty != null)
            {
                var isNull = (bool?)isNullProperty.GetValue(value);
                if (isNull == true)
                {
                    return null;
                }
            }
            
            // Convert spatial types to WKT (Well-Known Text) string representation
            var toStringMethod = valueType.GetMethod("ToString");
            if (toStringMethod != null)
            {
                return toStringMethod.Invoke(value, null)?.ToString();
            }
        }

        if (value is JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    return null;
                case JsonValueKind.Number:
                    if (element.TryGetInt32(out var intValue))
                    {
                        return intValue;
                    }
                    if (element.TryGetInt64(out var longValue))
                    {
                        return longValue;
                    }
                    if (element.TryGetDecimal(out var decimalValue))
                    {
                        return decimalValue;
                    }
                    return element.GetDouble();
                case JsonValueKind.String:
                    if (element.TryGetDateTime(out var dateTimeValue))
                    {
                        return dateTimeValue;
                    }
                    if (element.TryGetGuid(out var guidValue))
                    {
                        return guidValue;
                    }
                    return element.GetString();
                case JsonValueKind.True:
                case JsonValueKind.False:
                    return element.GetBoolean();
                case JsonValueKind.Array:
                case JsonValueKind.Object:
                    return element.GetRawText();
                default:
                    return element.GetRawText();
            }
        }

        return value;
    }

    private static object? ParseStringParameter(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return string.Empty;
        }

        if (string.Equals(trimmed, "null", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (bool.TryParse(trimmed, out var boolValue))
        {
            return boolValue;
        }

        if (int.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var intValue))
        {
            return intValue;
        }

        if (long.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var longValue))
        {
            return longValue;
        }

        if (decimal.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var decimalValue))
        {
            return decimalValue;
        }

        if (Guid.TryParse(trimmed, out var guidValue))
        {
            return guidValue;
        }

        if (DateTime.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dateTimeValue))
        {
            return dateTimeValue;
        }

        return trimmed;
    }

    public async Task<TableSchema> GetTableSchemaAsync(string schema, string table)
    {
        var columns = await GetColumnsInternalAsync(schema, table);
        
        return new TableSchema
        {
            Schema = schema,
            Table = table,
            Columns = columns
        };
    }
    private async Task<List<ColumnInfo>> GetColumnsInternalAsync(string schema, string table)
    {
        using var connection = await GetConnectionAsync();
        
        var columns = new List<ColumnInfo>();
        
        var query = @"
            SELECT 
                c.COLUMN_NAME as Name,
                c.DATA_TYPE as Type,
                c.IS_NULLABLE as IsNullable,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IsPrimaryKey,
                c.CHARACTER_MAXIMUM_LENGTH as MaxLength,
                c.NUMERIC_PRECISION as Precision,
                c.NUMERIC_SCALE as Scale
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_CATALOG, ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
                    AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                    AND tc.TABLE_NAME = ku.TABLE_NAME
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                AND c.TABLE_NAME = pk.TABLE_NAME 
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE c.TABLE_SCHEMA = @Schema AND c.TABLE_NAME = @Table
            ORDER BY c.ORDINAL_POSITION";
        
        using var command = new SqlCommand(query, connection);
        command.Parameters.AddWithValue("@Schema", schema);
        command.Parameters.AddWithValue("@Table", table);
        
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            columns.Add(new ColumnInfo
            {
                Name = reader.GetString(0),
                Type = reader.GetString(1),
                IsNullable = reader.GetString(2) == "YES",
                IsPrimaryKey = reader.GetInt32(3) == 1,
                MaxLength = reader.IsDBNull(4) ? null : reader.GetInt32(4),
                Precision = reader.IsDBNull(5) ? null : reader.GetByte(5),
                Scale = reader.IsDBNull(6) ? null : reader.GetInt32(6)
            });
        }

        return columns;
    }
}

public record TableInfo
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
    public required string FullName { get; init; }
}

public record StoredProcedureInfo
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
    public required string FullName { get; init; }
}

public record StoredProcedureParameterInfo
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public short? MaxLength { get; init; }
    public byte? Precision { get; init; }
    public byte? Scale { get; init; }
    public required bool IsOutput { get; init; }
    public required bool IsReadOnly { get; init; }
    public required bool IsNullable { get; init; }
    public required bool HasDefaultValue { get; init; }
    public required int Ordinal { get; init; }
}

public record StoredProcedureResultColumnInfo
{
    public required string Name { get; init; }
    public string? DataTypeName { get; init; }
    public bool? AllowDBNull { get; init; }
    public int? ColumnOrdinal { get; init; }
    public int? ColumnSize { get; init; }
    public int? NumericPrecision { get; init; }
    public int? NumericScale { get; init; }
}

public record ColumnInfo
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required bool IsNullable { get; init; }
    public required bool IsPrimaryKey { get; init; }
    public int? MaxLength { get; init; }
    public int? Precision { get; init; }
    public int? Scale { get; init; }
}

public record TableSchema
{
    public required string Schema { get; init; }
    public required string Table { get; init; }
    public required List<ColumnInfo> Columns { get; init; }
}

public record PaginatedResponse<T>
{
    public required List<T> Data { get; init; }
    public required int TotalCount { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
    public required int TotalPages { get; init; }
    public required bool HasPrevious { get; init; }
    public required bool HasNext { get; init; }
}
