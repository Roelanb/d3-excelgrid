using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace ReportGenerator.Services;

public class OpenRouterClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;

    public OpenRouterClient(HttpClient http, IConfiguration configuration)
    {
        _http = http;
        _configuration = configuration;
    }

    private string ApiKey => _configuration["OPENROUTER_API_KEY"] ?? string.Empty;

    private string Model => _configuration["OPENROUTER_MODEL"] ?? "mistralai/devstral-2512";

    public async Task<string> ChatAsync(string systemPrompt, string userPrompt, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ApiKey))
            throw new InvalidOperationException("OPENROUTER_API_KEY is not configured");

        var url = "https://openrouter.ai/api/v1/chat/completions";

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        req.Content = JsonContent.Create(new
        {
            model = Model,
            temperature = 0.2,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            }
        });

        using var response = await _http.SendAsync(req, ct);
        var responseText = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"OpenRouter request failed ({(int)response.StatusCode}): {responseText}");

        using var doc = JsonDocument.Parse(responseText);
        var root = doc.RootElement;

        var content = root
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return content ?? string.Empty;
    }
}
