using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

// run as: dotnet run http://localhost:3210 out


internal static class Program
{
    private enum ExampleReport
    {
        Simple,
        SizeCheck,
        Table,
        Datatable,
        All
    }

static int ParseIntArg(string[] args, int index, int fallback)
{
    if (args.Length <= index) return fallback;
    if (!int.TryParse(args[index], out var value)) return fallback;
    return value;
}

static ExampleReport? TryParseExample(string? value)
{
    if (string.IsNullOrWhiteSpace(value)) return null;
    var v = value.Trim().ToLowerInvariant();
    return v switch
    {
        "simple" or "text" => ExampleReport.Simple,
        "size" or "sizecheck" or "a4" => ExampleReport.SizeCheck,
        "table" => ExampleReport.Table,
        "datatable" or "data-table" => ExampleReport.Datatable,
        "all" => ExampleReport.All,
        _ => null
    };
}

static ExampleReport PromptExample()
{
    Console.WriteLine("Select example report:");
    Console.WriteLine("  1) simple     (text + formatting)");
    Console.WriteLine("  2) sizecheck  (A4 margins + corner rectangles)");
    Console.WriteLine("  3) table      (table object)");
    Console.WriteLine("  4) datatable  (grouped datatable)");
    Console.WriteLine("  5) all        (generate all examples)");
    Console.Write("Choice [2]: ");
    var input = Console.ReadLine();
    if (string.IsNullOrWhiteSpace(input)) return ExampleReport.SizeCheck;
    return input.Trim() switch
    {
        "1" => ExampleReport.Simple,
        "2" => ExampleReport.SizeCheck,
        "3" => ExampleReport.Table,
        "4" => ExampleReport.Datatable,
        "5" => ExampleReport.All,
        _ => ExampleReport.SizeCheck
    };
}

