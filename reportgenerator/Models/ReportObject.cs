using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

/// <summary>
/// Types of report objects
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReportObjectType
{
    [JsonPropertyName("text")]
    Text,

    [JsonPropertyName("image")]
    Image,

    [JsonPropertyName("chart")]
    Chart,

    [JsonPropertyName("table")]
    Table,

    [JsonPropertyName("barcode")]
    Barcode,

    [JsonPropertyName("dataRegion")]
    DataRegion,

    [JsonPropertyName("header")]
    Header,

    [JsonPropertyName("footer")]
    Footer,

    [JsonPropertyName("line")]
    Line,

    [JsonPropertyName("rectangle")]
    Rectangle,

    [JsonPropertyName("ellipse")]
    Ellipse,

    [JsonPropertyName("polygon")]
    Polygon,

    [JsonPropertyName("polyline")]
    Polyline
}

/// <summary>
/// A report object (text, image, shape, etc.)
/// </summary>
public class ReportObject
{
    [JsonPropertyName("id")]
    public required string Id { get; set; }

    [JsonPropertyName("type")]
    public ReportObjectType Type { get; set; }

    [JsonPropertyName("x")]
    public double X { get; set; }

    [JsonPropertyName("y")]
    public double Y { get; set; }

    [JsonPropertyName("width")]
    public double Width { get; set; }

    [JsonPropertyName("height")]
    public double Height { get; set; }

    [JsonPropertyName("properties")]
    public ReportObjectProperties Properties { get; set; } = new();

    /// <summary>
    /// Data records for data regions (populated at runtime)
    /// </summary>
    [JsonIgnore]
    public List<Dictionary<string, object>>? Data { get; set; }
}

/// <summary>
/// Properties for report objects
/// </summary>
public class ReportObjectProperties
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("src")]
    public string? Src { get; set; }

    [JsonPropertyName("imagePath")]
    public string? ImagePath { get; set; }

    [JsonPropertyName("imageDataUrl")]
    public string? ImageDataUrl { get; set; }

    [JsonPropertyName("imageFileName")]
    public string? ImageFileName { get; set; }

    [JsonPropertyName("imageMimeType")]
    public string? ImageMimeType { get; set; }

    [JsonPropertyName("barcodeType")]
    public string? BarcodeType { get; set; }

    [JsonPropertyName("barcodeIncludeText")]
    public bool? BarcodeIncludeText { get; set; }

    [JsonPropertyName("fontSize")]
    public double? FontSize { get; set; }

    [JsonPropertyName("fontFamily")]
    public string? FontFamily { get; set; }

    [JsonPropertyName("bold")]
    public bool? Bold { get; set; }

    [JsonPropertyName("italic")]
    public bool? Italic { get; set; }

    [JsonPropertyName("underline")]
    public bool? Underline { get; set; }

    [JsonPropertyName("strikeThrough")]
    public bool? StrikeThrough { get; set; }

    [JsonPropertyName("color")]
    public string? Color { get; set; }

    [JsonPropertyName("backgroundColor")]
    public string? BackgroundColor { get; set; }

    [JsonPropertyName("opacity")]
    public double? Opacity { get; set; }

    [JsonPropertyName("rotation")]
    public double? Rotation { get; set; }

    [JsonPropertyName("borderWidth")]
    public double? BorderWidth { get; set; }

    [JsonPropertyName("borderColor")]
    public string? BorderColor { get; set; }

    [JsonPropertyName("padding")]
    public double? Padding { get; set; }

    [JsonPropertyName("margin")]
    public double? Margin { get; set; }

    [JsonPropertyName("textAlign")]
    public string? TextAlign { get; set; }

    [JsonPropertyName("shadowBlur")]
    public double? ShadowBlur { get; set; }

    [JsonPropertyName("shadowColor")]
    public string? ShadowColor { get; set; }

    [JsonPropertyName("shadowOffsetX")]
    public double? ShadowOffsetX { get; set; }

    [JsonPropertyName("shadowOffsetY")]
    public double? ShadowOffsetY { get; set; }

    [JsonPropertyName("dataSource")]
    public DataSource? DataSource { get; set; }

    [JsonPropertyName("dataBinding")]
    public DataBinding? DataBinding { get; set; }

    // Shape-specific properties
    [JsonPropertyName("strokeWidth")]
    public double? StrokeWidth { get; set; }

    [JsonPropertyName("strokeColor")]
    public string? StrokeColor { get; set; }

    [JsonPropertyName("fillColor")]
    public string? FillColor { get; set; }

    [JsonPropertyName("points")]
    public string? Points { get; set; }

    [JsonPropertyName("columns")]
    public List<string>? Columns { get; set; }
}

/// <summary>
/// Data source configuration for data regions
/// </summary>
public class DataSource
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "sqlrest";

    [JsonPropertyName("sourceType")]
    public string? SourceType { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("tableName")]
    public string? TableName { get; set; }

    [JsonPropertyName("procedureParams")]
    public Dictionary<string, string>? ProcedureParams { get; set; }
}

/// <summary>
/// Data binding configuration for objects within data regions
/// </summary>
public class DataBinding
{
    [JsonPropertyName("tableName")]
    public string? TableName { get; set; }

    [JsonPropertyName("columnName")]
    public required string ColumnName { get; set; }
}
