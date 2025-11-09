using Microsoft.Data.SqlClient;
using Dapper;
using SqlRest.Models;

namespace SqlRest.Services;

public interface IDatabaseService
{
    Task<List<ColumnInfo>> GetTableSchemaAsync(string schema, string table);
    Task<List<string>> GetTableNamesAsync(string schema);
    Task<Dictionary<string, List<string>>> GetAllSchemasAndTablesAsync();
    Task<dynamic?> GetByIdAsync(string schema, string table, object id);
    Task<IEnumerable<dynamic>> GetAsync(string schema, string table, string? search = null, string? orderBy = null, int? skip = null, int? take = null);
    Task<int> CountAsync(string schema, string table, string? search = null);
    Task<int> InsertAsync(string schema, string table, Dictionary<string, object> data);
    Task<int> UpdateAsync(string schema, string table, object id, Dictionary<string, object> data);
    Task<int> DeleteAsync(string schema, string table, object id);
}

public class DatabaseService : IDatabaseService
{
    private readonly string _connectionString;

    public DatabaseService(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("AdventureWorks") 
            ?? throw new InvalidOperationException("Connection string 'AdventureWorks' not found.");
        
        Console.WriteLine($"Database Connection String: {_connectionString}");
    }

    private SqlConnection GetConnection()
    {
        try
        {
            var connection = new SqlConnection(_connectionString);
            return connection;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to create database connection: {ex.Message}", ex);
        }
    }

    public async Task<List<ColumnInfo>> GetTableSchemaAsync(string schema, string table)
    {
        using var connection = GetConnection();
        var sql = @"
            SELECT 
                c.COLUMN_NAME as ColumnName,
                c.DATA_TYPE as DataType,
                c.IS_NULLABLE as IsNullable,
                c.CHARACTER_MAXIMUM_LENGTH as MaxLength,
                COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IsIdentity,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IsPrimaryKey
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
            WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
            ORDER BY c.ORDINAL_POSITION";

        var result = await connection.QueryAsync<ColumnInfo>(sql, new { schema, table });
        return result.ToList();
    }

    public async Task<List<string>> GetTableNamesAsync(string schema)
    {
        using var connection = GetConnection();
        var sql = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE'";
        var result = await connection.QueryAsync<string>(sql, new { schema });
        return result.ToList();
    }

