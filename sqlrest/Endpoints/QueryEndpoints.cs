using FastEndpoints;
using SqlRest.Services;
using System;
using System.Text.Json.Serialization;

namespace SqlRest.Endpoints;

internal static class QuerySqlValidator
{
    internal static bool IsSafeReadOnlySql(string sql, out string? error)
    {
        error = null;

        var normalized = sql.TrimStart();
        if (normalized.StartsWith(";", StringComparison.Ordinal))
        {
            normalized = normalized.Substring(1).TrimStart();
        }

        if (normalized.Length > 20000)
        {
            error = "SQL is too large";
            return false;
        }

        if (normalized.Contains(';'))
        {
            error = "Only a single statement is allowed";
            return false;
        }

        if (!(normalized.StartsWith("select", StringComparison.OrdinalIgnoreCase) || normalized.StartsWith("with", StringComparison.OrdinalIgnoreCase)))
        {
            error = "Only SELECT/CTE queries are allowed";
            return false;
        }

        var lower = normalized.ToLowerInvariant();
        string[] forbidden = new[]
        {
            " insert ",
            " update ",
            " delete ",
            " merge ",
            " drop ",
            " alter ",
            " create ",
            " truncate ",
            " exec ",
            " execute ",
            " grant ",
            " revoke ",
            " deny ",
            " xp_",
            " sp_",
        };

        foreach (var token in forbidden)
        {
            if (lower.Contains(token))
            {
                error = "Only read-only queries are allowed";
                return false;
            }
        }

        return true;
    }
}

public class QueryRequest
{
    [JsonPropertyName("sql")]
    public required string Sql { get; set; }
}

public class ExecuteQueryEndpoint : Endpoint<QueryRequest>
{
    private readonly DatabaseService _dbService;
    private readonly ILogger<ExecuteQueryEndpoint> _logger;

    public ExecuteQueryEndpoint(DatabaseService dbService, ILogger<ExecuteQueryEndpoint> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/query");
    }

    public override async Task HandleAsync(QueryRequest req, CancellationToken ct)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Sql))
        {
            await SendAsync(new { Error = "SQL is required" }, 400, ct);
            return;
        }

        var sql = req.Sql.Trim();
        if (!QuerySqlValidator.IsSafeReadOnlySql(sql, out var error))
        {
            await SendAsync(new { Error = error ?? "Unsafe SQL" }, 400, ct);
            return;
        }

        try
        {
            _logger.LogInformation("ExecuteQueryEndpoint called (length={Length})", sql.Length);
            var data = await _dbService.ExecuteQueryAsync(sql);
            await SendAsync(new { Data = data, TotalCount = data.Count }, cancellation: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing query");
            await SendAsync(new { Error = ex.Message, Details = ex.ToString() }, 500, ct);
        }
    }
}

public class GetQueryResultSchemaEndpoint : Endpoint<QueryRequest>
{
    private readonly DatabaseService _dbService;
    private readonly ILogger<GetQueryResultSchemaEndpoint> _logger;

    public GetQueryResultSchemaEndpoint(DatabaseService dbService, ILogger<GetQueryResultSchemaEndpoint> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/query/result-schema");
    }

    public override async Task HandleAsync(QueryRequest req, CancellationToken ct)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Sql))
        {
            await SendAsync(new { Error = "SQL is required" }, 400, ct);
            return;
        }

        var sql = req.Sql.Trim();
        if (!QuerySqlValidator.IsSafeReadOnlySql(sql, out var error))
        {
            await SendAsync(new { Error = error ?? "Unsafe SQL" }, 400, ct);
            return;
        }

        try
        {
            _logger.LogInformation("GetQueryResultSchemaEndpoint called (length={Length})", sql.Length);
            var columns = await _dbService.GetQueryResultSchemaAsync(sql);
            await SendAsync(new { ResultSets = new[] { columns }, ResultSetCount = 1 }, cancellation: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting query schema");
            await SendAsync(new { Error = ex.Message, Details = ex.ToString() }, 500, ct);
        }
    }
}
