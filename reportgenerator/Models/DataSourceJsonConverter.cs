using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReportGenerator.Models;

public class DataSourceJsonConverter : JsonConverter<DataSource>
{
    public override DataSource? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            return FromString(s);
        }

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            using var doc = JsonDocument.ParseValue(ref reader);
            var root = doc.RootElement;

            // Normal case: object with fields
            var ds = new DataSource
            {
                Type = ReadString(root, options, "type") ?? "sqlrest",
                SourceType = ReadString(root, options, "sourceType"),
                Name = ReadString(root, options, "name"),
                TableName = ReadString(root, options, "tableName"),
                Sql = ReadString(root, options, "sql"),
                ProcedureParams = ReadDict(root, options, "procedureParams")
            };

            // Some models return { dataSource: { table: "schema.table" } } or similar
            if (string.IsNullOrWhiteSpace(ds.Name) && string.IsNullOrWhiteSpace(ds.TableName))
            {
                var fallback = ReadString(root, options, "table")
                               ?? ReadString(root, options, "source")
                               ?? ReadString(root, options, "fullName");

                if (!string.IsNullOrWhiteSpace(fallback))
                {
                    ds.SourceType ??= "table";
                    ds.Name ??= fallback;
                    ds.TableName ??= fallback;
                }
            }

            return ds;
        }

        // Unexpected types: try to parse as string representation
        using (var doc = JsonDocument.ParseValue(ref reader))
        {
            var raw = doc.RootElement.GetRawText();
            return FromString(raw);
        }
    }

    public override void Write(Utf8JsonWriter writer, DataSource value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();

        writer.WriteString("type", string.IsNullOrWhiteSpace(value.Type) ? "sqlrest" : value.Type);

        if (!string.IsNullOrWhiteSpace(value.SourceType))
            writer.WriteString("sourceType", value.SourceType);

        if (!string.IsNullOrWhiteSpace(value.Name))
            writer.WriteString("name", value.Name);

        if (!string.IsNullOrWhiteSpace(value.TableName))
            writer.WriteString("tableName", value.TableName);

        if (value.ProcedureParams is { Count: > 0 })
        {
            writer.WritePropertyName("procedureParams");
            JsonSerializer.Serialize(writer, value.ProcedureParams, options);
        }

        if (!string.IsNullOrWhiteSpace(value.Sql))
            writer.WriteString("sql", value.Sql);

        writer.WriteEndObject();
    }

    private static DataSource FromString(string? value)
    {
        var s = (value ?? string.Empty).Trim();
        if (s.Length == 0)
            return new DataSource();

        // If it looks like JSON but we got here, just store it as name.
        return new DataSource
        {
            Type = "sqlrest",
            SourceType = "table",
            Name = s,
            TableName = s
        };
    }

    private static string? ReadString(JsonElement root, JsonSerializerOptions options, string propertyName)
    {
        if (root.ValueKind != JsonValueKind.Object)
            return null;

        if (root.TryGetProperty(propertyName, out var el))
            return el.ValueKind == JsonValueKind.String ? el.GetString() : el.GetRawText();

        var pascal = char.ToUpperInvariant(propertyName[0]) + propertyName[1..];
        if (root.TryGetProperty(pascal, out el))
            return el.ValueKind == JsonValueKind.String ? el.GetString() : el.GetRawText();

        return null;
    }

    private static Dictionary<string, string>? ReadDict(JsonElement root, JsonSerializerOptions options, string propertyName)
    {
        if (root.ValueKind != JsonValueKind.Object)
            return null;

        if (!root.TryGetProperty(propertyName, out var el))
        {
            var pascal = char.ToUpperInvariant(propertyName[0]) + propertyName[1..];
            if (!root.TryGetProperty(pascal, out el))
                return null;
        }

        if (el.ValueKind != JsonValueKind.Object)
            return null;

        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in el.EnumerateObject())
        {
            dict[prop.Name] = prop.Value.ValueKind == JsonValueKind.String
                ? (prop.Value.GetString() ?? string.Empty)
                : prop.Value.GetRawText();
        }

        return dict.Count == 0 ? null : dict;
    }
}
