using System.Text.RegularExpressions;
using ReportGenerator.Models;

namespace ReportGenerator.Services;

/// <summary>
/// Service for substituting @parameterName placeholders with actual values
/// </summary>
public partial class ParameterSubstitutionService
{
    // New format: @parameterName
    // We only match when '@' is NOT preceded by a word char, so emails like 'a@b.com' won't match.
    [GeneratedRegex(@"(^|[^\w])@(\w+)")]
    private static partial Regex AtParameterPattern();

    // Backwards compatibility: {{parameterName}}
    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex CurlyParameterPattern();

    /// <summary>
    /// Substitutes parameter placeholders in text with their values
    /// </summary>
    public string Substitute(string? text, IEnumerable<ReportParameter>? parameters)
    {
        if (string.IsNullOrEmpty(text) || parameters == null)
            return text ?? string.Empty;

        var paramDict = parameters.ToDictionary(p => p.Name, p => p);

        var replacedAt = AtParameterPattern().Replace(text, match =>
        {
            var prefix = match.Groups[1].Value;
            var paramName = match.Groups[2].Value;
            if (paramDict.TryGetValue(paramName, out var param))
            {
                return prefix + FormatParameterValue(param);
            }

            return match.Value; // Keep original if not found
        });

        return CurlyParameterPattern().Replace(replacedAt, match =>
        {
            var paramName = match.Groups[1].Value;
            if (paramDict.TryGetValue(paramName, out var param))
            {
                return FormatParameterValue(param);
            }
            return match.Value; // Keep original if not found
        });
    }

    private static string FormatParameterValue(ReportParameter param)
    {
        var value = param.Value ?? param.DefaultValue;
        if (value == null) return string.Empty;

        return param.Type switch
        {
            ReportParameterType.Boolean => value is bool b ? (b ? "Yes" : "No") : value.ToString() ?? string.Empty,
            ReportParameterType.DateRange when value is DateRangeValue range =>
                !string.IsNullOrEmpty(range.From) && !string.IsNullOrEmpty(range.To)
                    ? $"{range.From} - {range.To}"
                    : !string.IsNullOrEmpty(range.From)
                        ? $"From {range.From}"
                        : !string.IsNullOrEmpty(range.To)
                            ? $"To {range.To}"
                            : string.Empty,
            ReportParameterType.ListString when value is IEnumerable<string> list => string.Join(", ", list),
            ReportParameterType.ListNumber when value is IEnumerable<object> list => string.Join(", ", list),
            _ => value.ToString() ?? string.Empty
        };
    }
}