    public async Task<Dictionary<string, List<string>>> GetAllSchemasAndTablesAsync()
    {
        using var connection = GetConnection();
        var sql = @"
            SELECT 
                TABLE_SCHEMA as [Schema],
                TABLE_NAME as TableName
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME";
        
        var result = await connection.QueryAsync<(string Schema, string TableName)>(sql);
        
        return result
            .GroupBy(x => x.Schema)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.TableName).ToList()
            );
    }

    public async Task<dynamic?> GetByIdAsync(string schema, string table, object id)
    {
        using var connection = GetConnection();
        var columns = await GetTableSchemaAsync(schema, table);
        var primaryKey = columns.FirstOrDefault(c => c.IsPrimaryKey)?.ColumnName;
        
        if (primaryKey == null)
            throw new InvalidOperationException($"No primary key found for {schema}.{table}");

        var sql = $"SELECT * FROM [{schema}].[{table}] WHERE [{primaryKey}] = @id";
        return await connection.QuerySingleOrDefaultAsync(sql, new { id });
    }

    public async Task<IEnumerable<dynamic>> GetAsync(string schema, string table, string? search = null, string? orderBy = null, int? skip = null, int? take = null)
    {
        using var connection = GetConnection();

        // Validate schema and table names to prevent SQL injection
        await ValidateSchemaAndTableAsync(schema, table);

        var sql = $"SELECT * FROM [{schema}].[{table}]";

        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(search))
        {
            var columns = await GetTableSchemaAsync(schema, table);
            var searchableColumns = columns.Where(c => c.DataType.Contains("char") || c.DataType.Contains("text")).Select(c => c.ColumnName).ToList();
            
            if (searchableColumns.Any())
            {
                var whereClauses = new List<string>();
                foreach (var col in searchableColumns)
                {
                    whereClauses.Add($"[{col}] LIKE @SearchParam");
                }
                sql += " WHERE " + string.Join(" OR ", whereClauses);
                parameters.Add("SearchParam", $"%{search}%");
            }
        }

        if (!string.IsNullOrEmpty(orderBy))
        {
            // Validate ORDER BY clause
            await ValidateOrderByClauseAsync(schema, table, orderBy);
            sql += $" ORDER BY {orderBy}";
        }
        else
        {
            sql += " ORDER BY 1";
        }

        if (skip.HasValue && skip.Value > 0)
        {
            sql += $" OFFSET @Skip ROWS";
        }
        else
        {
            sql += " OFFSET 0 ROWS";
        }

        if (skip.HasValue && take.HasValue)
        {
            sql += $" FETCH NEXT @Take ROWS ONLY";
        }
        else if (take.HasValue && take.Value > 0)
        {
            sql += $" FETCH FIRST @Take ROWS ONLY";
        }

        if (skip.HasValue) parameters.Add("Skip", skip.Value);
        if (take.HasValue) parameters.Add("Take", take.Value);

        return await connection.QueryAsync(sql, parameters);
    }

    public async Task<int> InsertAsync(string schema, string table, Dictionary<string, object> data)
    {
        using var connection = GetConnection();
        var columns = string.Join(", ", data.Keys.Select(k => $"[{k}]"));
        var values = string.Join(", ", data.Keys.Select(k => $"@{k}"));
        
        var sql = $"INSERT INTO [{schema}].[{table}] ({columns}) VALUES ({values}); SELECT SCOPE_IDENTITY();";
        
        var result = await connection.QuerySingleAsync<object>(sql, data);
        return Convert.ToInt32(result);
    }

    public async Task<int> UpdateAsync(string schema, string table, object id, Dictionary<string, object> data)
    {
        using var connection = GetConnection();
        var columns = await GetTableSchemaAsync(schema, table);
        var primaryKey = columns.FirstOrDefault(c => c.IsPrimaryKey)?.ColumnName;
        
        if (primaryKey == null)
            throw new InvalidOperationException($"No primary key found for {schema}.{table}");

        var setClause = string.Join(", ", data.Keys.Select(k => $"[{k}] = @{k}"));
        var sql = $"UPDATE [{schema}].[{table}] SET {setClause} WHERE [{primaryKey}] = @id";
        
        var parameters = new Dictionary<string, object>(data) { ["id"] = id };
        return await connection.ExecuteAsync(sql, parameters);
    }

    public async Task<int> DeleteAsync(string schema, string table, object id)
    {
        using var connection = GetConnection();
        var columns = await GetTableSchemaAsync(schema, table);
        var primaryKey = columns.FirstOrDefault(c => c.IsPrimaryKey)?.ColumnName;
        
        if (primaryKey == null)
            throw new InvalidOperationException($"No primary key found for {schema}.{table}");

        var sql = $"DELETE FROM [{schema}].[{table}] WHERE [{primaryKey}] = @id";
        return await connection.ExecuteAsync(sql, new { id });
    }

    public async Task<int> CountAsync(string schema, string table, string? search = null)
    {
        using var connection = GetConnection();

        // Validate schema and table names to prevent SQL injection
        await ValidateSchemaAndTableAsync(schema, table);

        var sql = $"SELECT COUNT(*) FROM [{schema}].[{table}]";

        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(search))
        {
            var columns = await GetTableSchemaAsync(schema, table);
            var searchableColumns = columns.Where(c => c.DataType.Contains("char") || c.DataType.Contains("text")).Select(c => c.ColumnName).ToList();

            if (searchableColumns.Any())
            {
                var whereClauses = new List<string>();
                foreach (var col in searchableColumns)
                {
                    whereClauses.Add($"[{col}] LIKE @SearchParam");
                }
                sql += " WHERE " + string.Join(" OR ", whereClauses);
                parameters.Add("SearchParam", $"%{search}%");
            }
        }

        return await connection.QuerySingleAsync<int>(sql, parameters);
    }

    /// <summary>
    /// Validates that the schema and table exist in the database to prevent SQL injection
    /// </summary>
    private async Task ValidateSchemaAndTableAsync(string schema, string table)
    {
        using var connection = GetConnection();
        var sql = @"
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = @Schema AND TABLE_NAME = @Table";

        var exists = await connection.QuerySingleAsync<int>(sql, new { Schema = schema, Table = table });
        if (exists == 0)
        {
            throw new InvalidOperationException($"Table [{schema}].[{table}] does not exist");
        }
    }

    /// <summary>
    /// Validates ORDER BY clause by checking that all column names exist in the table
    /// </summary>
    private async Task ValidateOrderByClauseAsync(string schema, string table, string orderBy)
    {
        // Extract column names from ORDER BY clause (e.g., "[Name] ASC, [ID] DESC")
        // Remove brackets, ASC, DESC, and split by comma
        var columnPattern = @"\[?([a-zA-Z0-9_]+)\]?\s*(ASC|DESC)?";
        var matches = System.Text.RegularExpressions.Regex.Matches(orderBy, columnPattern);

        var columns = await GetTableSchemaAsync(schema, table);
        var validColumnNames = columns.Select(c => c.ColumnName).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (System.Text.RegularExpressions.Match match in matches)
        {
            if (match.Groups.Count > 1)
            {
                var columnName = match.Groups[1].Value;
                if (!string.IsNullOrWhiteSpace(columnName) && !validColumnNames.Contains(columnName))
                {
                    throw new InvalidOperationException($"Invalid column name in ORDER BY: {columnName}");
                }
            }
        }
    }
}
