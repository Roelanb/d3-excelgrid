using FastEndpoints;
using SqlRest.DTOs;
using SqlRest.Services;
using SqlRest.Models;

namespace SqlRest.Endpoints;



public abstract class DynamicCreateEndpointBase : Endpoint<Dictionary<string, object>, object>
{
    protected IDatabaseService DbService { get; }
    protected string Schema { get; }
    protected string Table { get; }

    protected DynamicCreateEndpointBase(IDatabaseService dbService, string schema, string table)
    {
        DbService = dbService;
        Schema = schema;
        Table = table;
    }

    public override void Configure()
    {
        Post($"/api/{Schema.ToLower()}/{Table.ToLower()}");
    }

    public override async Task HandleAsync(Dictionary<string, object> req, CancellationToken ct)
    {
        try
        {
            var id = await DbService.InsertAsync(Schema, Table, req);
            var created = await DbService.GetByIdAsync(Schema, Table, id);
            
            await Send.CreatedAtAsync($"/api/{Schema.ToLower()}/{Table.ToLower()}/{id}", created);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(500);
        }
    }
}

public abstract class DynamicUpdateEndpointBase : Endpoint<Dictionary<string, object>, object>
{
    protected IDatabaseService DbService { get; }
    protected string Schema { get; }
    protected string Table { get; }

    protected DynamicUpdateEndpointBase(IDatabaseService dbService, string schema, string table)
    {
        DbService = dbService;
        Schema = schema;
        Table = table;
    }

    public override void Configure()
    {
        Put($"/api/{Schema.ToLower()}/{Table.ToLower()}/{{id}}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(Dictionary<string, object> req, CancellationToken ct)
    {
        try
        {
            var id = Route<string>("id");
            
            if (string.IsNullOrEmpty(id))
            {
                await Send.ErrorsAsync(400);
                return;
            }

            var existing = await DbService.GetByIdAsync(Schema, Table, id);
            if (existing == null)
            {
                await Send.NotFoundAsync();
                return;
            }

            await DbService.UpdateAsync(Schema, Table, id, req);
            var updated = await DbService.GetByIdAsync(Schema, Table, id);
            
            await Send.OkAsync(updated);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(500);
        }
    }
}

public abstract class DynamicDeleteEndpointBase : Endpoint<IdRequest, object>
{
    protected IDatabaseService DbService { get; }
    protected string Schema { get; }
    protected string Table { get; }

    protected DynamicDeleteEndpointBase(IDatabaseService dbService, string schema, string table)
    {
        DbService = dbService;
        Schema = schema;
        Table = table;
    }

    public override void Configure()
    {
        Delete($"/api/{Schema.ToLower()}/{Table.ToLower()}/{{id}}");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(IdRequest req, CancellationToken ct)
    {
        try
        {
            var id = Route<string>("id");
            
            if (string.IsNullOrEmpty(id))
            {
                await Send.ErrorsAsync(400);
                return;
            }

            var existing = await DbService.GetByIdAsync(Schema, Table, id);
            if (existing == null)
            {
                await Send.NotFoundAsync();
                return;
            }

            await DbService.DeleteAsync(Schema, Table, id);
            await Send.NoContentAsync();
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(500);
        }
    }
}
