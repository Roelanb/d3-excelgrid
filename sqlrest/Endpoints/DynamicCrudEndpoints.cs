using FastEndpoints;
using SqlRest.Services;

namespace SqlRest.Endpoints;

// Get all tables
public class GetTablesEndpoint : EndpointWithoutRequest
{
    private readonly DatabaseService _dbService;
    private readonly ILogger<GetTablesEndpoint> _logger;

    public GetTablesEndpoint(DatabaseService dbService, ILogger<GetTablesEndpoint> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public override void Configure()
    {
        Get("/tables");
       
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        try
        {
            _logger.LogInformation("GetTablesEndpoint called");
            var tables = await _dbService.GetAllTablesAsync();
            _logger.LogInformation("Returning {Count} tables", tables.Count);
            await SendAsync(new { Tables = tables, TotalCount = tables.Count }, cancellation: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in GetTablesEndpoint");
            await SendAsync(new { Error = ex.Message, Details = ex.ToString() }, 500, ct);
        }
    }
}

// Get table schema
public class GetTableSchemaRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
}

public class GetTableSchemaEndpoint : Endpoint<GetTableSchemaRequest>
{
    private readonly DatabaseService _dbService;

    public GetTableSchemaEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Get("/tables/{Schema}/{Table}/schema");
    }

    public override async Task HandleAsync(GetTableSchemaRequest req, CancellationToken ct)
    {
        var columns = await _dbService.GetTableColumnsAsync(req.Schema, req.Table);
        await SendAsync(new { Schema = req.Schema, Table = req.Table, Columns = columns }, cancellation: ct);
    }
}

// Get records with pagination
public class GetRecordsRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
    public string? Search { get; set; }
}

public class GetRecordsEndpoint : Endpoint<GetRecordsRequest>
{
    private readonly DatabaseService _dbService;

    public GetRecordsEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Get("/{Schema}/{Table}");
    }

    public override async Task HandleAsync(GetRecordsRequest req, CancellationToken ct)
    {
        var result = await _dbService.GetRecordsAsync(req.Schema, req.Table, req.Page, req.PageSize, req.Search);
        await SendAsync(result, cancellation: ct);
    }
}

// Get specific record by ID
public class GetRecordByIdRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
    public required string Id { get; set; }
}

public class GetRecordByIdEndpoint : Endpoint<GetRecordByIdRequest>
{
    private readonly DatabaseService _dbService;

    public GetRecordByIdEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Get("/{Schema}/{Table}/{Id}");
    }

    public override async Task HandleAsync(GetRecordByIdRequest req, CancellationToken ct)
    {
        var record = await _dbService.GetRecordByIdAsync(req.Schema, req.Table, req.Id);
        if (record == null)
        {
            await SendNotFoundAsync(ct);
            return;
        }
        await SendAsync(record, cancellation: ct);
    }
}

// Create new record
public class CreateRecordEndpoint : Endpoint<Dictionary<string, object?>>
{
    private readonly DatabaseService _dbService;

    public CreateRecordEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Post("/{Schema}/{Table}");
        AllowAnonymous(); // Remove if you want authentication
    }

    public override async Task HandleAsync(Dictionary<string, object?> data, CancellationToken ct)
    {
        // Schema and Table come from route, data comes from body
        var schema = Route<string>("Schema")!;
        var table = Route<string>("Table")!;
        
        try
        {
            var record = await _dbService.CreateRecordAsync(schema, table, data);
            await SendAsync(record, 201, ct);
        }
        catch (InvalidOperationException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            // Handle SQL Server errors with appropriate HTTP status codes
            var errorMessage = sqlEx.Number switch
            {
                2627 => $"Duplicate key error: A record with this key already exists. {sqlEx.Message}",
                2601 => $"Duplicate key error: Cannot insert duplicate key. {sqlEx.Message}",
                515 => $"Required field missing: {sqlEx.Message}",
                547 => $"Foreign key constraint violation: {sqlEx.Message}",
                _ => $"Database error: {sqlEx.Message}"
            };
            
            await SendAsync(new { error = errorMessage }, 400, ct);
        }
        catch (Exception ex)
        {
            await SendAsync(new { error = $"An error occurred: {ex.Message}" }, 500, ct);
        }
    }
}

// Update record
public class UpdateRecordEndpoint : Endpoint<Dictionary<string, object?>>
{
    private readonly DatabaseService _dbService;

    public UpdateRecordEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Put("/{Schema}/{Table}/{Id}");
        AllowAnonymous(); // Remove if you want authentication
    }

    public override async Task HandleAsync(Dictionary<string, object?> data, CancellationToken ct)
    {
        // Schema, Table, and Id come from route, data comes from body
        var schema = Route<string>("Schema")!;
        var table = Route<string>("Table")!;
        var id = Route<string>("Id")!;
        
        try
        {
            var record = await _dbService.UpdateRecordAsync(schema, table, id, data);
            await SendAsync(record, cancellation: ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("not found"))
        {
            await SendAsync(new { error = $"Record not found with ID: {id}" }, 404, ct);
        }
        catch (InvalidOperationException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            var errorMessage = sqlEx.Number switch
            {
                2627 => $"Duplicate key error: A record with this key already exists. {sqlEx.Message}",
                2601 => $"Duplicate key error: Cannot insert duplicate key. {sqlEx.Message}",
                547 => $"Foreign key constraint violation: {sqlEx.Message}",
                _ => $"Database error: {sqlEx.Message}"
            };
            
            await SendAsync(new { error = errorMessage }, 400, ct);
        }
        catch (Exception ex)
        {
            await SendAsync(new { error = $"An error occurred: {ex.Message}" }, 500, ct);
        }
    }
}

// Delete record
public class DeleteRecordRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
    public required string Id { get; set; }
}

public class DeleteRecordEndpoint : Endpoint<DeleteRecordRequest>
{
    private readonly DatabaseService _dbService;

    public DeleteRecordEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Delete("/{Schema}/{Table}/{Id}");
    }

    public override async Task HandleAsync(DeleteRecordRequest req, CancellationToken ct)
    {
        try
        {
            await _dbService.DeleteRecordAsync(req.Schema, req.Table, req.Id);
            await SendNoContentAsync(ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("not found"))
        {
            await SendAsync(new { error = $"Record not found with ID: {req.Id}" }, 404, ct);
        }
        catch (InvalidOperationException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            var errorMessage = sqlEx.Number switch
            {
                547 => $"Foreign key constraint violation: Cannot delete record because it is referenced by other records. {sqlEx.Message}",
                _ => $"Database error: {sqlEx.Message}"
            };
            
            await SendAsync(new { error = errorMessage }, 400, ct);
        }
        catch (Exception ex)
        {
            await SendAsync(new { error = $"An error occurred: {ex.Message}" }, 500, ct);
        }
    }
}
