using System.Text.Json;
using ReportGenerator.Models;

namespace ReportGenerator.Services;

public class LlmReportService
{
    private readonly SqlRestClient _sqlRest;
    private readonly OpenRouterClient _openRouter;

    public LlmReportService(SqlRestClient sqlRest, OpenRouterClient openRouter)
    {
        _sqlRest = sqlRest;
        _openRouter = openRouter;
    }

    public async Task<LlmGenerateResponse> GenerateAsync(LlmGenerateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
            throw new ArgumentException("Question is required", nameof(request));

        var sources = request.Sources
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (sources.Count == 0)
        {
            sources = await _sqlRest.GetTablesAsync(ct);
        }

        var contexts = await BuildContextsAsync(sources, ct);

        var systemPrompt = BuildSystemPrompt();
        var userPrompt = BuildUserPrompt(request.Question, contexts, request.Report, request.History);

        var content = await _openRouter.ChatAsync(systemPrompt, userPrompt, ct);
        var json = ExtractFirstJsonObject(content);

        if (json == null)
            throw new InvalidOperationException("LLM did not return a JSON object");

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        var parsed = JsonSerializer.Deserialize<LlmGenerateResponse>(json, options);
        if (parsed == null)
            throw new InvalidOperationException("Failed to parse LLM JSON response");

        parsed.ReportObjects ??= new List<ReportObject>();

        parsed.CanvasSettings = NormalizeCanvasSettings(parsed.CanvasSettings);

        return parsed;
    }

    private async Task<List<LlmSourceContext>> BuildContextsAsync(List<string> sources, CancellationToken ct)
    {
        // Avoid sending potentially huge sample data for the whole database.
        // Schema-only context is usually sufficient; the LLM can generate SQL queries when needed.

        var maxParallel = 8;
        var gate = new SemaphoreSlim(maxParallel, maxParallel);

        var tasks = sources.Select(async s =>
        {
            await gate.WaitAsync(ct);
            try
            {
                var columns = await _sqlRest.GetTableSchemaAsync(s, ct);
                return new LlmSourceContext
                {
                    FullName = s,
                    Columns = columns,
                    SampleRows = new List<Dictionary<string, object?>>()
                };
            }
            finally
            {
                gate.Release();
            }
        });

        var contexts = await Task.WhenAll(tasks);
        return contexts.ToList();
    }

    private static CanvasSettings NormalizeCanvasSettings(CanvasSettings? canvasSettings)
    {
        var defaults = new CanvasSettings
        {
            ShowGrid = true,
            SnapToGrid = true,
            GridSize = 20,
            Zoom = 1,
            Width = 794,
            Height = 1123,
            Page = new PageSettings
            {
                Preset = "A4",
                Orientation = "portrait",
                Width = 794,
                Height = 1123,
                Margins = new PageMargins { Top = 40, Right = 40, Bottom = 40, Left = 40 }
            }
        };

        if (canvasSettings == null)
            return defaults;

        if (canvasSettings.GridSize <= 0)
            canvasSettings.GridSize = defaults.GridSize;

        if (canvasSettings.Zoom <= 0)
            canvasSettings.Zoom = defaults.Zoom;

        if (canvasSettings.Width <= 0)
            canvasSettings.Width = defaults.Width;

        if (canvasSettings.Height <= 0)
            canvasSettings.Height = defaults.Height;

        canvasSettings.Page ??= defaults.Page;
        if (canvasSettings.Page != null)
        {
            if (string.IsNullOrWhiteSpace(canvasSettings.Page.Preset))
                canvasSettings.Page.Preset = defaults.Page!.Preset;

            if (string.IsNullOrWhiteSpace(canvasSettings.Page.Orientation))
                canvasSettings.Page.Orientation = defaults.Page!.Orientation;

            if (canvasSettings.Page.Width <= 0)
                canvasSettings.Page.Width = defaults.Page!.Width;

            if (canvasSettings.Page.Height <= 0)
                canvasSettings.Page.Height = defaults.Page!.Height;

            canvasSettings.Page.Margins ??= defaults.Page!.Margins;
        }

        return canvasSettings;
    }

    private static string BuildSystemPrompt()
    {
        return "You generate report definitions for a report designer. Return ONLY valid JSON (no markdown, no code fences). The JSON must have: reportObjects (array), canvasSettings (object), parameters (array or null). Each reportObjects item must include: id (string), type (one of: text,image,chart,table,barcode,dataRegion,header,footer,line,rectangle,ellipse,polygon,polyline), x,y,width,height (numbers), properties (object). IMPORTANT: The frontend expects object type strings to be lower-case/camelCase like: text, image, chart, table, barcode, dataRegion, header, footer, line, rectangle, ellipse, polygon, polyline (do NOT use PascalCase like 'DataRegion' or 'Table'). For a data-driven report, include at least one dataRegion with properties.dataSource. If you need filtering, joins, grouping, ordering, or computed columns, use a SQLRest query data source: {\"type\":\"sqlrest\",\"sourceType\":\"query\",\"sql\":\"SELECT ...\"}. Otherwise use a simple table data source: {\"type\":\"sqlrest\",\"sourceType\":\"table\",\"name\":\"schema.table\",\"tableName\":\"schema.table\"}. Place at least one table object inside that region and set table properties.columns (array of column names). Use A4 canvasSettings matching editor defaults: width 794, height 1123, page preset 'A4', orientation 'portrait', margins {top:40,right:40,bottom:40,left:40}, showGrid true, snapToGrid true, gridSize 20, zoom 1.";
    }

    private static string BuildUserPrompt(
        string question,
        List<LlmSourceContext> contexts,
        ReportDefinition? existingReport,
        List<LlmHistoryItem>? history)
    {
        var payload = JsonSerializer.Serialize(new
        {
            question,
            sources = contexts,
            existingReport,
            history
        });

        if (existingReport != null)
        {
            return $"User instruction: {question}\n\nYou MUST modify the existingReport to satisfy the instruction. Preserve any properties you don't need to change. Keep IDs stable for unchanged objects. You may add/remove objects if needed. Database context (schema) is provided.\n\nContext JSON:\n{payload}\n\nReturn only JSON.";
        }

        return $"User question: {question}\n\nDatabase context (schema):\n{payload}\n\nCreate a report that answers the question using the database schema above. Prefer a simple layout: header title, a table showing relevant fields, and a couple of text fields summarizing key insights. Use SQLRest table sources or SQLRest query sources as needed. Return only JSON.";
    }

    private static string? ExtractFirstJsonObject(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var start = text.IndexOf('{');
        if (start < 0)
            return null;

        var depth = 0;
        var inString = false;
        var escape = false;

        for (var i = start; i < text.Length; i++)
        {
            var c = text[i];

            if (inString)
            {
                if (escape)
                {
                    escape = false;
                    continue;
                }

                if (c == '\\')
                {
                    escape = true;
                    continue;
                }

                if (c == '"')
                {
                    inString = false;
                }

                continue;
            }

            if (c == '"')
            {
                inString = true;
                continue;
            }

            if (c == '{')
                depth++;

            if (c == '}')
            {
                depth--;
                if (depth == 0)
                    return text[start..(i + 1)];
            }
        }

        return null;
    }
}
