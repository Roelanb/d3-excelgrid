using FastEndpoints;
using SqlRest.DTOs;
using SqlRest.Services;
using Microsoft.SqlServer.Types;

namespace SqlRest.Endpoints;

/// <summary>
/// Generic endpoint that handles GET requests for any table in the database.
/// Route: GET /api/{schema}/{table}
/// </summary>
public class GenericGetTableEndpoint : EndpointWithoutRequest<PaginatedResponse<object>>
{
    private readonly IDatabaseService _dbService;

    public GenericGetTableEndpoint(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Get("/api/{schema}/{table}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var schema = Route<string>("schema")!;
        var table = Route<string>("table")!;

        // Get query parameters from URL query string
        var page = Query<int?>("page", isRequired: false) ?? 1;
        var pageSize = Query<int?>("pageSize", isRequired: false) ?? 100;
        var search = Query<string?>("search", isRequired: false);

        // Validate pagination parameters
        if (page < 1)
        {
            await Send.ErrorsAsync(400);
            return;
        }

        if (pageSize < 1 || pageSize > 1000)
        {
            await Send.ErrorsAsync(400);
            return;
        }

        try
        {
            var (whereClause, whereParams) = await BuildWhereClauseAsync(schema, table, search);
            var orderBy = BuildOrderByClause(null, false); // For now, ignore sorting from query params

            var skip = (page - 1) * pageSize;
            var data = await _dbService.GetAsync(schema, table, whereClause, whereParams, orderBy, skip, pageSize);
            var totalCount = await _dbService.CountAsync(schema, table, whereClause, whereParams);

            // Convert spatial types to prevent JSON serialization errors
            var processedData = ConvertSpatialTypes(data);

            var response = new PaginatedResponse<object>
            {
                Data = processedData,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };

            await Send.OkAsync(response);
        }
        catch (Exception ex)
        {
            // Log the actual exception for debugging
            Console.WriteLine($"Error in GenericGetTableEndpoint: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            await Send.ErrorsAsync(400);
        }
    }

    private async Task<(string? whereClause, object? whereParams)> BuildWhereClauseAsync(string schema, string table, string? search)
    {
        if (string.IsNullOrEmpty(search))
        {
            return (null, null);
        }

        // Get actual columns from the table to validate against
        var columns = await _dbService.GetTableSchemaAsync(schema, table);
        var validColumnNames = columns.Select(c => c.ColumnName).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Only search across string columns that actually exist in the table
        var searchableColumns = new[] { "FirstName", "LastName", "MiddleName", "Name", "Title", "Email", "Description" };
        var existingSearchableColumns = searchableColumns.Where(col => validColumnNames.Contains(col)).ToList();

        if (!existingSearchableColumns.Any())
        {
            return (null, null);
        }

        // Build parameterized query
        var searchConditions = existingSearchableColumns.Select(col => $"[{col}] LIKE @SearchParam");
        var whereClause = $"({string.Join(" OR ", searchConditions)})";

        var whereParams = new { SearchParam = $"%{search}%" };

        return (whereClause, whereParams);
    }

    private string? BuildOrderByClause(string? sortBy, bool sortDesc)
    {
        if (string.IsNullOrEmpty(sortBy))
            return null;

        var direction = sortDesc ? "DESC" : "ASC";
        return $"[{sortBy}] {direction}";
    }

    private List<object> ConvertSpatialTypes(IEnumerable<dynamic> data)
    {
        var result = new List<object>();
        
        foreach (var item in data)
        {
            var dict = new Dictionary<string, object>();
            
            foreach (var prop in (IDictionary<string, object>)item)
            {
                // Convert SQL spatial types to string representation
                if (prop.Value is SqlGeography geography)
                {
                    dict[prop.Key] = geography.ToString();
                }
                else if (prop.Value is SqlGeometry geometry)
                {
                    dict[prop.Key] = geometry.ToString();
                }
                else if (prop.Value is SqlHierarchyId hierarchyId)
                {
                    dict[prop.Key] = hierarchyId.ToString();
                }
                else
                {
                    dict[prop.Key] = prop.Value;
                }
            }
            
            result.Add(dict);
        }
        
        return result;
    }
}

/// <summary>
/// Generic endpoint that handles POST (create) requests for any table in the database.
/// Route: POST /api/{schema}/{table}
/// </summary>
public class GenericCreateEndpoint : Endpoint<Dictionary<string, object>, object>
{
    private readonly IDatabaseService _dbService;

    public GenericCreateEndpoint(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Post("/api/{schema}/{table}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(Dictionary<string, object> req, CancellationToken ct)
    {
        var schema = Route<string>("schema")!;
        var table = Route<string>("table")!;

        try
        {
            var id = await _dbService.InsertAsync(schema, table, req);
            var created = await _dbService.GetByIdAsync(schema, table, id);
            
            await Send.CreatedAtAsync($"/api/{schema.ToLower()}/{table.ToLower()}/{id}", created);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(400);
        }
    }
}

/// <summary>
/// Generic endpoint that handles PUT (update) requests for any table in the database.
/// Route: PUT /api/{schema}/{table}/{id}
/// </summary>
public class GenericUpdateEndpoint : Endpoint<Dictionary<string, object>, object>
{
    private readonly IDatabaseService _dbService;

    public GenericUpdateEndpoint(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Put("/api/{schema}/{table}/{id}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(Dictionary<string, object> req, CancellationToken ct)
    {
        var schema = Route<string>("schema")!;
        var table = Route<string>("table")!;
        var id = Route<string>("id")!;

        try
        {
            var existing = await _dbService.GetByIdAsync(schema, table, id);
            if (existing == null)
            {
                await Send.NotFoundAsync();
                return;
            }

            await _dbService.UpdateAsync(schema, table, id, req);
            var updated = await _dbService.GetByIdAsync(schema, table, id);
            
            await Send.OkAsync(updated);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(400);
        }
    }
}

/// <summary>
/// Generic endpoint that handles DELETE requests for any table in the database.
/// Route: DELETE /api/{schema}/{table}/{id}
/// </summary>
public class GenericDeleteEndpoint : EndpointWithoutRequest
{
    private readonly IDatabaseService _dbService;

    public GenericDeleteEndpoint(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Delete("/api/{schema}/{table}/{id}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var schema = Route<string>("schema")!;
        var table = Route<string>("table")!;
        var id = Route<string>("id")!;

        try
        {
            var existing = await _dbService.GetByIdAsync(schema, table, id);
            if (existing == null)
            {
                await Send.NotFoundAsync();
                return;
            }

            await _dbService.DeleteAsync(schema, table, id);
            await Send.NoContentAsync();
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(400);
        }
    }
}
