using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

/// <summary>
/// Canvas and page settings for the report
/// </summary>
public class CanvasSettings
{
    [JsonPropertyName("showGrid")]
    public bool ShowGrid { get; set; }

    [JsonPropertyName("snapToGrid")]
    public bool SnapToGrid { get; set; }

    [JsonPropertyName("gridSize")]
    public int GridSize { get; set; } = 10;

    [JsonPropertyName("zoom")]
    public double Zoom { get; set; } = 1;

    [JsonPropertyName("width")]
    public double Width { get; set; }

    [JsonPropertyName("height")]
    public double Height { get; set; }

    [JsonPropertyName("page")]
    public PageSettings? Page { get; set; }
}

/// <summary>
/// Page settings for the report
/// </summary>
public class PageSettings
{
    [JsonPropertyName("preset")]
    public string Preset { get; set; } = "A4";

    [JsonPropertyName("orientation")]
    public string Orientation { get; set; } = "portrait";

    [JsonPropertyName("width")]
    public double Width { get; set; }

    [JsonPropertyName("height")]
    public double Height { get; set; }

    [JsonPropertyName("margins")]
    public PageMargins? Margins { get; set; }
}

/// <summary>
/// Page margins
/// </summary>
public class PageMargins
{
    [JsonPropertyName("top")]
    public double Top { get; set; }

    [JsonPropertyName("right")]
    public double Right { get; set; }

    [JsonPropertyName("bottom")]
    public double Bottom { get; set; }

    [JsonPropertyName("left")]
    public double Left { get; set; }
}
