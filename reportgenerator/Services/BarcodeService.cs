using ZXing;
using ZXing.Common;

namespace ReportGenerator.Services;

/// <summary>
/// Service for generating barcode images
/// </summary>
public class BarcodeService
{
    /// <summary>
    /// Generates a barcode image as PNG bytes
    /// </summary>
    public byte[] GenerateBarcode(string content, string barcodeType, int width, int height, bool includeText = false)
    {
        if (string.IsNullOrEmpty(content))
            return Array.Empty<byte>();

        var format = GetBarcodeFormat(barcodeType);
        var writer = new BarcodeWriterPixelData
        {
            Format = format,
            Options = new EncodingOptions
            {
                Width = width,
                Height = height,
                Margin = 1,
                PureBarcode = !includeText
            }
        };

        var pixelData = writer.Write(content);
        return ConvertToPng(pixelData.Pixels, pixelData.Width, pixelData.Height);
    }

    private static BarcodeFormat GetBarcodeFormat(string type) => type?.ToLowerInvariant() switch
    {
        "qrcode" or "qr" => BarcodeFormat.QR_CODE,
        "code128" => BarcodeFormat.CODE_128,
        "pdf417" => BarcodeFormat.PDF_417,
        "datamatrix" => BarcodeFormat.DATA_MATRIX,
        "ean13" => BarcodeFormat.EAN_13,
        "ean8" => BarcodeFormat.EAN_8,
        "upca" => BarcodeFormat.UPC_A,
        "upce" => BarcodeFormat.UPC_E,
        "code39" => BarcodeFormat.CODE_39,
        _ => BarcodeFormat.QR_CODE
    };

    private static byte[] ConvertToPng(byte[] rgbaPixels, int width, int height)
    {
        using var bitmap = new SkiaSharp.SKBitmap(width, height, SkiaSharp.SKColorType.Rgba8888, SkiaSharp.SKAlphaType.Premul);

        var pixels = bitmap.GetPixels();
        System.Runtime.InteropServices.Marshal.Copy(rgbaPixels, 0, pixels, rgbaPixels.Length);

        using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);

        return data.ToArray();
    }
}