    private static async Task<int> GenerateToFileAsync(HttpClient http, string generateUrl, object requestBody, string outputPath)
{
    var fullPdfPath = Path.GetFullPath(outputPath);
    var outDir = Path.GetDirectoryName(fullPdfPath) ?? ".";
    Directory.CreateDirectory(outDir);

    var jsonPath = Path.ChangeExtension(fullPdfPath, ".json");
    var requestJson = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    });
    await File.WriteAllTextAsync(jsonPath, requestJson);
    Console.WriteLine($"Saved JSON: {jsonPath}");

    var reportMakerPath = Path.Combine(outDir, Path.GetFileNameWithoutExtension(fullPdfPath) + ".reportmaker.json");
    try
    {
        var root = JsonNode.Parse(requestJson);
        var reportNode = root?["report"];
        if (reportNode != null)
        {
            var reportMakerJson = reportNode.ToJsonString(new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                WriteIndented = true
            });
            await File.WriteAllTextAsync(reportMakerPath, reportMakerJson);
            Console.WriteLine($"Saved ReportMaker JSON: {reportMakerPath}");
        }
    }
    catch
    {
    }

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
    await File.WriteAllBytesAsync(fullPdfPath, pdfBytes);

    Console.WriteLine($"Saved PDF: {fullPdfPath} ({pdfBytes.Length} bytes)");

    try
    {
        var psi = new ProcessStartInfo
        {
            FileName = "pdfinfo",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        psi.ArgumentList.Add(fullPdfPath);

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
}

    public static async Task<int> Main(string[] args)
    {
        var baseUrl = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "http://localhost:3210";
        var outputPathOrDir = args.Length > 1 && !string.IsNullOrWhiteSpace(args[1]) ? args[1] : "test-a4.pdf";

static string? GetArg(string[] args, int index) => args.Length > index ? args[index] : null;

ExampleReport? example = TryParseExample(GetArg(args, 2));

int marginPx;
int rectSizePx;

if (example != null)
{
    // New order: baseUrl outputPathOrDir [example] [marginPx] [rectSizePx]
    marginPx = Math.Max(0, ParseIntArg(args, 3, 20));
    rectSizePx = Math.Max(1, ParseIntArg(args, 4, 40));
}
else
{
    // Backward compatible order: baseUrl outputPathOrDir [marginPx] [rectSizePx] [example]
    marginPx = Math.Max(0, ParseIntArg(args, 2, 20));
    rectSizePx = Math.Max(1, ParseIntArg(args, 3, 40));
    example = TryParseExample(GetArg(args, 4));
}

example ??= PromptExample();

const int a4WidthPx = 794;
const int a4HeightPx = 1123;

if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
    !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine("Base URL must start with http:// or https://");
    return 2;
}

var generateUrl = baseUrl.TrimEnd('/') + "/api/generate";

static bool LooksLikeDirectory(string path)
{
    if (string.IsNullOrWhiteSpace(path)) return false;
    if (Directory.Exists(path)) return true;
    if (path.EndsWith(Path.DirectorySeparatorChar) || path.EndsWith(Path.AltDirectorySeparatorChar)) return true;
    return string.IsNullOrWhiteSpace(Path.GetExtension(path));
}

static string EnsureDirectoryExists(string dir)
{
    var full = Path.GetFullPath(dir);
    Directory.CreateDirectory(full);
    return full;
}

static string BuildOutputPath(string outputPathOrDir, bool isAll, string exampleSlug, string defaultFilename)
{
    if (!isAll)
    {
        if (!LooksLikeDirectory(outputPathOrDir) && Path.GetExtension(outputPathOrDir).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            return outputPathOrDir;

        var dir = EnsureDirectoryExists(LooksLikeDirectory(outputPathOrDir) ? outputPathOrDir : ".");
        return Path.Combine(dir, defaultFilename);
    }

    // isAll: always generate multiple files.
    // If a PDF path is provided, use its directory and base name as prefix.
    if (!LooksLikeDirectory(outputPathOrDir) && Path.GetExtension(outputPathOrDir).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
    {
        var fullFile = Path.GetFullPath(outputPathOrDir);
        var dir = EnsureDirectoryExists(Path.GetDirectoryName(fullFile) ?? ".");
        var prefix = Path.GetFileNameWithoutExtension(fullFile);
        return Path.Combine(dir, $"{prefix}-{exampleSlug}.pdf");
    }

    var outDir = EnsureDirectoryExists(LooksLikeDirectory(outputPathOrDir) ? outputPathOrDir : outputPathOrDir);
    return Path.Combine(outDir, $"example-{exampleSlug}.pdf");
}

        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(60);

var examplesToRun = example.Value == ExampleReport.All
    ? new[] { ExampleReport.Simple, ExampleReport.SizeCheck, ExampleReport.Table, ExampleReport.Datatable }
    : new[] { example.Value };

        var exitCode = 0;
        foreach (var ex in examplesToRun)
        {
            var slug = ex switch
            {
                ExampleReport.Simple => "simple",
                ExampleReport.SizeCheck => "sizecheck",
                ExampleReport.Table => "table",
                ExampleReport.Datatable => "datatable",
                _ => "report"
            };

            var defaultFilename = $"example-{slug}.pdf";
            var outputPath = BuildOutputPath(outputPathOrDir, example.Value == ExampleReport.All, slug, defaultFilename);
            var outputNameForResponse = Path.GetFileName(outputPath);
            var requestBody = ex switch
            {
                ExampleReport.Simple => SimpleDemoReport.BuildRequest(a4WidthPx, a4HeightPx, marginPx, outputNameForResponse),
                ExampleReport.SizeCheck => SizeCheckDemoReport.BuildRequest(a4WidthPx, a4HeightPx, marginPx, rectSizePx, outputNameForResponse),
                ExampleReport.Table => TableDemoReport.BuildRequest(a4WidthPx, a4HeightPx, marginPx, outputNameForResponse),
                ExampleReport.Datatable => DatatableDemoReport.BuildRequest(a4WidthPx, a4HeightPx, marginPx, outputNameForResponse),
                _ => SizeCheckDemoReport.BuildRequest(a4WidthPx, a4HeightPx, marginPx, rectSizePx, outputNameForResponse)
            };

            var result = await GenerateToFileAsync(http, generateUrl, requestBody, outputPath);
            if (result != 0) exitCode = result;
        }

        return exitCode;
    }

}
