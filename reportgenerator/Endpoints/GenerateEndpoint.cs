using FastEndpoints;
using ReportGenerator.Models;
using ReportGenerator.Services;

namespace ReportGenerator.Endpoints;

/// <summary>
/// Endpoint to generate PDF reports
/// </summary>
public class GenerateEndpoint : Endpoint<GenerateRequest>
{
    private readonly PdfGeneratorService _pdfGenerator;

    public GenerateEndpoint(PdfGeneratorService pdfGenerator)
    {
        _pdfGenerator = pdfGenerator;
    }

    public override void Configure()
    {
        Post("/generate");
        AllowAnonymous();
        Description(d => d
            .WithName("GenerateReport")
            .WithSummary("Generate a PDF report from a report definition")
            .WithDescription("Accepts a report definition with objects, canvas settings, and data, then generates a PDF document.")
            .Produces<byte[]>(200, "application/pdf")
            .Produces(400));
    }

    public override async Task HandleAsync(GenerateRequest req, CancellationToken ct)
    {
        try
        {
            var pdfBytes = await _pdfGenerator.GenerateAsync(req);

            var filename = req.Output?.Filename ?? "report.pdf";

            HttpContext.Response.ContentType = "application/pdf";
            HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{filename}\"";
            await HttpContext.Response.Body.WriteAsync(pdfBytes, ct);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to generate report");
            HttpContext.Response.StatusCode = 400;
            await HttpContext.Response.WriteAsJsonAsync(new { error = ex.Message }, ct);
        }
    }
}
