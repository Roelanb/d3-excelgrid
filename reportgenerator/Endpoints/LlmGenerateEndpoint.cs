using FastEndpoints;
using ReportGenerator.Models;
using ReportGenerator.Services;

namespace ReportGenerator.Endpoints;

public class LlmGenerateEndpoint : Endpoint<LlmGenerateRequest, LlmGenerateResponse>
{
    private readonly LlmReportService _service;

    public LlmGenerateEndpoint(LlmReportService service)
    {
        _service = service;
    }

    public override void Configure()
    {
        Post("/llm/generate");
        AllowAnonymous();
    }

    public override async Task HandleAsync(LlmGenerateRequest req, CancellationToken ct)
    {
        try
        {
            var result = await _service.GenerateAsync(req, ct);
            HttpContext.Response.StatusCode = 200;
            await HttpContext.Response.WriteAsJsonAsync(result, ct);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "LLM generate failed");
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsJsonAsync(new { error = ex.Message }, ct);
        }
    }
}
