using Microsoft.Data.SqlClient;
using System.Data;

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

    public async Task<List<ColumnInfo>> GetTableColumnsAsync(string schema, string table)
    {
        var columns = new List<ColumnInfo>();
        
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(@"
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.IS_NULLABLE,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
                    AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                AND c.TABLE_NAME = pk.TABLE_NAME 
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE c.TABLE_SCHEMA = @Schema AND c.TABLE_NAME = @Table
            ORDER BY c.ORDINAL_POSITION", connection);

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
                IsPrimaryKey = reader.GetInt32(3) == 1
            });
        }

        return columns;
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
            totalCount = (int)await countCommand.ExecuteScalarAsync()!;
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
                    record[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
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
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"SELECT * FROM [{schema}].[{table}] WHERE Id = @Id", connection);
        command.Parameters.AddWithValue("@Id", id);

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var record = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
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
            command.Parameters.AddWithValue($"@{kvp.Key}", kvp.Value ?? DBNull.Value);
        }

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var record = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            return record;
        }

        throw new InvalidOperationException("Failed to create record");
    }

    public async Task<Dictionary<string, object?>> UpdateRecordAsync(string schema, string table, string id, Dictionary<string, object?> data)
    {
        var setClause = string.Join(", ", data.Keys.Select(k => $"[{k}] = @{k}"));

        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand(
            $"UPDATE [{schema}].[{table}] SET {setClause} OUTPUT INSERTED.* WHERE Id = @Id", 
            connection);

        command.Parameters.AddWithValue("@Id", id);
        foreach (var kvp in data)
        {
            command.Parameters.AddWithValue($"@{kvp.Key}", kvp.Value ?? DBNull.Value);
        }

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var record = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                record[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            return record;
        }

        throw new InvalidOperationException("Failed to update record or record not found");
    }

    public async Task DeleteRecordAsync(string schema, string table, string id)
    {
        using var connection = await GetConnectionAsync();
        using var command = new SqlCommand($"DELETE FROM [{schema}].[{table}] WHERE Id = @Id", connection);
        command.Parameters.AddWithValue("@Id", id);

        var rowsAffected = await command.ExecuteNonQueryAsync();
        if (rowsAffected == 0)
        {
            throw new InvalidOperationException("Record not found");
        }
    }
}

public record TableInfo
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
    public required string FullName { get; init; }
}

public record ColumnInfo
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required bool IsNullable { get; init; }
    public required bool IsPrimaryKey { get; init; }
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
