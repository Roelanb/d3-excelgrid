using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

/// <summary>
/// Request body for the /api/generate endpoint
/// </summary>
public class GenerateRequest
{
    /// <summary>
    /// The report definition (structure, objects, settings)
    /// </summary>
    [JsonPropertyName("report")]
    public required ReportDefinition Report { get; set; }

    /// <summary>
    /// Data for data regions, keyed by data region ID
    /// </summary>
    [JsonPropertyName("data")]
    public Dictionary<string, List<Dictionary<string, object>>>? Data { get; set; }

    /// <summary>
    /// Output configuration
    /// </summary>
    [JsonPropertyName("output")]
    public OutputOptions? Output { get; set; }
}

/// <summary>
/// Output configuration options
/// </summary>
public class OutputOptions
{
    /// <summary>
    /// Output format (currently only "pdf" supported)
    /// </summary>
    [JsonPropertyName("format")]
    public string Format { get; set; } = "pdf";

    /// <summary>
    /// Suggested filename for the output
    /// </summary>
    [JsonPropertyName("filename")]
    public string? Filename { get; set; }
}

/// <summary>
/// The complete report definition
/// </summary>
public class ReportDefinition
{
    [JsonPropertyName("reportObjects")]
    public List<ReportObject> ReportObjects { get; set; } = new();

    [JsonPropertyName("canvasSettings")]
    public required CanvasSettings CanvasSettings { get; set; }

    [JsonPropertyName("parameters")]
    public List<ReportParameter>? Parameters { get; set; }
}
