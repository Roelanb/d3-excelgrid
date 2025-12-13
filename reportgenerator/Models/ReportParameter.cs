using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

/// <summary>
/// Types of report parameters
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReportParameterType
{
    [JsonPropertyName("string")]
    String,

    [JsonPropertyName("integer")]
    Integer,

    [JsonPropertyName("float")]
    Float,

    [JsonPropertyName("date")]
    Date,

    [JsonPropertyName("time")]
    Time,

    [JsonPropertyName("datetime")]
    DateTime,

    [JsonPropertyName("daterange")]
    DateRange,

    [JsonPropertyName("boolean")]
    Boolean,

    [JsonPropertyName("list-string")]
    ListString,

    [JsonPropertyName("list-number")]
    ListNumber,

    [JsonPropertyName("email")]
    Email
}

/// <summary>
/// A report parameter definition
/// </summary>
public class ReportParameter
{
    [JsonPropertyName("id")]
    public required string Id { get; set; }

    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("type")]
    public ReportParameterType Type { get; set; }

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("placeholder")]
    public string? Placeholder { get; set; }

    [JsonPropertyName("required")]
    public bool Required { get; set; }

    [JsonPropertyName("defaultValue")]
    public object? DefaultValue { get; set; }

    [JsonPropertyName("value")]
    public object? Value { get; set; }

    [JsonPropertyName("listOptions")]
    public List<string>? ListOptions { get; set; }
}

/// <summary>
/// Date range value for daterange parameter type
/// </summary>
public class DateRangeValue
{
    [JsonPropertyName("from")]
    public string? From { get; set; }

    [JsonPropertyName("to")]
    public string? To { get; set; }
}
