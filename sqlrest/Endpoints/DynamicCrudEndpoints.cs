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
public class CreateRecordRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
    public required Dictionary<string, object?> Data { get; set; }
}

public class CreateRecordEndpoint : Endpoint<CreateRecordRequest>
{
    private readonly DatabaseService _dbService;

    public CreateRecordEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Post("/{Schema}/{Table}");
    }

    public override async Task HandleAsync(CreateRecordRequest req, CancellationToken ct)
    {
        var record = await _dbService.CreateRecordAsync(req.Schema, req.Table, req.Data);
        await SendAsync(record, 201, ct);
    }
}

// Update record
public class UpdateRecordRequest
{
    public required string Schema { get; set; }
    public required string Table { get; set; }
    public required string Id { get; set; }
    public required Dictionary<string, object?> Data { get; set; }
}

public class UpdateRecordEndpoint : Endpoint<UpdateRecordRequest>
{
    private readonly DatabaseService _dbService;

    public UpdateRecordEndpoint(DatabaseService dbService)
    {
        _dbService = dbService;
    }

    public override void Configure()
    {
        Put("/{Schema}/{Table}/{Id}");
    }

    public override async Task HandleAsync(UpdateRecordRequest req, CancellationToken ct)
    {
        var record = await _dbService.UpdateRecordAsync(req.Schema, req.Table, req.Id, req.Data);
        await SendAsync(record, cancellation: ct);
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
        await _dbService.DeleteRecordAsync(req.Schema, req.Table, req.Id);
        await SendNoContentAsync(ct);
    }
}
