using FastEndpoints;
using SqlRest.DTOs;
using SqlRest.Services;

namespace SqlRest.Endpoints;

/// <summary>
/// Endpoint that returns the list of all available tables in the database.
/// Route: GET /api/tables
/// </summary>
public class TablesEndpoint : EndpointWithoutRequest<TablesResponse>
{
    private readonly IDatabaseService _dbService;
    private readonly IConfiguration _configuration;

    public TablesEndpoint(IDatabaseService dbService, IConfiguration configuration)
    {
        _dbService = dbService;
        _configuration = configuration;
    }

    public override void Configure()
    {
        Get("/api/tables");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        try
        {
            var schemasAndTables = await _dbService.GetAllSchemasAndTablesAsync();
            
            // Get filtering configuration
            var allowedSchemas = _configuration.GetSection("DynamicEndpoints:AllowedSchemas").Get<string[]>() ?? Array.Empty<string>();
            var excludedSchemas = _configuration.GetSection("DynamicEndpoints:ExcludedSchemas").Get<string[]>() ?? new[] { "sys", "INFORMATION_SCHEMA" };
            var excludedTables = _configuration.GetSection("DynamicEndpoints:ExcludedTables").Get<string[]>() ?? Array.Empty<string>();
            
            var tables = new List<TableInfo>();
            
            foreach (var schema in schemasAndTables)
            {
                // Skip excluded schemas
                if (excludedSchemas.Contains(schema.Key, StringComparer.OrdinalIgnoreCase))
                    continue;
                
                // If allowedSchemas is specified, only include those schemas
                if (allowedSchemas.Length > 0 && !allowedSchemas.Contains(schema.Key, StringComparer.OrdinalIgnoreCase))
                    continue;
                
                foreach (var table in schema.Value)
                {
                    // Skip excluded tables
                    if (excludedTables.Contains(table, StringComparer.OrdinalIgnoreCase))
                        continue;
                    
                    tables.Add(new TableInfo
                    {
                        Schema = schema.Key,
                        Name = table
                    });
                }
            }
            
            var response = new TablesResponse
            {
                Tables = tables.OrderBy(t => t.Schema).ThenBy(t => t.Name).ToList()
            };

            await Send.OkAsync(response);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(500);
        }
    }
}
