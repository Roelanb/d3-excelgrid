using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;

var baseUrl = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "http://localhost:3210";
var outputPath = args.Length > 1 && !string.IsNullOrWhiteSpace(args[1]) ? args[1] : "test-a4.pdf";

static int ParseIntArg(string[] args, int index, int fallback)
{
    if (args.Length <= index) return fallback;
    if (!int.TryParse(args[index], out var value)) return fallback;
    return value;
}

var marginPx = Math.Max(0, ParseIntArg(args, 2, 20));
var rectSizePx = Math.Max(1, ParseIntArg(args, 3, 40));

const int a4WidthPx = 794;
const int a4HeightPx = 1123;
var contentWidthPx = Math.Max(1, a4WidthPx - (marginPx * 2));
var contentHeightPx = Math.Max(1, a4HeightPx - (marginPx * 2));

if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
    !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine("Base URL must start with http:// or https://");
    return 2;
}

var generateUrl = baseUrl.TrimEnd('/') + "/api/generate";

var requestBody = new
{
    report = new
    {
        reportObjects = new object[]
        {
            new
            {
                id = "title",
                type = "text",
                x = rectSizePx + 10,
                y = 10,
                width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                height = 60,
                properties = new
                {
                    text = $"A4 Layout Test (margin: {marginPx}px)",
                    fontSize = 28,
                    fontFamily = "Arial",
                    color = "#111827",
                    bold = true
                }
            },
            new
            {
                id = "subtitle",
                type = "text",
                x = rectSizePx + 10,
                y = 70,
                width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                height = 40,
                properties = new
                {
                    text = "Rectangles mark the 4 corners of the content area",
                    fontSize = 16,
                    fontFamily = "Arial",
                    color = "#374151"
                }
            },
            new
            {
                id = "corner_tl",
                type = "rectangle",
                x = 0,
                y = 0,
                width = rectSizePx,
                height = rectSizePx,
                properties = new
                {
                    strokeWidth = 2,
                    strokeColor = "#ef4444",
                    fillColor = "transparent"
                }
            },
            new
            {
                id = "corner_tr",
                type = "rectangle",
                x = Math.Max(0, contentWidthPx - rectSizePx),
                y = 0,
                width = rectSizePx,
                height = rectSizePx,
                properties = new
                {
                    strokeWidth = 2,
                    strokeColor = "#3b82f6",
                    fillColor = "transparent"
                }
            },
            new
            {
                id = "corner_bl",
                type = "rectangle",
                x = 0,
                y = Math.Max(0, contentHeightPx - rectSizePx),
                width = rectSizePx,
                height = rectSizePx,
                properties = new
                {
                    strokeWidth = 2,
                    strokeColor = "#22c55e",
                    fillColor = "transparent"
                }
            },
            new
            {
                id = "corner_br",
                type = "rectangle",
                x = Math.Max(0, contentWidthPx - rectSizePx),
                y = Math.Max(0, contentHeightPx - rectSizePx),
                width = rectSizePx,
                height = rectSizePx,
                properties = new
                {
                    strokeWidth = 2,
                    strokeColor = "#a855f7",
                    fillColor = "transparent"
                }
            },
            new
            {
                id = "footer",
                type = "text",
                x = rectSizePx + 10,
                y = Math.Max(0, contentHeightPx - 30),
                width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                height = 30,
                properties = new
                {
                    text = "Expected: A4 (595 x 842 pts) with 20px margins",
                    fontSize = 12,
                    fontFamily = "Arial",
                    color = "#6b7280"
                }
            }
        },
        canvasSettings = new
        {
            showGrid = false,
            snapToGrid = false,
            gridSize = 10,
            zoom = 1,
            width = a4WidthPx,
            height = a4HeightPx,
            page = new
            {
                preset = "A4",
                orientation = "portrait",
                width = a4WidthPx,
                height = a4HeightPx,
                margins = new { top = marginPx, right = marginPx, bottom = marginPx, left = marginPx }
            }
        },
        parameters = Array.Empty<object>()
    },
    data = new { },
    output = new { format = "pdf", filename = "test-a4.pdf" }
};

using var http = new HttpClient();
http.Timeout = TimeSpan.FromSeconds(60);

using var response = await http.PostAsJsonAsync(generateUrl, requestBody, new JsonSerializerOptions(JsonSerializerDefaults.Web));
if (!response.IsSuccessStatusCode)
{
    var body = await response.Content.ReadAsStringAsync();
    Console.Error.WriteLine($"Request failed: {(int)response.StatusCode} {response.ReasonPhrase}");
    if (!string.IsNullOrWhiteSpace(body))
        Console.Error.WriteLine(body);
    return 1;
}

var pdfBytes = await response.Content.ReadAsByteArrayAsync();
await File.WriteAllBytesAsync(outputPath, pdfBytes);

Console.WriteLine($"Saved PDF: {Path.GetFullPath(outputPath)} ({pdfBytes.Length} bytes)");

try
{
    var psi = new ProcessStartInfo
    {
        FileName = "pdfinfo",
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    psi.ArgumentList.Add(outputPath);

    using var proc = Process.Start(psi);
    if (proc != null)
    {
        var output = await proc.StandardOutput.ReadToEndAsync();
        await proc.WaitForExitAsync();

        foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (line.StartsWith("Page size:", StringComparison.OrdinalIgnoreCase))
                Console.WriteLine(line);
        }
    }
}
catch
{
}

return 0;
