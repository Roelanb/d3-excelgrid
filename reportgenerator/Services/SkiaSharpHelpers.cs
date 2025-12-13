using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using SkiaSharp;

namespace ReportGenerator.Services;

/// <summary>
/// Helper extensions for integrating SkiaSharp with QuestPDF
/// </summary>
public static class SkiaSharpHelpers
{
    /// <summary>
    /// Renders content using SkiaSharp as SVG (vector, scalable)
    /// </summary>
    public static void SkiaSharpSvgCanvas(this IContainer container,
        Action<SKCanvas, Size> drawOnCanvas)
    {
        container.Svg(size =>
        {
            using var stream = new MemoryStream();
            using (var canvas = SKSvgCanvas.Create(
                new SKRect(0, 0, size.Width, size.Height), stream))
            {
                drawOnCanvas(canvas, size);
            }

            var svgData = stream.ToArray();
            return Encoding.UTF8.GetString(svgData);
        });
    }

    /// <summary>
    /// Renders content using SkiaSharp as rasterized image (bitmap)
    /// </summary>
    public static void SkiaSharpRasterizedCanvas(this IContainer container,
        Action<SKCanvas, Size> drawOnCanvas)
    {
        container.Image(payload =>
        {
            using var bitmap = new SKBitmap(
                payload.ImageSize.Width, payload.ImageSize.Height);
            using (var canvas = new SKCanvas(bitmap))
            {
                canvas.Scale(payload.ImageSize.Width / payload.AvailableSpace.Width,
                    payload.ImageSize.Height / payload.AvailableSpace.Height);
                drawOnCanvas(canvas, new Size(
                    payload.AvailableSpace.Width,
                    payload.AvailableSpace.Height));
            }
            return bitmap.Encode(SKEncodedImageFormat.Png, 100).ToArray();
        });
    }
}
