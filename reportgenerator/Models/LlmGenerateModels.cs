using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

public class LlmGenerateRequest
{
    [JsonPropertyName("question")]
    public required string Question { get; set; }

    [JsonPropertyName("sources")]
    public List<string> Sources { get; set; } = new();

    [JsonPropertyName("report")]
    public ReportDefinition? Report { get; set; }

    [JsonPropertyName("history")]
    public List<LlmHistoryItem>? History { get; set; }
}

public class LlmHistoryItem
{
    [JsonPropertyName("prompt")]
    public required string Prompt { get; set; }

    [JsonPropertyName("report")]
    public required ReportDefinition Report { get; set; }
}

public class LlmSourceContext
{
    [JsonPropertyName("fullName")]
    public required string FullName { get; set; }

    [JsonPropertyName("columns")]
    public List<LlmColumnInfo> Columns { get; set; } = new();

    [JsonPropertyName("sampleRows")]
    public List<Dictionary<string, object?>> SampleRows { get; set; } = new();
}

public class LlmColumnInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("type")]
    public required string Type { get; set; }

    [JsonPropertyName("isNullable")]
    public bool IsNullable { get; set; }

    [JsonPropertyName("isPrimaryKey")]
    public bool IsPrimaryKey { get; set; }

    [JsonPropertyName("maxLength")]
    public int? MaxLength { get; set; }

    [JsonPropertyName("precision")]
    public int? Precision { get; set; }

    [JsonPropertyName("scale")]
    public int? Scale { get; set; }
}

public class LlmGenerateResponse
{
    [JsonPropertyName("reportObjects")]
    public List<ReportObject> ReportObjects { get; set; } = new();

    [JsonPropertyName("canvasSettings")]
    public CanvasSettings? CanvasSettings { get; set; }

    [JsonPropertyName("parameters")]
    public List<ReportParameter>? Parameters { get; set; }
}
