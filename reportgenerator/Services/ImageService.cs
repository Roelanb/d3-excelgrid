namespace ReportGenerator.Services;

/// <summary>
/// Service for loading and processing images
/// </summary>
public class ImageService
{
    private readonly HttpClient _httpClient;

    public ImageService()
    {
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    /// <summary>
    /// Loads an image from a data URL or HTTP URL
    /// </summary>
    public async Task<byte[]?> LoadImageAsync(string? source)
    {
        if (string.IsNullOrEmpty(source))
            return null;

        try
        {
            // Handle data URLs (base64 encoded)
            if (source.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                return LoadFromDataUrl(source);
            }

            // Handle HTTP(S) URLs
            if (source.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                source.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return await LoadFromHttpAsync(source);
            }

            return null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to load image: {ex.Message}");
            return null;
        }
    }

    private static byte[]? LoadFromDataUrl(string dataUrl)
    {
        // Format: data:[<mediatype>][;base64],<data>
        var commaIndex = dataUrl.IndexOf(',');
        if (commaIndex < 0) return null;

        var base64Data = dataUrl[(commaIndex + 1)..];
        return Convert.FromBase64String(base64Data);
    }

    private async Task<byte[]?> LoadFromHttpAsync(string url)
    {
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync();
    }

    /// <summary>
    /// Gets the image format from a data URL or guesses from bytes
    /// </summary>
    public static string GetImageFormat(string? source, byte[]? data)
    {
        if (!string.IsNullOrEmpty(source) && source.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            if (source.Contains("image/png", StringComparison.OrdinalIgnoreCase)) return "png";
            if (source.Contains("image/jpeg", StringComparison.OrdinalIgnoreCase)) return "jpeg";
            if (source.Contains("image/jpg", StringComparison.OrdinalIgnoreCase)) return "jpeg";
            if (source.Contains("image/gif", StringComparison.OrdinalIgnoreCase)) return "gif";
            if (source.Contains("image/webp", StringComparison.OrdinalIgnoreCase)) return "webp";
        }

        // Try to detect from magic bytes
        if (data != null && data.Length >= 4)
        {
            // PNG: 89 50 4E 47
            if (data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47)
                return "png";

            // JPEG: FF D8 FF
            if (data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
                return "jpeg";

            // GIF: 47 49 46 38
            if (data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x38)
                return "gif";

            // WebP: 52 49 46 46 ... 57 45 42 50
            if (data.Length >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
                data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50)
                return "webp";
        }

        return "png"; // Default
    }
}
