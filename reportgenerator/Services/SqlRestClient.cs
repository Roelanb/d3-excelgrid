using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ReportGenerator.Models;

namespace ReportGenerator.Services;

public class SqlRestClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;

    public SqlRestClient(HttpClient http, IConfiguration configuration)
    {
        _http = http;
        _configuration = configuration;
    }

    private string BaseUrl => (_configuration["SQLREST_BASE_URL"] ?? "http://localhost:3200").TrimEnd('/');

    private string Username => _configuration["SQLREST_USERNAME"] ?? "admin";

    private string Password => _configuration["SQLREST_PASSWORD"] ?? "admin";

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        var url = $"{BaseUrl}/api/auth/login";
        using var response = await _http.PostAsJsonAsync(url, new { username = Username, password = Password }, ct);
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;
        if (root.TryGetProperty("token", out var tokenEl))
            return tokenEl.GetString() ?? throw new InvalidOperationException("SQLRest login did not return a token");
        if (root.TryGetProperty("Token", out var tokenEl2))
            return tokenEl2.GetString() ?? throw new InvalidOperationException("SQLRest login did not return a token");

        throw new InvalidOperationException("SQLRest login did not return a token");
    }

    public async Task<List<string>> GetTablesAsync(CancellationToken ct)
    {
        var token = await GetTokenAsync(ct);

        var url = $"{BaseUrl}/api/tables";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _http.SendAsync(req, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"SQLRest tables request failed ({(int)response.StatusCode}): {body}");
        }

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        if (!TryGetProperty(doc.RootElement, "tables", out var tablesEl))
            return new List<string>();

        if (tablesEl.ValueKind != JsonValueKind.Array)
            return new List<string>();

        var tables = new List<string>();
        foreach (var t in tablesEl.EnumerateArray())
        {
            var fullName = ReadString(t, "fullName");
            if (!string.IsNullOrWhiteSpace(fullName))
                tables.Add(fullName.Trim());
        }

        return tables;
    }

    public async Task<List<LlmColumnInfo>> GetTableSchemaAsync(string fullName, CancellationToken ct)
    {
        var (schema, table) = SplitFullName(fullName);
        var url = $"{BaseUrl}/api/tables/{Uri.EscapeDataString(schema)}/{Uri.EscapeDataString(table)}/schema";

        using var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"SQLRest schema request failed ({(int)response.StatusCode}): {body}");
        }

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var columns = new List<LlmColumnInfo>();
        if (!TryGetProperty(doc.RootElement, "columns", out var columnsEl))
            return columns;

        if (columnsEl.ValueKind != JsonValueKind.Array)
            return columns;

        foreach (var col in columnsEl.EnumerateArray())
        {
            var name = ReadString(col, "name") ?? string.Empty;
            var type = ReadString(col, "type") ?? string.Empty;
            var isNullable = ReadBool(col, "isNullable") ?? false;
            var isPrimaryKey = ReadBool(col, "isPrimaryKey") ?? false;
            var maxLength = ReadInt(col, "maxLength");
            var precision = ReadInt(col, "precision");
            var scale = ReadInt(col, "scale");

            if (string.IsNullOrWhiteSpace(name))
                continue;

            columns.Add(new LlmColumnInfo
            {
                Name = name,
                Type = type,
                IsNullable = isNullable,
                IsPrimaryKey = isPrimaryKey,
                MaxLength = maxLength,
                Precision = precision,
                Scale = scale
            });
        }

        if (columns.Count == 0)
            throw new InvalidOperationException($"SQLRest returned no columns for source '{fullName}' (table may not exist)");

        return columns;
    }

    public async Task<List<Dictionary<string, object?>>> GetSampleRowsAsync(string fullName, int pageSize, CancellationToken ct)
    {
        var (schema, table) = SplitFullName(fullName);
        var token = await GetTokenAsync(ct);

        var url = $"{BaseUrl}/api/{Uri.EscapeDataString(schema)}/{Uri.EscapeDataString(table)}?page=1&pageSize={pageSize}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _http.SendAsync(req, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"SQLRest data request failed for '{fullName}' ({(int)response.StatusCode}): {body}");
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        if (!TryGetProperty(doc.RootElement, "data", out var dataEl))
            return new List<Dictionary<string, object?>>();

        if (dataEl.ValueKind != JsonValueKind.Array)
            return new List<Dictionary<string, object?>>();

        var rows = new List<Dictionary<string, object?>>();
        foreach (var rowEl in dataEl.EnumerateArray())
        {
            if (rowEl.ValueKind != JsonValueKind.Object)
                continue;

            var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in rowEl.EnumerateObject())
            {
                dict[prop.Name] = ConvertJsonElement(prop.Value);
            }
            rows.Add(dict);
        }

        return rows;
    }

    private static object? ConvertJsonElement(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.TryGetInt64(out var i) ? i : el.TryGetDouble(out var d) ? d : (object?)el.GetRawText(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Undefined => null,
            _ => el.GetRawText()
        };
    }

    private static (string Schema, string Name) SplitFullName(string fullName)
    {
        var trimmed = (fullName ?? string.Empty).Trim();
        if (trimmed.Length == 0)
            return ("dbo", string.Empty);

        var parts = trimmed.Split('.', 2);
        if (parts.Length == 2)
            return (string.IsNullOrWhiteSpace(parts[0]) ? "dbo" : parts[0], parts[1]);

        return ("dbo", trimmed);
    }

    private static bool TryGetProperty(JsonElement obj, string camelName, out JsonElement value)
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(camelName, out value))
            return true;

        var pascal = char.ToUpperInvariant(camelName[0]) + camelName[1..];
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(pascal, out value))
            return true;

        value = default;
        return false;
    }

    private static string? ReadString(JsonElement obj, string name)
    {
        if (!TryGetProperty(obj, name, out var value))
            return null;

        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText();
    }

    private static bool? ReadBool(JsonElement obj, string name)
    {
        if (!TryGetProperty(obj, name, out var value))
            return null;

        return value.ValueKind == JsonValueKind.True ? true : value.ValueKind == JsonValueKind.False ? false : null;
    }

    private static int? ReadInt(JsonElement obj, string name)
    {
        if (!TryGetProperty(obj, name, out var value))
            return null;

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var i))
            return i;

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var j))
            return j;

        return null;
    }
}
